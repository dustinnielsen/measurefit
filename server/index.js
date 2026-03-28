require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const Stripe = require('stripe');

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

        // Send welcome + payment confirmed emails
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WindowFit Server', stripe: 'connected' });
});
const ADMIN_SECRET = process.env.ADMIN_SECRET; // add this to Railway env vars

function requireAdminSecret(req, res, next) {
  const token = req.headers['x-admin-secret'];
  if (!token || token !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// GET /api/admin/dealers
app.get('/api/admin/dealers', requireAdminSecret, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('dealers')
      .select('id, name, email, plan, status, stripe_customer_id, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ dealers: data });
  } catch (err) {
    console.error('Admin dealers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/mrr
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

// GET /api/admin/recent-signups
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', function() {
  console.log('WindowFit server running on port ' + PORT);
});
// GET /api/tenant/config
// Returns brand config for the authenticated dealer's vertical
// GET /api/tenant/config/:dealerId
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