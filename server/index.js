const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const puppeteer = require('puppeteer');
const Stripe = require('stripe');

const app = express();

// ── Stripe webhook needs raw body ──────────────────────────────────
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());

const stripe = new Stripe('sk_test_51TCQSBLvxQtMPVpkNBOkhdTf9VwxRQdWOBqxBS1c0BDXhhcSLJ428Kie7POv6vRuVAQ5MLEVgb5t4cjAPuusa0q700VmwPzPkY');

const supabase = createClient(
  'https://vqtuuncnolvkxyelapdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE4NTQ4NCwiZXhwIjoyMDg4NzYxNDg0fQ.iFnF4vPFL-wBX5yL8K_Bhuy6IDr7v2uSIuKNTIoVBk8'
);

const resend = new Resend('re_bsm6K39x_Kp98UUbq43Rc3deYE7zmn44k');

// ── Plan config ────────────────────────────────────────────────────
const PLANS = {
  'price_1TCQW2LvxQtMPVpkECUsES8V': { name: 'basic',      label: 'Basic',      price: 7900  },
  'price_1TCQWTLvxQtMPVpkyEgtD0TS': { name: 'pro',        label: 'Pro',        price: 14900 },
  'price_1TCQWmLvxQtMPVpkLCKPkb2G': { name: 'enterprise', label: 'Enterprise', price: 29900 },
};

// ── Create Stripe Checkout Session ─────────────────────────────────
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
      success_url: `http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/billing/cancelled`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Create Billing Portal Session ──────────────────────────────────
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
      return_url: `http://localhost:5173/settings`,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('Portal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Get subscription status ────────────────────────────────────────
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

// ── Stripe Webhook ─────────────────────────────────────────────────
// To get your webhook secret: stripe listen --forward-to localhost:3001/webhook
// It will print a whsec_... secret — add it below
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_c793a87ee18f5e3984deb0db9079c629ca0db60ab5c41df6e3171929718049d4';

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

        console.log(`✅ Dealer ${dealerId} activated on ${plan?.label} plan`);
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
          console.log(`✅ Payment succeeded for dealer ${dealer.id}`);
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
          console.log(`⚠️ Payment failed for dealer ${dealer.id}`);
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
          console.log(`✅ Dealer ${dealer.id} updated to ${plan.label}`);
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
          console.log(`❌ Dealer ${dealer.id} cancelled`);
        }
        break;
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
  }

  res.json({ received: true });
});

// ── Send Quote Email (existing) ────────────────────────────────────
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
    const portalUrl = `http://localhost:5173/quote/${token}`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${dealerName} <quotes@resend.dev>`,
      to: [quote.customer.email],
      subject: `Your Quote from ${dealerName} — ${quote.quote_number}`,
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
          <a href="${portalUrl}" style="display:block;background:${brandColor};color:white;text-align:center;padding:14px;border-radius:8px;text-decoration:none;font-weight:700">View & Approve Quote →</a>
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

// ── Health check ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'WindowFit Server', stripe: 'connected' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`WindowFit server running on http://localhost:${PORT}`);
  console.log(`Stripe integration: READY`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});