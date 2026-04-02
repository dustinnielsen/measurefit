require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');

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
  const { quoteId } = req.body;
  if (!quoteId) return res.status(400).json({ error: 'quoteId is required' });

  try {
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*, customer:customers(*), dealer:dealers(*), line_items:quote_line_items(*)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found' });

    let { data: tokenData } = await supabase
      .from('quote_tokens')
      .select('token')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!tokenData) {
      const token = require('crypto').randomBytes(32).toString('hex');
      const { data: newToken } = await supabase
        .from('quote_tokens')
        .insert({ quote_id: quoteId, token, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
        .select('token')
        .single();
      tokenData = newToken;
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
          <div style="text-align:center;margin:24px 0">
            <div style="font-size:32px;font-weight:800;color:${brandColor}">$${(quote.total_cents/100).toFixed(0)}</div>
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
  const { dealerId, subtotalCents, installCents, totalCents, lineItems: clientLineItems } = req.body;

  try {
    // Fetch quote with customer and dealer
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*, customer:customers(*), dealer:dealers(*)')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) return res.status(404).json({ error: 'Quote not found' });

    // Verify this quote belongs to the requesting dealer
    if (quote.dealer_id !== dealerId) return res.status(403).json({ error: 'Forbidden' });

    const dealer   = quote.dealer;
    const customer = quote.customer;

    // Resolve brand color to RGB for pdfkit
    const rawColor = dealer.brand_color ?? '#2563EB';
    const hexColor = rawColor.replace('#', '');
    const r = parseInt(hexColor.slice(0, 2), 16);
    const g = parseInt(hexColor.slice(2, 4), 16);
    const b = parseInt(hexColor.slice(4, 6), 16);

    // Use client-computed totals (include live markup adjustments not stored in DB)
    const subtotal = subtotalCents ?? 0;
    const install  = installCents  ?? 0;
    const total    = totalCents    ?? 0;
    const items    = clientLineItems ?? [];

    // ── Build PDF ───────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quote_number ?? 'quote'}.pdf"`);
    doc.pipe(res);

    const PAGE_W = doc.page.width;
    const MARGIN = 50;
    const COL_R  = PAGE_W - MARGIN;
    const COL_MID = PAGE_W / 2;

    // ── Header band ─────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 80).fill([r, g, b]);

    const dealerName = dealer.app_name ?? dealer.name ?? 'Your Dealer';

    doc.fillColor('white').font('Helvetica-Bold').fontSize(22)
      .text(dealerName, MARGIN, 24);
    doc.fillColor('white').font('Helvetica').fontSize(10)
      .text('Window Covering Quote', MARGIN, 50);

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
      .text(quote.quote_number ?? '', MARGIN, 24, { width: PAGE_W - MARGIN * 2, align: 'right' });
    doc.fillColor('white').font('Helvetica').fontSize(9)
      .text(dateStr, MARGIN, 42, { width: PAGE_W - MARGIN * 2, align: 'right' });

    // ── Prepared for / From ──────────────────────────────────────────────────
    let y = 104;

    doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
      .text('PREPARED FOR', MARGIN, y);
    doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
      .text('FROM', COL_MID, y);

    y += 14;

    const customerName = customer
      ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim()
      : 'Customer';

    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
      .text(customerName, MARGIN, y);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
      .text(dealerName, COL_MID, y);

    y += 16;

    if (customer?.email) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(customer.email, MARGIN, y);
      y += 13;
    }
    if (customer?.phone) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(customer.phone, MARGIN, y);
      y += 13;
    }
    if (customer?.address_line1) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9).text(customer.address_line1, MARGIN, y);
      y += 13;
    }
    if (dealer.email) {
      doc.fillColor('#6B7280').font('Helvetica').fontSize(9)
        .text(dealer.email, COL_MID, 134);
    }

    // ── Section divider ──────────────────────────────────────────────────────
    y = Math.max(y, 160) + 16;
    doc.moveTo(MARGIN, y).lineTo(COL_R, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 16;

    // ── Line items table header ──────────────────────────────────────────────
    doc.rect(MARGIN, y, COL_R - MARGIN, 24).fill('#F9FAFB');

    doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(8)
      .text('PRODUCT / DESCRIPTION', MARGIN + 8, y + 8);
    doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(8)
      .text('SIZE', PAGE_W - 260, y + 8, { width: 80, align: 'right' });
    doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(8)
      .text('MARKUP', PAGE_W - 175, y + 8, { width: 60, align: 'right' });
    doc.fillColor('#6B7280').font('Helvetica-Bold').fontSize(8)
      .text('PRICE', PAGE_W - 110, y + 8, { width: 60, align: 'right' });

    y += 28;

    // ── Line item rows ───────────────────────────────────────────────────────
    items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.rect(MARGIN, y - 4, COL_R - MARGIN, 36).fill('#FAFAFA');
      }

      const productName = (item.product_name ?? item.description ?? 'Window Covering')
        .split('—').pop()?.trim() ?? 'Window Covering';
      const size       = (item.width_in && item.height_in) ? `${item.width_in}" × ${item.height_in}"` : '';
      const markupStr  = item.markupPercent != null ? `${item.markupPercent}%` : '';
      const priceStr   = item.quotePriceCents != null ? `$${(item.quotePriceCents / 100).toFixed(0)}` : '—';

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10)
        .text(productName, MARGIN + 8, y, { width: PAGE_W - 320 });

      if (size) {
        doc.fillColor('#6B7280').font('Helvetica').fontSize(9)
          .text(size, PAGE_W - 260, y, { width: 80, align: 'right' });
      }

      doc.fillColor('#6B7280').font('Helvetica').fontSize(9)
        .text(markupStr, PAGE_W - 175, y, { width: 60, align: 'right' });

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10)
        .text(priceStr, PAGE_W - 110, y, { width: 60, align: 'right' });

      y += 36;
    });

    // ── Totals ───────────────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(MARGIN, y).lineTo(COL_R, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 16;

    const totalsX = PAGE_W - 240;

    const drawRow = (label, cents, bold = false, color = '#6B7280') => {
      const val = `$${(cents / 100).toFixed(0)}`;
      doc.fillColor(bold ? '#111827' : color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 12 : 10)
        .text(label, totalsX, y, { width: 130 });
      doc.fillColor(bold ? rawColor : color)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 12 : 10)
        .text(val, totalsX + 130, y, { width: 60, align: 'right' });
      y += bold ? 22 : 18;
    };

    drawRow('Subtotal', subtotal);
    drawRow('Installation', install);

    y += 4;
    doc.moveTo(totalsX, y).lineTo(COL_R, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    y += 10;

    drawRow('Total', total, true);

    // ── Accuracy note ────────────────────────────────────────────────────────
    y += 24;
    doc.rect(MARGIN, y, COL_R - MARGIN, 36).fill('#EFF6FF');
    doc.fillColor('#1D4ED8').font('Helvetica').fontSize(8)
      .text(
        'Measurements captured via WindowFit AR scanner (±0.25" accuracy). ' +
        'Confirm final order dimensions with a tape measure before placing the order.',
        MARGIN + 10, y + 10, { width: COL_R - MARGIN - 20 }
      );

    y += 52;

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(8)
      .text(
        `${dealerName}  ·  Generated by WindowFit  ·  ${dateStr}`,
        MARGIN, y, { width: COL_R - MARGIN, align: 'center' }
      );

    doc.end();
    console.log(`[OK] PDF generated for quote ${quoteId}`);

  } catch (e) {
    console.error('PDF generation error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WindowFit Server', stripe: 'connected' });
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

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', function() {
  console.log('WindowFit server running on port ' + PORT);
});