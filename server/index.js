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
  res.json({ status: 'ok', service: 'MeasureFit Server', stripe: 'connected' });
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
app.post('/api/takeoff/analyze', upload.single('pdf'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No PDF file provided' });

    const { projectName, startPage: startPageParam, endPage: endPageParam } = req.body;
    const fs = require('fs');
    const { PDFDocument } = require('pdf-lib');

    const pdfBuffer = fs.readFileSync(file.path);
    fs.unlinkSync(file.path);

    const fullPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = fullPdf.getPageCount();
    console.log(`Takeoff: PDF has ${totalPages} pages`);

    // Use caller-supplied page range (1-based), defaulting to pages 1–30
    const startPage = Math.max(0, startPageParam ? parseInt(startPageParam) - 1 : 0);
    const endPage = Math.min(totalPages - 1, endPageParam ? parseInt(endPageParam) - 1 : 29);

    const subPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let i = startPage; i <= endPage; i++) pageIndices.push(i);

    const copiedPages = await subPdf.copyPages(fullPdf, pageIndices);
    copiedPages.forEach(p => subPdf.addPage(p));

    const subPdfBytes = await subPdf.save();
    const pdfBase64 = Buffer.from(subPdfBytes).toString('base64');
    console.log(`Takeoff: sending ${pageIndices.length} pages, ${Math.round(subPdfBytes.length/1024)}KB`);

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `You are analyzing architectural construction drawings for a window covering dealer.

Analyze ALL pages in this PDF carefully. These may include any combination of:
- Reflected Ceiling Plans (RCPs)
- Window schedules or window type sheets
- Interior elevations
- Finish schedules or specification sheets

FIND ALL WINDOW COVERINGS indicated. Look for:
- Roller shade, blind, shutter, or shade symbols on floor plans or RCPs (typically thick lines or rectangles along window walls)
- Window covering schedules or tables listing quantities, widths, heights, and types
- Tags or codes near windows (e.g. RS-1, WS-1, SH-1, or similar)
- Notations like "SHADE (TYP)", "MOTORIZED ROLLER SHADE", "WINDOW TREATMENT", "BLIND", "SHUTTER"
- Legend entries identifying window covering symbols
- Product callouts (MechoSystems, Lutron, Hunter Douglas, Norman, etc.)
- Rough opening or finished opening dimensions associated with shades

For EACH window covering location found, extract:
- room_name: the room or space name
- room_number: the room number if shown, otherwise null
- tag: the shade/covering tag or code if shown, otherwise null
- quantity: number of shades/units at this location (default 1 if not specified)
- width_inches: width in decimal inches if shown anywhere on these pages, otherwise null
- height_inches: height in decimal inches if shown anywhere on these pages, otherwise null
- covering_type: the type of covering (e.g. "motorized roller shade", "cellular shade", "shutter")
- sheet_ref: the sheet or drawing number where found
- confidence: "high" if clearly called out, "medium" if inferred from symbol/legend, "low" if uncertain
- notes: any relevant installation notes, mount type, product spec, or other details

Return ONLY a valid JSON array, no markdown, no explanation.
If none found, return [].`
            }
          ]
        }
      ]
    });

    const raw = message.content[0]?.text ?? '[]';
    let items;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      items = JSON.parse(clean);
    } catch {
      items = [];
    }

    res.json({
      success: true,
      projectName: projectName ?? 'Untitled Project',
      totalPages,
      pagesAnalyzed: pageIndices.length,
      itemCount: items.length,
      items,
    });

  } catch (err) {
    console.error('Takeoff analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', function() {
  console.log('MeasureFit server running on port ' + PORT);
});