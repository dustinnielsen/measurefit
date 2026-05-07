require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });
const app = express();

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:5173';

const PLANS = {
  'price_1TCQW2LvxQtMPVpkECUsES8V': { name: 'basic',      label: 'Basic',      price: 7900  },
  'price_1TCQWTLvxQtMPVpkyEgtD0TS': { name: 'pro',        label: 'Pro',        price: 14900 },
  'price_1TCQWmLvxQtMPVpkLCKPkb2G': { name: 'enterprise', label: 'Enterprise', price: 29900 },
};

// ─── STRIPE CHECKOUT ──────────────────────────────────────────────────────────
app.post('/create-checkout-session', async (req, res) => {
  const { priceId, dealerId, dealerEmail, dealerName } = req.body;
  if (!priceId || !dealerId) {
    return res.status(400).json({ error: 'priceId and dealerId are required' });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: dealerEmail,
      metadata: { dealerId, dealerName: dealerName || '' },
      subscription_data: { metadata: { dealerId } },
      success_url: `${PORTAL_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PORTAL_URL}/billing/cancelled`,
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── STRIPE PORTAL ────────────────────────────────────────────────────────────
app.post('/create-portal-session', async (req, res) => {
  const { dealerId } = req.body;
  try {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('stripe_customer_id')
      .eq('id', dealerId)
      .single();

    if (!dealer?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found for this dealer' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dealer.stripe_customer_id,
      return_url: `${PORTAL_URL}/settings`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Portal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────
app.get('/subscription/:dealerId', async (req, res) => {
  const { dealerId } = req.params;
  try {
    const { data: dealer } = await supabase
      .from('dealers')
      .select('stripe_customer_id, stripe_sub_id, plan, status, mrr_cents, trial_ends_at')
      .eq('id', dealerId)
      .single();

    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

    let stripeSubscription = null;
    if (dealer.stripe_sub_id) {
      stripeSubscription = await stripe.subscriptions.retrieve(dealer.stripe_sub_id);
    }
    res.json({ dealer, stripeSubscription });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────────
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  console.log('Stripe event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const dealerId = session.metadata?.dealerId;
        if (!dealerId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = PLANS[priceId];

        await supabase.from('dealers').update({
          stripe_customer_id: session.customer,
          stripe_sub_id: session.subscription,
          plan: plan?.name ?? 'basic',
          status: 'active',
          mrr_cents: plan?.price ?? 7900,
          trial_ends_at: null,
        }).eq('id', dealerId);

        console.log(`[OK] Dealer ${dealerId} activated on ${plan?.label} plan`);

        try {
          await fetch(`http://localhost:${PORT}/send-welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealerId }),
          });
          await fetch(`http://localhost:${PORT}/send-payment-confirmed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealerId }),
          });
        } catch (e) { console.error('Onboarding emails failed:', e.message); }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const { data: dealer } = await supabase
          .from('dealers')
          .select('id, plan')
          .eq('stripe_sub_id', subId)
          .single();

        if (dealer) {
          await supabase.from('dealers').update({ status: 'active' }).eq('id', dealer.id);
          console.log(`[OK] Payment succeeded for dealer ${dealer.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (!subId) break;

        const { data: dealer } = await supabase
          .from('dealers')
          .select('id, email, name')
          .eq('stripe_sub_id', subId)
          .single();

        if (dealer) {
          await supabase.from('dealers').update({ status: 'past_due' }).eq('id', dealer.id);
          console.log(`[WARN] Payment failed for dealer ${dealer.id}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = PLANS[priceId];

        const { data: dealer } = await supabase
          .from('dealers')
          .select('id')
          .eq('stripe_sub_id', sub.id)
          .single();

        if (dealer && plan) {
          await supabase.from('dealers').update({
            plan: plan.name,
            mrr_cents: plan.price,
            status: sub.status === 'active' ? 'active' : sub.status,
          }).eq('id', dealer.id);
          console.log(`[OK] Dealer ${dealer.id} updated to ${plan.label}`);
        }
        break;
      }
case 'checkout.session.completed': {
        const session = event.data.object;
        // Only handle quote deposits — dealer billing uses same event but no metadata.type
        if (session.metadata?.type !== 'quote_deposit') break;

        const { quote_id: quoteId, dealer_id: dealerId } = session.metadata;

        // Update payment record to succeeded
        await supabaseAdmin.from('payments')
          .update({ status: 'succeeded', stripe_payment_intent_id: session.payment_intent })
          .eq('stripe_checkout_session_id', session.id);

        // Update quote payment_status
        const { data: quote } = await supabaseAdmin
          .from('quotes')
          .select('total_cents, deposit_amount_cents')
          .eq('id', quoteId)
          .single();

        if (quote) {
          const paid = session.amount_total ?? 0;
          const newStatus = paid >= (quote.total_cents ?? 0) ? 'paid_in_full' : 'deposit_paid';
          await supabaseAdmin.from('quotes')
            .update({ payment_status: newStatus })
            .eq('id', quoteId);
        }

        console.log(`[OK] Quote deposit received for quote ${quoteId}`);

        // Send confirmation email to dealer
        try {
          const { data: fullQuote } = await supabaseAdmin
            .from('quotes')
            .select('quote_number, customer:customers(first_name, last_name), dealer:dealers(name, email)')
            .eq('id', quoteId)
            .single();

          if (fullQuote?.dealer?.email) {
            await resend.emails.send({
              from: 'WindowFit <hello@windowfit.io>',
              to: [fullQuote.dealer.email],
              subject: `Deposit received — Quote ${fullQuote.quote_number}`,
              html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="color:#0A1628">Deposit Received 💰</h2>
                <p style="color:#444"><strong>${fullQuote.customer?.first_name} ${fullQuote.customer?.last_name}</strong> has paid their deposit for quote <strong>${fullQuote.quote_number}</strong>.</p>
                <p style="color:#444">Amount: <strong>$${((session.amount_total ?? 0) / 100).toFixed(2)}</strong></p>
                <a href="https://windowfit.io" style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px">View in WindowFit →</a>
              </div>`,
            });
          }
        } catch (e) { console.error('Deposit email failed:', e.message); }

        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;

        const { data: dealer } = await supabase
          .from('dealers')
          .select('id')
          .eq('stripe_sub_id', sub.id)
          .single();

        if (dealer) {
          await supabase.from('dealers').update({
            status: 'cancelled',
            mrr_cents: 0,
            stripe_sub_id: null,
          }).eq('id', dealer.id);
          console.log(`[ERR] Dealer ${dealer.id} cancelled`);
        }
        break;
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
  }

  res.json({ received: true });
});

// ─── SEND QUOTE EMAIL ─────────────────────────────────────────────────────────
app.post('/send-quote', async (req, res) => {
  const { quoteId, subtotalCents, installCents, totalCents } = req.body;
  if (!quoteId) return res.status(400).json({ error: 'quoteId is required' });

  try {
    if (subtotalCents != null && installCents != null && totalCents != null) {
      await supabaseAdmin.from('quotes').update({
        subtotal_cents: subtotalCents,
        install_cents: installCents,
        total_cents: totalCents,
      }).eq('id', quoteId);
    }

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*, customer:customers(*), dealer:dealers(*), line_items:quote_line_items(*)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found' });

    let { data: tokenData } = await supabaseAdmin
      .from('quote_tokens')
      .select('token')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenData) {
      const token = require('crypto').randomBytes(32).toString('hex');
      const { data: newToken } = await supabaseAdmin
        .from('quote_tokens')
        .insert({ quote_id: quoteId, token, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .select('token')
        .single();
    }

    const token = tokenData.token;
    const dealerName = quote.dealer.app_name ?? quote.dealer.name;
    const customerName = `${quote.customer.first_name} ${quote.customer.last_name}`;
    const brandColor = quote.dealer.brand_color ?? '#0A84FF';
    const portalUrl = `${PORTAL_URL}/quote/${token}`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${dealerName} <quotes@windowfit.io>`,
      to: [quote.customer.email],
      subject: `Your Quote from ${dealerName} - ${quote.quote_number}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:${brandColor};padding:24px;color:white">
          <h2 style="margin:0">${dealerName}</h2>
        </div>
        <div style="padding:24px">
          <h3>Hi ${customerName}!</h3>
          <p>Your quote <strong>${quote.quote_number}</strong> is ready.</p>
          <div style="text-align:center;margin:24px 0;padding:16px;background:#f5f7fa;border-radius:8px">
            <p style="margin:0;color:#444;font-size:15px">Your custom window covering quote is ready to review.</p>
          </div>
          <a href="${portalUrl}" style="display:block;background:${brandColor};color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700">View & Approve Quote -></a>
        </div>
      </div>`,
    });

    if (emailError) return res.status(500).json({ error: emailError.message });

    await supabase.from('quotes').update({ status: 'sent' }).eq('id', quoteId);
    res.json({ success: true, emailId: emailData.id, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── WELCOME EMAIL ────────────────────────────────────────────────────────────
app.post('/send-welcome', async (req, res) => {
  const { dealerId } = req.body;
  if (!dealerId) return res.status(400).json({ error: 'dealerId is required' });

  try {
    const { data: dealer, error } = await supabase
      .from('dealers')
      .select('name, owner_name, email, plan, trial_ends_at')
      .eq('id', dealerId)
      .single();

    if (error || !dealer) return res.status(404).json({ error: 'Dealer not found' });

    const trialEnd = dealer.trial_ends_at
      ? new Date(dealer.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : '14 days from today';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'WindowFit <hello@windowfit.io>',
      to: [dealer.email],
      subject: `Welcome to WindowFit, ${dealer.owner_name?.split(' ')[0] ?? dealer.name}!`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#1E6FFF;padding:24px;color:white">
          <h2 style="margin:0">WindowFit</h2>
          <p style="margin:8px 0 0;opacity:0.85;font-size:14px">AR-Powered Window Measurement</p>
        </div>
        <div style="padding:24px">
          <h3 style="color:#0A1628">Welcome, ${dealer.owner_name?.split(' ')[0] ?? dealer.name}! 🎉</h3>
          <p style="color:#444">Your WindowFit account for <strong>${dealer.name}</strong> is ready. You're on a 14-day free trial — no credit card needed until ${trialEnd}.</p>
          <div style="background:#F5F7FA;border-radius:10px;padding:20px;margin:20px 0">
            <p style="margin:0 0 12px;font-weight:700;color:#0A1628">Get started in 3 steps:</p>
            <p style="margin:0 0 8px;color:#444">📐 <strong>1.</strong> Open the WindowFit app on your iPhone</p>
            <p style="margin:0 0 8px;color:#444">🪟 <strong>2.</strong> Scan your first window with AR</p>
            <p style="margin:0;color:#444">📋 <strong>3.</strong> Select a product and send a quote</p>
          </div>
          <a href="https://windowfit.io" style="display:block;background:#1E6FFF;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700">Open WindowFit →</a>
          <p style="color:#999;font-size:13px;margin-top:20px;text-align:center">Questions? Reply to this email — we're here to help.</p>
        </div>
      </div>`,
    });

    if (emailError) return res.status(500).json({ error: emailError.message });
    res.json({ success: true, emailId: emailData.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PAYMENT CONFIRMED EMAIL ──────────────────────────────────────────────────
app.post('/send-payment-confirmed', async (req, res) => {
  const { dealerId } = req.body;
  if (!dealerId) return res.status(400).json({ error: 'dealerId is required' });

  try {
    const { data: dealer, error } = await supabase
      .from('dealers')
      .select('name, owner_name, email, plan, mrr_cents')
      .eq('id', dealerId)
      .single();

    if (error || !dealer) return res.status(404).json({ error: 'Dealer not found' });

    const planLabel = dealer.plan === 'basic' ? 'Basic' : dealer.plan === 'pro' ? 'Pro' : 'Enterprise';
    const mrr = dealer.mrr_cents ? `$${(dealer.mrr_cents / 100).toFixed(0)}` : '';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'WindowFit <hello@windowfit.io>',
      to: [dealer.email],
      subject: `Welcome to WindowFit ${planLabel}, ${dealer.owner_name?.split(' ')[0] ?? dealer.name}!`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#1E6FFF;padding:24px;color:white">
          <h2 style="margin:0">WindowFit</h2>
          <p style="margin:8px 0 0;opacity:0.85;font-size:14px">AR-Powered Window Measurement</p>
        </div>
        <div style="padding:24px">
          <h3 style="color:#0A1628">Payment confirmed ✓</h3>
          <p style="color:#444">Hi ${dealer.owner_name?.split(' ')[0] ?? dealer.name}, your <strong>WindowFit ${planLabel}</strong> subscription is now active${mrr ? ` at ${mrr}/mo` : ''}.</p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:20px;margin:20px 0">
            <p style="margin:0;color:#166534;font-weight:700">✓ ${planLabel} plan active</p>
            <p style="margin:8px 0 0;color:#166534;font-size:14px">Full access to all ${planLabel} features. Billed monthly — cancel anytime from your billing portal.</p>
          </div>
          <a href="https://windowfit.io" style="display:block;background:#1E6FFF;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700">Open WindowFit →</a>
          <p style="color:#999;font-size:13px;margin-top:20px;text-align:center">Manage your subscription anytime at windowfit.io</p>
        </div>
      </div>`,
    });

    if (emailError) return res.status(500).json({ error: emailError.message });
    res.json({ success: true, emailId: emailData.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TRIAL EXPIRING REMINDER ──────────────────────────────────────────────────
app.post('/send-trial-reminder', async (req, res) => {
  const { dealerId } = req.body;
  if (!dealerId) return res.status(400).json({ error: 'dealerId is required' });

  try {
    const { data: dealer, error } = await supabase
      .from('dealers')
      .select('name, owner_name, email, trial_ends_at')
      .eq('id', dealerId)
      .single();

    if (error || !dealer) return res.status(404).json({ error: 'Dealer not found' });

    const trialEnd = dealer.trial_ends_at
      ? new Date(dealer.trial_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'soon';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'WindowFit <hello@windowfit.io>',
      to: [dealer.email],
      subject: `Your WindowFit trial ends ${trialEnd} — keep your access`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <div style="background:#1E6FFF;padding:24px;color:white">
          <h2 style="margin:0">WindowFit</h2>
          <p style="margin:8px 0 0;opacity:0.85;font-size:14px">AR-Powered Window Measurement</p>
        </div>
        <div style="padding:24px">
          <h3 style="color:#0A1628">Your trial ends ${trialEnd}</h3>
          <p style="color:#444">Hi ${dealer.owner_name?.split(' ')[0] ?? dealer.name}, your free trial for <strong>${dealer.name}</strong> is ending soon. Upgrade now to keep measuring, quoting, and closing jobs without interruption.</p>
          <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:20px;margin:20px 0">
            <p style="margin:0;color:#92400E;font-weight:700">Plans start at $79/mo</p>
            <p style="margin:8px 0 0;color:#92400E;font-size:14px">No setup fees. Cancel anytime. Takes 2 minutes to upgrade.</p>
          </div>
          <a href="https://windowfit.io/signup" style="display:block;background:#1E6FFF;color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700">Upgrade Now →</a>
          <p style="color:#999;font-size:13px;margin-top:20px;text-align:center">Questions? Reply to this email and we'll help you choose the right plan.</p>
        </div>
      </div>`,
    });

    if (emailError) return res.status(500).json({ error: emailError.message });
    res.json({ success: true, emailId: emailData.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── QUOTE PDF EXPORT ─────────────────────────────────────────────────────────
app.post('/api/quotes/:id/pdf', async (req, res) => {
  const { id: quoteId } = req.params;
  const {
    dealerId,
    subtotalCents,
    installCents,
    totalCents,
    showMeasurements = false,
    showMarkup = false,
    lineItems: clientLineItems,
  } = req.body;

  try {
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select(`
        id, quote_number, status, created_at, notes,
        customer:customers(first_name, last_name, email, phone, address_line1, city, state, zip),
        dealer:dealers(id, name, owner_name, email),
        line_items:quote_line_items(*)
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const { data: tenantData } = await supabaseAdmin
      .from('dealers')
      .select(`
        subscription_tier,
        vertical_brands(primary_color, brand_name, product_noun_plural)
      `)
      .eq('id', quote.dealer.id)
      .single();

    const tier = tenantData?.subscription_tier ?? 'basic';
    if (tier === 'basic') {
      return res.status(403).json({ error: 'PDF export requires a Pro or Enterprise plan.' });
    }

    const brandColor    = tenantData?.vertical_brands?.primary_color ?? '#2563EB';
    const brandName     = tenantData?.vertical_brands?.brand_name ?? quote.dealer.name;
    const productNounPl = tenantData?.vertical_brands?.product_noun_plural ?? 'windows';

    const mergedItems = (clientLineItems ?? quote.line_items).map((item) => ({
      description:   item.product_name ?? item.description ?? 'Item',
      dimensions:    item.width_in && item.height_in ? `${item.width_in}" x ${item.height_in}"` : null,
      priceCents:    item.quotePriceCents ?? item.unit_price_cents ?? 0,
      markupPercent: item.markupPercent ?? null,
      quantity:      item.quantity ?? 1,
    }));

    const subtotal = subtotalCents ?? mergedItems.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    const install  = installCents  ?? 0;
    const total    = totalCents    ?? subtotal + install;

    const customerName = quote.customer
      ? `${quote.customer.first_name} ${quote.customer.last_name}`.trim()
      : 'Customer';

    const customerAddress = [
      quote.customer?.address_line1,
      quote.customer?.city,
      quote.customer?.state,
      quote.customer?.zip,
    ].filter(Boolean).join(', ');

    const quoteDate = new Date(quote.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const hexToRgb = (hex) => {
      const h = hex.replace('#', '');
      return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
      ];
    };
    const [br, bg, bb] = hexToRgb(brandColor);

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 48, bottom: 48, left: 56, right: 56 },
      info: {
        Title: `Quote ${quote.quote_number}`,
        Author: brandName,
        Subject: `Window covering quote for ${customerName}`,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_number ?? 'quote'}.pdf"`);
    doc.pipe(res);

    const PAGE_W  = doc.page.width  - doc.page.margins.left - doc.page.margins.right;
    const L       = doc.page.margins.left;
    const GRAY    = '#6B7280';
    const DARK    = '#111827';
    const LIGHT   = '#F9FAFB';
    const DIVIDER = '#E5E7EB';

    // ── Header bar ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(brandColor);

    doc.fillColor('white')
       .font('Helvetica-Bold')
       .fontSize(20)
       .text(brandName, L, 22);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('rgba(255,255,255,0.85)')
       .text('Window Covering Quote', L, 48);

    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor('white')
       .text(quote.quote_number ?? '', L, 22, { align: 'right', width: PAGE_W });

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor('rgba(255,255,255,0.85)')
       .text(quoteDate, L, 38, { align: 'right', width: PAGE_W });

    // ── Customer + Dealer info block ────────────────────────────────────────
    let y = 104;

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('BILL TO', L, y);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text(customerName, L, y + 14);
    if (customerAddress) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(customerAddress, L, y + 30);
    }
    if (quote.customer?.email) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text(quote.customer.email, L, customerAddress ? y + 44 : y + 30);
    }

    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY)
       .text('FROM', L, y, { align: 'right', width: PAGE_W });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK)
       .text(brandName, L, y + 14, { align: 'right', width: PAGE_W });
    if (quote.dealer.owner_name) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text(quote.dealer.owner_name, L, y + 30, { align: 'right', width: PAGE_W });
    }
    if (quote.dealer.email) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text(quote.dealer.email, L, quote.dealer.owner_name ? y + 44 : y + 30, { align: 'right', width: PAGE_W });
    }

    // ── Divider ─────────────────────────────────────────────────────────────
    y = 178;
    doc.moveTo(L, y).lineTo(L + PAGE_W, y).lineWidth(0.5).strokeColor(DIVIDER).stroke();

    // ── Line items table ─────────────────────────────────────────────────────
    y = 194;

    // Column layout varies based on which optional columns are shown
    // Base: description + price always shown
    // Optional: dimensions (showMeasurements), markup % (showMarkup)
    let COL;
    if (showMeasurements && showMarkup) {
      COL = {
        desc:   { x: L + 10,            w: PAGE_W * 0.40 },
        dims:   { x: L + PAGE_W * 0.42, w: PAGE_W * 0.16 },
        markup: { x: L + PAGE_W * 0.60, w: PAGE_W * 0.12 },
        qty:    { x: L + PAGE_W * 0.74, w: PAGE_W * 0.08 },
        price:  { x: L + PAGE_W * 0.84, w: PAGE_W * 0.16 },
      };
    } else if (showMeasurements) {
      COL = {
        desc:   { x: L + 10,            w: PAGE_W * 0.50 },
        dims:   { x: L + PAGE_W * 0.52, w: PAGE_W * 0.18 },
        markup: null,
        qty:    { x: L + PAGE_W * 0.72, w: PAGE_W * 0.10 },
        price:  { x: L + PAGE_W * 0.84, w: PAGE_W * 0.16 },
      };
    } else if (showMarkup) {
      COL = {
        desc:   { x: L + 10,            w: PAGE_W * 0.58 },
        dims:   null,
        markup: { x: L + PAGE_W * 0.60, w: PAGE_W * 0.12 },
        qty:    { x: L + PAGE_W * 0.74, w: PAGE_W * 0.10 },
        price:  { x: L + PAGE_W * 0.86, w: PAGE_W * 0.14 },
      };
    } else {
      COL = {
        desc:   { x: L + 10,            w: PAGE_W * 0.68 },
        dims:   null,
        markup: null,
        qty:    { x: L + PAGE_W * 0.70, w: PAGE_W * 0.12 },
        price:  { x: L + PAGE_W * 0.84, w: PAGE_W * 0.16 },
      };
    }

    // Table header
    doc.rect(L, y, PAGE_W, 24).fill(LIGHT);
    const headerY = y + 8;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY);
    doc.text(productNounPl.toUpperCase(), COL.desc.x, headerY);
    if (COL.dims)   doc.text('DIMENSIONS', COL.dims.x, headerY);
    if (COL.markup) doc.text('MARKUP', COL.markup.x, headerY);
    doc.text('QTY',   COL.qty.x,   headerY);
    doc.text('PRICE', COL.price.x, headerY, { align: 'right', width: COL.price.w });

    y += 24;

    // Table rows
    mergedItems.forEach((item, idx) => {
      const rowH = 36;
      if (idx % 2 === 1) doc.rect(L, y, PAGE_W, rowH).fill('#FAFAFA');

      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
         .text(item.description, COL.desc.x, y + 10, { width: COL.desc.w - 10 });

      if (COL.dims) {
        doc.font('Helvetica').fontSize(9).fillColor(GRAY)
           .text(item.dimensions ?? '—', COL.dims.x, y + 12);
      }

      if (COL.markup) {
        const markupLabel = item.markupPercent != null ? `${item.markupPercent}%` : '—';
        doc.font('Helvetica').fontSize(9).fillColor(GRAY)
           .text(markupLabel, COL.markup.x, y + 12);
      }

      doc.font('Helvetica').fontSize(10).fillColor(DARK)
         .text(String(item.quantity), COL.qty.x, y + 12);

      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
         .text(`$${(item.priceCents / 100).toFixed(0)}`, COL.price.x, y + 12, { align: 'right', width: COL.price.w });

      doc.moveTo(L, y + rowH).lineTo(L + PAGE_W, y + rowH)
         .lineWidth(0.5).strokeColor(DIVIDER).stroke();

      y += rowH;
    });

    // ── Totals block ─────────────────────────────────────────────────────────
    y += 12;

    const TOTAL_X = L + PAGE_W * 0.60;
    const TOTAL_W = PAGE_W * 0.40;

    const drawTotalRow = (label, valueCents, bold = false, colored = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(bold ? 11 : 10)
         .fillColor(colored ? `rgb(${br},${bg},${bb})` : (bold ? DARK : GRAY))
         .text(label, TOTAL_X, y);

      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(bold ? 11 : 10)
         .fillColor(colored ? `rgb(${br},${bg},${bb})` : (bold ? DARK : GRAY))
         .text(`$${(valueCents / 100).toFixed(0)}`, TOTAL_X, y, { align: 'right', width: TOTAL_W });

      y += bold ? 20 : 18;
    };

    drawTotalRow('Subtotal', subtotal);
    if (install > 0) drawTotalRow('Installation', install);

    doc.moveTo(TOTAL_X, y).lineTo(TOTAL_X + TOTAL_W, y)
       .lineWidth(0.5).strokeColor(DIVIDER).stroke();
    y += 8;

    drawTotalRow('Total', total, true, true);

    // ── Notes ────────────────────────────────────────────────────────────────
    if (quote.notes) {
      y += 16;
      doc.moveTo(L, y).lineTo(L + PAGE_W, y).lineWidth(0.5).strokeColor(DIVIDER).stroke();
      y += 12;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('NOTES', L, y);
      y += 14;
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
         .text(quote.notes, L, y, { width: PAGE_W, lineGap: 4 });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - doc.page.margins.bottom - 28;
    doc.moveTo(L, footerY).lineTo(L + PAGE_W, footerY)
       .lineWidth(0.5).strokeColor(DIVIDER).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
       .text(
         `${brandName}  ·  Generated ${quoteDate}  ·  ${quote.quote_number}`,
         L, footerY + 8,
         { align: 'center', width: PAGE_W }
       );

    doc.end();

  } catch (e) {
    console.error('PDF export error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});


// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MeasureFit Server', stripe: 'connected', build: 'puppeteer-renderer-v1' });
});

// ─── ADMIN AUTH ───────────────────────────────────────────────────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function requireAdminSecret(req, res, next) {
  const token = req.headers['x-admin-secret'];
  if (!token || token !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get('/api/admin/dealers', requireAdminSecret, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dealers')
      .select(`
        id,
        name,
        email,
        plan,
        status,
        stripe_customer_id,
        created_at,
        subscription_tier,
        vertical_brands (
          brand_key,
          brand_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ dealers: data });
  } catch (err) {
    console.error('Admin dealers error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/mrr', requireAdminSecret, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dealers')
      .select('plan, status')
      .eq('status', 'active');

    if (error) throw error;

    const planPrices = { basic: 79, pro: 149, enterprise: 299 };
    const counts = { basic: 0, pro: 0, enterprise: 0 };

    for (const dealer of data) {
      const plan = dealer.plan?.toLowerCase();
      if (counts[plan] !== undefined) counts[plan]++;
    }

    const mrr = Object.entries(counts).reduce((sum, [plan, count]) => {
      return sum + count * (planPrices[plan] || 0);
    }, 0);

    res.json({ mrr, counts, total_active: data.length });
  } catch (err) {
    console.error('Admin MRR error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/recent-signups', requireAdminSecret, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dealers')
      .select('id, name, email, plan, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ signups: data });
  } catch (err) {
    console.error('Admin recent signups error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/dealers/:id', requireAdminSecret, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c') {
      return res.status(403).json({ error: 'Cannot delete the founding dealer account.' });
    }

    const { error } = await supabaseAdmin
      .from('dealers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete dealer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── TENANT CONFIG ────────────────────────────────────────────────────────────
app.get('/api/tenant/config/:dealerId', async (req, res) => {
  try {
    const { dealerId } = req.params;

    if (!dealerId) {
      return res.status(400).json({ error: 'dealerId is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('dealers')
      .select(`
        id,
        name,
        subscription_tier,
        vertical_brand_id,
        tenant_config,
        vertical_brands (
          id,
          brand_key,
          brand_name,
          domain,
          primary_color,
          secondary_color,
          accent_color,
          logo_url,
          product_noun,
          product_noun_plural,
          measurement_unit_label
        )
      `)
      .eq('id', dealerId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Dealer not found' });
    }

    const brand = data.vertical_brands || {
      brand_key: 'windowfit',
      brand_name: 'WindowFit',
      primary_color: '#2563EB',
      secondary_color: '#1D4ED8',
      accent_color: '#BFDBFE',
      logo_url: null,
      product_noun: 'window',
      product_noun_plural: 'windows',
      measurement_unit_label: 'window opening'
    };

    return res.json({
      dealer_id: data.id,
      dealer_name: data.name,
      subscription_tier: data.subscription_tier || 'basic',
      brand_key: brand.brand_key,
      brand_name: brand.brand_name,
      primary_color: brand.primary_color,
      secondary_color: brand.secondary_color,
      accent_color: brand.accent_color,
      logo_url: brand.logo_url,
      product_noun: brand.product_noun,
      product_noun_plural: brand.product_noun_plural,
      measurement_unit_label: brand.measurement_unit_label,
      tenant_config: data.tenant_config || {}
    });

  } catch (err) {
    console.error('Tenant config error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DEALER PRICING ───────────────────────────────────────────────────────────
app.get('/api/dealer/pricing/:dealerId', async (req, res) => {
  try {
    const { dealerId } = req.params;

    const [defaultsRes, overridesRes] = await Promise.all([
      supabaseAdmin
        .from('dealer_pricing_defaults')
        .select('*')
        .eq('dealer_id', dealerId),
      supabaseAdmin
        .from('dealer_pricing_overrides')
        .select('*, products(id, name, category, msrp_cents)')
        .eq('dealer_id', dealerId),
    ]);

    if (defaultsRes.error) throw defaultsRes.error;
    if (overridesRes.error) throw overridesRes.error;

    res.json({
      defaults: defaultsRes.data || [],
      overrides: overridesRes.data || [],
    });
  } catch (err) {
    console.error('Dealer pricing GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dealer/pricing/:dealerId/defaults', async (req, res) => {
  try {
    const { dealerId } = req.params;
    const { category, cost_multiplier, markup_percent } = req.body;

    if (!category || cost_multiplier == null || markup_percent == null) {
      return res.status(400).json({ error: 'category, cost_multiplier, and markup_percent are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('dealer_pricing_defaults')
      .upsert({
        dealer_id: dealerId,
        category,
        cost_multiplier,
        markup_percent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'dealer_id,category' })
      .select()
      .single();

    if (error) throw error;
    res.json({ default: data });
  } catch (err) {
    console.error('Dealer pricing defaults PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/dealer/pricing/:dealerId/overrides', async (req, res) => {
  try {
    const { dealerId } = req.params;
    const { product_id, cost_multiplier, markup_percent, custom_price_cents } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('dealer_pricing_overrides')
      .upsert({
        dealer_id: dealerId,
        product_id,
        cost_multiplier: cost_multiplier ?? null,
        markup_percent: markup_percent ?? null,
        custom_price_cents: custom_price_cents ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'dealer_id,product_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ override: data });
  } catch (err) {
    console.error('Dealer pricing overrides PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/dealer/pricing/:dealerId/overrides/:productId', async (req, res) => {
  try {
    const { dealerId, productId } = req.params;

    const { error } = await supabaseAdmin
      .from('dealer_pricing_overrides')
      .delete()
      .eq('dealer_id', dealerId)
      .eq('product_id', productId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Dealer pricing override DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ─── QUOTE PAYMENT ROUTES ──────────────────────────────────────────────────────

app.post('/api/payments/create-checkout-session', async (req, res) => {
  try {
    const { quoteId, dealerId } = req.body;
    if (!quoteId || !dealerId) {
      return res.status(400).json({ error: 'quoteId and dealerId are required' });
    }

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('id, quote_number, total_cents, payment_status, customer:customers(first_name, last_name, email), dealer:dealers(name, brand_color)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.payment_status === 'deposit_paid' || quote.payment_status === 'paid_in_full') {
      return res.status(400).json({ error: 'Quote already has a completed payment' });
    }

    
    const depositCents = req.body.depositCents
      ? Math.round(req.body.depositCents)
      : Math.round((quote.total_cents ?? 0) * 0.5);
    if (depositCents < 50) return res.status(400).json({ error: 'Quote total too low to process payment' });

    const customerName = `${quote.customer.first_name} ${quote.customer.last_name}`.trim();
    const PORTAL = process.env.PORTAL_URL || 'https://windowfit.io';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: depositCents,
          product_data: {
            name: `50% Deposit — Quote ${quote.quote_number}`,
            description: `${customerName} · ${quote.dealer.name}`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: 'quote_deposit',
        quote_id: quoteId,
        dealer_id: dealerId,
      },
      customer_email: quote.customer.email ?? undefined,
      success_url: `${PORTAL}/payment-success?quote=${quoteId}&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PORTAL}/payment-cancelled?quote=${quoteId}`,
    });

    // Insert pending payment record
    await supabaseAdmin.from('payments').insert({
      quote_id: quoteId,
      dealer_id: dealerId,
      stripe_checkout_session_id: session.id,
      amount_cents: depositCents,
      currency: 'usd',
      status: 'pending',
      payment_method: 'stripe_link',
    });

    // Mark quote as link sent
    await supabaseAdmin.from('quotes')
      .update({ payment_status: 'link_sent', deposit_amount_cents: depositCents })
      .eq('id', quoteId);

    res.json({ url: session.url, sessionId: session.id, depositCents });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/record-manual', async (req, res) => {
  try {
    const { quoteId, dealerId, amountCents, paymentMethod, notes } = req.body;
    if (!quoteId || !dealerId || !amountCents || !paymentMethod) {
      return res.status(400).json({ error: 'quoteId, dealerId, amountCents, and paymentMethod are required' });
    }
    if (!['manual_cash', 'manual_check'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be manual_cash or manual_check' });
    }

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('id, total_cents, payment_status')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found' });

    await supabaseAdmin.from('payments').insert({
      quote_id: quoteId,
      dealer_id: dealerId,
      amount_cents: amountCents,
      currency: 'usd',
      status: 'succeeded',
      payment_method: paymentMethod,
      notes: notes ?? null,
    });

    const depositCents = Math.round((quote.total_cents ?? 0) * 0.5);
    const newStatus = amountCents >= (quote.total_cents ?? 0)
      ? 'paid_in_full'
      : amountCents >= depositCents
      ? 'deposit_paid'
      : 'link_sent';

    await supabaseAdmin.from('quotes')
      .update({ payment_status: newStatus, deposit_amount_cents: amountCents })
      .eq('id', quoteId);

    res.json({ success: true, payment_status: newStatus });
  } catch (err) {
    console.error('Record manual payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/:quoteId', async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ payments: data });
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: err.message });
  }
});
// --- VOICE MEASUREMENT ---
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/voice/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No audio file provided' });

    // Transcribe with Whisper
    const { toFile } = require('openai');
    const audioFile = await toFile(
      require('fs').createReadStream(file.path),
      file.originalname || 'recording.webm',
      { type: file.mimetype || 'audio/webm' }
    );
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });
    const transcript = transcription.text;

    // Parse with GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a window measurement parser for a window covering dealer app. 
Extract measurement data from spoken input and return ONLY valid JSON, no markdown, no explanation.
Return this exact structure:
{"label":"string","width_inches":number,"height_inches":number,"mount_type":"inside"|"outside"}
Rules:
- Convert feet+inches to total inches (e.g. "4 feet 2 inches" = 50)
- Convert fractions (e.g. "36 and a half" = 36.5, "37 three quarters" = 37.75)
- label: window name/location (e.g. "Living Room Left", "Master Bedroom"). If not mentioned use "Window"
- mount_type: default to "inside" if not mentioned
- If you cannot parse width or height, return {"error":"could not parse measurements"}`
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0,
    });

    const raw = completion.choices[0].message.content ?? '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { error: 'parse_failed', raw };
    }

    // Clean up temp file
    require('fs').unlinkSync(file.path);

    res.json({ transcript, parsed });
  } catch (err) {
    console.error('Voice transcribe error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/voice/parse', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'No transcript provided' });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a window measurement parser for a window covering dealer app. 
Extract measurement data from spoken input and return ONLY valid JSON, no markdown, no explanation.
Return this exact structure:
{"label":"string","width_inches":number,"height_inches":number,"mount_type":"inside"|"outside"}
Rules:
- Convert feet+inches to total inches (e.g. "4 feet 2 inches" = 50)
- Convert fractions (e.g. "36 and a half" = 36.5, "37 three quarters" = 37.75)
- label: window name/location (e.g. "Living Room Left", "Master Bedroom"). If not mentioned use "Window"
- mount_type: default to "inside" if not mentioned
- If you cannot parse width or height, return {"error":"could not parse measurements"}`
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0,
    });
    const raw = completion.choices[0].message.content ?? '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { error: 'parse_failed', raw }; }
    res.json({ transcript, parsed });
  } catch (err) {
    console.error('Voice parse error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/voice/parse', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ error: 'No transcript provided' });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a window measurement parser for a window covering dealer app. Extract measurement data from spoken input and return ONLY valid JSON, no markdown, no explanation. Return this exact structure: {"label":"string","width_inches":number,"height_inches":number,"mount_type":"inside"|"outside"} Rules: Convert feet+inches to total inches. Convert fractions (e.g. "36 and a half" = 36.5). label: window name/location, default to "Window" if not mentioned. mount_type: default to "inside" if not mentioned. If you cannot parse width or height, return {"error":"could not parse measurements"}`
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0,
    });
const raw = completion.choices[0].message.content ?? '';
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { error: 'parse_failed', raw }; }
    res.json({ transcript, parsed });
  } catch (err) {
    console.error('Voice parse error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ─── PLAN TAKEOFF ─────────────────────────────────────────────────────────────
const takeoffJobs = new Map();

// Prune jobs older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of takeoffJobs.entries()) {
    if (job.createdAt < cutoff) takeoffJobs.delete(id);
  }
}, 30 * 60 * 1000);

// ── STAGE 1: PAGE CLASSIFICATION ─────────────────────────────────────────────
const CLASSIFY_PROMPT = (pageNums) => `Classify each of the ${pageNums.length} page image(s) shown (in order, pages ${pageNums.join(', ')}).

Assign each page one type:
- "floor_plan": top-down overhead view of building layout (rooms, walls, doors, windows)
- "elevation": exterior or interior facade view showing the face of a wall with windows as rectangles
- "section": cross-section cut showing building layers/structure
- "schedule": a table or list (window schedule, door schedule, finish schedule)
- "rcp": reflected ceiling plan (looks like floor plan but shows ceiling elements)
- "detail": large-scale construction detail of a specific element
- "mep": mechanical, electrical, plumbing, or structural plan
- "other": cover sheet, notes, specs, site plan, landscape, or anything else

Also set has_windows: true if this page shows window openings that likely have dimension or count information useful for a window covering quote.

Return a JSON array, one object per page in order:
[{ "page": ${pageNums[0]}, "type": "floor_plan", "has_windows": true, "notes": "" }, ...]
Return ONLY valid JSON. No markdown.`;

// ── SCHEDULE SEARCH (runs on every page — catches schedules embedded in detail sheets) ───
const SCHEDULE_SEARCH_PROMPT = (pageNums) => `Look at ${pageNums.length} page image(s) (pages ${pageNums.join(', ')} in order).

For EACH page: does it contain a window schedule table ANYWHERE on the page — even in a corner, even if the page is mostly drawings or details? A window schedule is a table with columns for window mark/type (A, B, W1, W2…), width, height, and possibly type/material/notes.

Return a JSON array, one object per page:
[{ "page": ${pageNums[0]}, "has_schedule": false, "schedule_tags": [] }, ...]

If has_schedule is true, also list the window mark/type letters or codes you can see in the schedule (e.g. ["A","B","C","C1","D","E","F","G","G1"]).
Return ONLY valid JSON. No markdown.`;

// ── STAGE 2A: SCHEDULE EXTRACTION ────────────────────────────────────────────
const SCHEDULE_PROMPT = (pageRange, totalPages) => `These are pages ${pageRange} from a ${totalPages}-page plan set. These pages contain window type DRAWINGS and/or a window schedule TABLE.

YOUR TASK: For each window type (A, B, C, D, E, F, G, etc.) determine the dimensions of each INDIVIDUAL PANE that would receive its own shade — NOT the overall assembly size.

━━━ CRITICAL DISTINCTION ━━━
A window "assembly" often contains multiple individual panes separated by mullions or frames.
Each separately-framed glass opening = one shade = one pane.

Example: A 9'-10" wide assembly labeled E with three sections of 3'-0" + 3'-4" + 3'-0"
= 3 individual panes, each approximately 36" wide. You would quote 3 shades, not one 118" shade.

━━━ HOW TO FIND INDIVIDUAL PANE DIMS ━━━
1. Look at the WINDOW TYPE DRAWINGS (the scaled diagrams of each type, labeled A, B, C…)
2. Inside each drawing, find the dimension strings on INDIVIDUAL SECTIONS (the subdivisions between mullions)
3. Those subdivision dimensions = individual pane width and height
4. Count how many individually-framed panes are in one assembly (panes_per_assembly)

If no type drawings exist, use the schedule table dimensions but set panes_per_assembly=1
and note "assembly dims — verify pane count in field".

━━━ WHAT TO IGNORE ━━━
- The OVERALL assembly width/height from the schedule table (use it only as a fallback)
- Transom strips that are fixed and very narrow (< 18" tall) — these rarely get shades; set a note
- Door panels within an assembly (mark in notes, do not count as a shade pane)

━━━ FEET-INCHES CONVERSION ━━━
2'-6"=30, 2'-11"=35, 3'-0"=36, 3'-4"=40, 3'-6"=42, 4'-0"=48, 5'-0"=60,
6'-0"=72, 7'-0"=84, 8'-0"=96, 8'-6"=102, 9'-0"=108, 9'-10"=118, 10'-0"=120

For each window type return ONE object:
{
  "tag": "E",
  "width_inches": 36,
  "height_inches": 72,
  "panes_per_assembly": 3,
  "covering_type": "window",
  "mount_type": null,
  "motor_type": null,
  "opacity": null,
  "fabric_spec": null,
  "product_spec": null,
  "sheet_ref": "page ${pageRange}",
  "source_type": "schedule",
  "confidence": "high",
  "notes": "3-pane assembly; 3'-0\"+3'-4\"+3'-0\"; fixed welded vinyl; balcony door"
}

Return ONLY valid JSON array. No markdown.`;

// ── STAGE 2B: ELEVATION EXTRACTION ───────────────────────────────────────────
const ELEVATION_PROMPT = (pageRange, totalPages) => `These are pages ${pageRange} from a ${totalPages}-page plan set. These pages are exterior or interior ELEVATION drawings.

Elevations show the face of a building wall. Windows appear as rectangles. Dimension lines (thin lines with tick marks or arrows at both ends) label measurements.

YOUR TASK: Extract every window opening with its dimensions from the dimension lines.

READING DIMENSION LINES:
- Horizontal dimension line touching/bracketing a window → that window's WIDTH
- Vertical dimension line touching/bracketing a window → that window's HEIGHT
- Feet-inches conversion: 3'-0"=36in, 2'-6"=30in, 3'-6"=42in, 4'-0"=48in, 5'-0"=60in, 6'-0"=72in, 7'-0"=84in, 7'-6"=90in, 8'-0"=96in

CRITICAL — DO NOT READ:
- Overall wall width (the long dimension spanning the whole facade) — that is NOT a window width
- Floor-to-floor height — that is NOT a window height
- Column/bay spacing — that is NOT a window width
- Only use a dimension if it is clearly attached by a line directly to the window rectangle

COUNT: If a row of identical windows repeats, count them and return quantity=N in ONE entry.

For each window or group:
{ "width_inches": 36, "height_inches": 84, "quantity": 6, "elevation_face": "north", "floor_level": "Level 2", "sheet_ref": "page X", "source_type": "elevation", "confidence": "high", "notes": "" }

Return ONLY valid JSON array. No markdown. Return [] if no windows found.`;

// ── STAGE 2C: FLOOR PLAN COUNTING ────────────────────────────────────────────
const FLOOR_PLAN_PROMPT = (pageRange, totalPages, knownTags) => `These are pages ${pageRange} from a ${totalPages}-page plan set. These pages are FLOOR PLANS.

YOUR ONLY JOB: COUNT window openings. Do NOT attempt to read dimensions.

${knownTags.length > 0 ? `Windows on these plans are labeled with letter tags: ${knownTags.join(', ')}. Count how many times each tag appears.` : 'Windows appear as gaps in exterior walls with a 3-line symbol. Count each opening.'}

Window openings appear as a gap in an exterior wall with a 3-line symbol (two thin parallel lines spanning the wall thickness). Do NOT count doors (arc swing). Do NOT count interior partitions.

${knownTags.length > 0 ? `For each TAG found, return one object:
{ "tag": "A", "window_count": 12, "floor_level": "Level 2", "sheet_ref": "page X", "room_name": "Multiple rooms", "notes": "locations: lobby, corridor" }` : `For each room or area:
{ "tag": null, "room_name": "Office 201", "room_number": "201", "floor_level": "Level 2", "window_count": 3, "sheet_ref": "page X", "notes": "" }`}

Count carefully. If the same tag appears across multiple rooms on these pages, sum them into one entry per tag.
Return ONLY valid JSON array. No markdown. Return [] if no windows found.`;

// ── STAGE 3: RECONCILIATION ───────────────────────────────────────────────────
const RECONCILE_PROMPT = (scheduleItems, elevItems, tagTotals) => {
  // tagTotals is { "A": 12, "C": 38, "__untagged__": 5, ... }
  const fpTotal = Object.values(tagTotals).reduce((s, v) => s + v, 0);
  const elevTotal = elevItems.reduce((s, e) => s + (e.quantity || 1), 0);
  const hasSchedule = scheduleItems.length > 0;
  const hasElevations = elevItems.length > 0;

  return `You are finalizing a window covering takeoff for a contractor. Combine the data below into a clean, accurate final list.

${hasSchedule ? `WINDOW SCHEDULE — AUTHORITATIVE SOURCE FOR DIMENSIONS (tags and sizes only, quantities come from floor plan tag counts):
${JSON.stringify(scheduleItems)}

` : ''}${hasElevations ? `ELEVATION EXTRACTIONS (window sizes from elevation drawings, ${elevTotal} total units):
${JSON.stringify(elevItems)}

` : ''}FLOOR PLAN TAG COUNTS (how many times each window tag appears in floor plans, ${fpTotal} total windows):
${JSON.stringify(tagTotals)}

RULES:
${hasSchedule ? `1. SCHEDULE + TAG COUNTS = FINAL QUANTITY
   The schedule gives: individual pane dims (width_inches, height_inches) and panes_per_assembly per tag.
   The floor plan tag counts give: how many assemblies of each tag exist in the building.
   Formula: total_shades = floor_plan_tag_count × panes_per_assembly
   Example: tag C has panes_per_assembly=1, floor plans show 38 × C → 38 shades of 72"×72"
   Example: tag E has panes_per_assembly=3, floor plans show 6 × E → 18 shades of 36"×72"
2. Use width_inches and height_inches from the schedule (individual pane dims, not assembly dims).
3. One output entry per unique tag. If two tags have the same individual pane dims, keep them separate (they may have different assembly counts).
4. If a tag appears in floor plan counts but not in the schedule: keep with dims null and confidence="low".
5. If a tag appears in the schedule but not in floor plan counts: keep with quantity=panes_per_assembly and confidence="low".
` : `1. No schedule. Use elevation dimensions as authoritative. Floor plan counts give quantities.
2. Group elevation windows by similar size (±3 inches). Sum quantities per size group.
3. Floor plan total (${fpTotal}) is your target. Flag discrepancies in notes.
`}
OUTPUT — one object per unique window tag:
{ "room_name": "Multiple rooms", "room_number": null, "tag": "C", "quantity": 38, "width_inches": 72, "height_inches": 72, "covering_type": "window", "mount_type": null, "motor_type": null, "opacity": null, "fabric_spec": null, "product_spec": null, "sheet_ref": "Schedule p.45", "confidence": "high", "notes": "Single hung vinyl; 1 pane per assembly × 38 assemblies" }

Return ONLY valid JSON array. No markdown.`;
};

// ── FALLBACK: used when classification finds no elevations ────────────────────
const FALLBACK_PROMPT = (pageRange, totalPages) => `You are helping a window covering contractor extract every window opening from architectural plans. These are pages ${pageRange} from a ${totalPages}-page plan set with no window schedule.

Extract every window opening. For dimensions: only read strings directly attached by dimension lines to the window opening symbol — not room dimensions, column spacing, or wall lengths.

Feet-inches: 3'-0"=36in, 2'-6"=30in, 7'-0"=84in, 8'-0"=96in, 7'-6"=90in.
Set width_inches/height_inches to null if you cannot trace a dimension line directly to the window.

Group identical windows in the same room into one entry with quantity=N.

Return: [{ "room_name": "", "room_number": null, "tag": null, "quantity": 1, "width_inches": 36, "height_inches": 84, "covering_type": "window", "mount_type": null, "motor_type": null, "opacity": null, "fabric_spec": null, "product_spec": null, "sheet_ref": "", "source_type": "floor_plan", "confidence": "high", "notes": "" }]
Return ONLY valid JSON array. No markdown.`;

const FALLBACK_RECONCILE_PROMPT = (items) => `Deduplicate this raw window list from multiple scan passes. Same window seen twice = collapse to one entry (do not add quantities). Group by matching dimensions (±3in). Sum quantities for same size across different rooms. Remove entries where both dims are null and quantity=1.

RAW: ${JSON.stringify(items)}

Return clean JSON array with fields: room_name, room_number, tag, quantity, width_inches, height_inches, covering_type, mount_type, motor_type, opacity, fabric_spec, product_spec, sheet_ref, confidence, notes. No markdown.`;

async function runTakeoffJob(jobId, pdfPath, projectName, totalPages) {
  const job = takeoffJobs.get(jobId);
  const fs = require('fs');
  const path = require('path');
  const puppeteer = require('puppeteer');
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const pdfjsPath  = require.resolve('pdfjs-dist/legacy/build/pdf.js');
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
  const workerSrc  = fs.readFileSync(workerPath, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const bPage = await browser.newPage();
  await bPage.setContent('<!DOCTYPE html><html><body style="margin:0;background:white"><canvas id="c"></canvas></body></html>');
  await bPage.addScriptTag({ path: pdfjsPath });

  await bPage.evaluate((ws) => {
    const blob = new Blob([ws], { type: 'application/javascript' });
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  }, workerSrc);

  const pdfBase64 = Buffer.from(fs.readFileSync(pdfPath)).toString('base64');
  await bPage.evaluate(async (b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    window.__pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  }, pdfBase64);

  const renderPageToJpeg = async (pageNum) => {
    return bPage.evaluate(async (pNum) => {
      const pdfPage = await window.__pdf.getPage(pNum);
      const raw = pdfPage.getViewport({ scale: 1 });
      const MAX_PX = 3000;
      const scale = Math.min(2.5, MAX_PX / Math.max(raw.width, raw.height));
      const viewport = pdfPage.getViewport({ scale });
      const canvas = document.getElementById('c');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      const MAX_B64 = 4.8 * 1024 * 1024;
      let quality = 0.90;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > MAX_B64 && quality > 0.50) {
        quality -= 0.10;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      return dataUrl.replace('data:image/jpeg;base64,', '');
    }, pageNum);
  };

  // Render a list of page numbers into Claude image blocks
  const renderBatch = async (pages) => {
    const blocks = [];
    for (const p of pages) {
      try {
        const data = await renderPageToJpeg(p);
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
      } catch (e) {
        console.warn(`Takeoff [${jobId}]: render failed page ${p}: ${e.message}`);
      }
    }
    return blocks;
  };

  // Call Claude and parse JSON response, returns [] on failure
  const callClaude = async (imageBlocks, promptText, maxTokens = 4000) => {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: promptText }] }],
      });
      const raw = msg.content[0]?.text ?? '[]';
      return JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
    } catch (e) {
      console.warn(`Takeoff [${jobId}]: Claude call failed: ${e.message}`);
      return [];
    }
  };

  try {
    const JOB_TIMEOUT_MS = 11 * 60 * 1000;
    const jobStart = Date.now();

    const pageList = [];
    for (let p = 1; p <= Math.min(totalPages, 48); p++) pageList.push(p);
    for (let p = 49; p <= totalPages; p += 2) pageList.push(p);

    // ── STAGE 1: CLASSIFY ALL PAGES ──────────────────────────────────
    job.progress = 'Classifying plan pages…';
    console.log(`Takeoff [${jobId}]: classifying ${pageList.length} pages`);
    const pageTypes = {};
    const CLASS_BATCH = 5;

    for (let i = 0; i < pageList.length; i += CLASS_BATCH) {
      if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
      const batch = pageList.slice(i, i + CLASS_BATCH);
      const blocks = await renderBatch(batch);
      if (!blocks.length) continue;
      const results = await callClaude(blocks, CLASSIFY_PROMPT(batch), 1200);
      for (const c of (Array.isArray(results) ? results : [])) {
        if (c.page) pageTypes[c.page] = { type: c.type, hasWindows: c.has_windows };
      }
      for (const p of batch) {
        if (!pageTypes[p]) pageTypes[p] = { type: 'unknown', hasWindows: true };
      }
    }

    const elevPages    = pageList.filter(p => ['elevation','section'].includes(pageTypes[p]?.type) && pageTypes[p]?.hasWindows);
    const fpPages      = pageList.filter(p => pageTypes[p]?.type === 'floor_plan' && pageTypes[p]?.hasWindows);
    const unknownPages = pageList.filter(p => !pageTypes[p] || pageTypes[p]?.type === 'unknown');
    // Schedule pages from classification (may miss embedded schedules — supplemented below)
    const schedPagesFromClassify = pageList.filter(p => pageTypes[p]?.type === 'schedule');

    console.log(`Takeoff [${jobId}]: classified — ${elevPages.length} elevations, ${fpPages.length} floor plans, ${schedPagesFromClassify.length} schedules, ${unknownPages.length} unknown`);

    // ── STAGE 1B: DEDICATED SCHEDULE SEARCH ─────────────────────────
    // Scan every non-floor-plan page for embedded schedule tables.
    // Catches schedules that live on detail/window-type sheets (like page 45).
    job.progress = 'Searching for window schedule…';
    const schedulePageSet = new Set(schedPagesFromClassify);
    const knownTags = [];
    const candidatePages = pageList.filter(p => !['floor_plan','mep','rcp','site'].includes(pageTypes[p]?.type));

    for (let i = 0; i < candidatePages.length; i += CLASS_BATCH) {
      if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
      const batch = candidatePages.slice(i, i + CLASS_BATCH);
      const blocks = await renderBatch(batch);
      if (!blocks.length) continue;
      const results = await callClaude(blocks, SCHEDULE_SEARCH_PROMPT(batch), 1200);
      for (const r of (Array.isArray(results) ? results : [])) {
        if (r.has_schedule) {
          schedulePageSet.add(r.page);
          if (Array.isArray(r.schedule_tags)) {
            for (const t of r.schedule_tags) if (!knownTags.includes(t)) knownTags.push(t);
          }
        }
      }
    }

    const schedPages = [...schedulePageSet];
    console.log(`Takeoff [${jobId}]: schedule pages found: [${schedPages.join(', ')}], tags: [${knownTags.join(', ')}]`);

    // ── STAGE 2A: SCHEDULE EXTRACTION ────────────────────────────────
    const scheduleItems = [];
    for (let i = 0; i < schedPages.length; i += 2) {
      if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
      const batch = schedPages.slice(i, i + 2);
      job.progress = 'Reading window schedule…';
      const blocks = await renderBatch(batch);
      if (!blocks.length) continue;
      const items = await callClaude(blocks, SCHEDULE_PROMPT(`${batch[0]}–${batch[batch.length-1]}`, totalPages));
      scheduleItems.push(...(Array.isArray(items) ? items : []));
    }
    console.log(`Takeoff [${jobId}]: ${scheduleItems.length} window types from schedule`);

    // ── STAGE 2B: ELEVATION EXTRACTION ───────────────────────────────
    const elevationItems = [];
    for (let i = 0; i < elevPages.length; i += 2) {
      if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
      const batch = elevPages.slice(i, i + 2);
      const pass = Math.floor(i / 2) + 1;
      const total = Math.ceil(elevPages.length / 2);
      job.progress = `Reading dimensions from elevations (${pass}/${total})…`;
      const blocks = await renderBatch(batch);
      if (!blocks.length) continue;
      const items = await callClaude(blocks, ELEVATION_PROMPT(`${batch[0]}–${batch[batch.length-1]}`, totalPages));
      elevationItems.push(...(Array.isArray(items) ? items : []));
    }
    console.log(`Takeoff [${jobId}]: ${elevationItems.length} items from elevations`);

    // ── STAGE 2C: FLOOR PLAN COUNTING (tag-aware) ────────────────────
    const floorPlanCounts = [];
    const allFpPages = [...new Set([...fpPages, ...unknownPages])];
    for (let i = 0; i < allFpPages.length; i += 3) {
      if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
      const batch = allFpPages.slice(i, i + 3);
      const pass = Math.floor(i / 3) + 1;
      const total = Math.ceil(allFpPages.length / 3);
      job.progress = `Counting windows in floor plans (${pass}/${total})…`;
      const blocks = await renderBatch(batch);
      if (!blocks.length) continue;
      const counts = await callClaude(blocks, FLOOR_PLAN_PROMPT(`${batch[0]}–${batch[batch.length-1]}`, totalPages, knownTags));
      floorPlanCounts.push(...(Array.isArray(counts) ? counts : []));
    }

    // Aggregate tag counts across all floor plan pages
    const tagTotals = {};
    for (const entry of floorPlanCounts) {
      const tag = entry.tag ?? '__untagged__';
      tagTotals[tag] = (tagTotals[tag] || 0) + (entry.window_count || 0);
    }
    const fpTotal = Object.values(tagTotals).reduce((s, v) => s + v, 0);
    console.log(`Takeoff [${jobId}]: floor plan tag totals — ${fpTotal} windows:`, tagTotals);

    // ── FALLBACK: no useful staged data found ────────────────────────
    const useFallback = scheduleItems.length === 0 && elevationItems.length === 0;
    const fallbackItems = [];

    if (useFallback) {
      console.log(`Takeoff [${jobId}]: no elevations or schedule found — running fallback extraction`);
      const fallbackPages = [...new Set([...fpPages, ...unknownPages])];
      for (let i = 0; i < fallbackPages.length; i += 3) {
        if (Date.now() - jobStart > JOB_TIMEOUT_MS) break;
        const batch = fallbackPages.slice(i, i + 3);
        const pass = Math.floor(i / 3) + 1;
        const total = Math.ceil(fallbackPages.length / 3);
        job.progress = `Extracting windows (${pass}/${total})…`;
        const blocks = await renderBatch(batch);
        if (!blocks.length) continue;
        const items = await callClaude(blocks, FALLBACK_PROMPT(`${batch[0]}–${batch[batch.length-1]}`, totalPages), 8000);
        fallbackItems.push(...(Array.isArray(items) ? items : []));
      }
      console.log(`Takeoff [${jobId}]: fallback extracted ${fallbackItems.length} raw items`);
    }

    await browser.close();
    try { fs.unlinkSync(pdfPath); } catch {}

    // ── STAGE 3: RECONCILE ────────────────────────────────────────────
    job.progress = 'Reconciling results…';
    let finalItems = [];

    if (useFallback) {
      if (fallbackItems.length > 0) {
        const reconciled = await callClaude([], FALLBACK_RECONCILE_PROMPT(fallbackItems), 8000);
        finalItems = Array.isArray(reconciled) && reconciled.length > 0 ? reconciled : fallbackItems;
      }
    } else {
      const reconciled = await callClaude([], RECONCILE_PROMPT(scheduleItems, elevationItems, tagTotals), 8000);
      finalItems = Array.isArray(reconciled) && reconciled.length > 0
        ? reconciled
        : [...scheduleItems, ...elevationItems];
    }

    // Normalize fields
    finalItems = finalItems.map(item => ({
      room_name:    item.room_name    || 'Unknown',
      room_number:  item.room_number  ?? null,
      tag:          item.tag          ?? null,
      quantity:     item.quantity     || 1,
      width_inches: item.width_inches ?? null,
      height_inches:item.height_inches?? null,
      covering_type:item.covering_type|| 'window',
      mount_type:   item.mount_type   ?? null,
      motor_type:   item.motor_type   ?? null,
      opacity:      item.opacity      ?? null,
      fabric_spec:  item.fabric_spec  ?? null,
      product_spec: item.product_spec ?? null,
      sheet_ref:    item.sheet_ref    ?? null,
      confidence:   item.confidence   || 'medium',
      notes:        item.notes        ?? '',
    }));

    console.log(`Takeoff [${jobId}]: complete — ${finalItems.length} final items`);
    job.status = 'done';
    job.result = {
      success: true,
      projectName: projectName || 'Untitled Project',
      totalPages,
      itemCount: finalItems.length,
      items: finalItems,
    };
  } catch (err) {
    try { browser.close(); } catch {}
    try { fs.unlinkSync(pdfPath); } catch {}
    console.error(`Takeoff [${jobId}] error:`, err);
    job.status = 'error';
    job.error = err.message;
  }
}

app.post('/api/takeoff/analyze', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No PDF file provided' });

    const { projectName } = req.body;
    const fs = require('fs');
    const { PDFDocument } = require('pdf-lib');

    // Read just enough to get page count; keep file on disk for background rendering
    const pdfBuffer = fs.readFileSync(file.path);
    const fullPdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const totalPages = fullPdf.getPageCount();

    const jobId = require('crypto').randomUUID();
    takeoffJobs.set(jobId, {
      status: 'processing',
      progress: `Starting analysis of ${totalPages}-page document…`,
      createdAt: Date.now(),
      result: null,
      error: null,
    });

    // file.path stays on disk; runTakeoffJob deletes it when done
    runTakeoffJob(jobId, file.path, projectName, totalPages).catch(() => {});

    res.json({ jobId, totalPages });
  } catch (err) {
    console.error('Takeoff start error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/takeoff/status/:jobId', (req, res) => {
  const job = takeoffJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json({
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
});
// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', function() {
  console.log('MeasureFit server running on port ' + PORT);
});