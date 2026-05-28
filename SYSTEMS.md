# WindowFit / MeasureFit — Systems & Services Reference

## Quick Reference

| Service | What It Does | Monthly Cost | Dashboard |
|---------|-------------|--------------|-----------|
| Railway | Hosts the backend API server | ~$5–$20/mo | railway.app |
| Supabase | Database (dealers, quotes, customers, rooms, windows) | Free (keep-alive active) | supabase.com |
| Vercel | Hosts the admin portal + web frontend | Free (Hobby) | vercel.com |
| GitHub | Code repository — source of truth for all code | Free | github.com |
| Stripe | Subscription billing + customer deposit payments | No monthly fee — 2.9% + $0.30/transaction | dashboard.stripe.com |
| Resend | Sends all transactional emails (quotes, welcome, deposit receipts) | Free (3,000 emails/mo) | resend.com |
| Anthropic | Powers the Plan Takeoff tool — Claude vision API | Pay per use (~$3–15/MTok depending on model) | console.anthropic.com |
| cron-job.org | Pings the /health endpoint daily to keep Supabase from pausing | Free | cron-job.org |
| Expo / EAS | Mobile app build + distribution (iOS/Android) | Free dev / $29/mo EAS Build for production | expo.dev |

---

## Service Details

### Railway
- **What it does**: Runs `server/index.js` — the Express API that handles quotes, payments, takeoff analysis, email triggers, and Stripe webhooks
- **Auto-deploys**: Yes — every push to the `main` branch on GitHub triggers a new deploy
- **URL**: `https://windowfit-production.up.railway.app`
- **Cost**: Starter is ~$5/mo credit; scales with usage. Pro is $20/mo flat.
- **API keys stored here**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `PORTAL_URL`

---

### Supabase
- **What it does**: PostgreSQL database. Stores all app data: `dealers`, `customers`, `quotes`, `quote_line_items`, `rooms`, `windows`, `payments`, `products`, `collections`, `colorways`
- **Free tier note**: Pauses after 7 days of inactivity. **Keep-alive is active** via cron-job.org pinging `/health` daily.
- **Cost**: Free tier. Pro is $25/mo if you need more storage or no pause behavior.
- **Auth**: Also handles dealer authentication (Supabase Auth)
- **Access**: supabase.com → your project dashboard

---

### Vercel
- **What it does**: Hosts the customer-facing portal (`customer-portal/`) and the admin portal (`admin-portal/`). Serves the web version of the app.
- **Auto-deploys**: Yes — every push to `main` on GitHub
- **Cost**: Free Hobby plan. Pro is $20/mo per member if you need team features or higher limits.
- **Domains**: windowfit.io (or similar — confirm in Vercel dashboard)

---

### GitHub
- **What it does**: Version control. All code lives here. Railway and Vercel both pull from this repo on every push.
- **Repo**: github.com/dustinnielsen/measurefit (confirm exact path)
- **Cost**: Free for public repos. $4/mo for private on individual plan.
- **Branch strategy**: Work happens on feature branches (`claude/...`), merged to `main` to trigger deploys.

---

### Stripe
- **What it does**: Two things:
  1. **Dealer subscriptions** — dealers pay monthly (Basic $79, Pro $149, Enterprise $299) via Stripe Checkout
  2. **Customer deposits** — customers pay their deposit on the quote portal via Stripe Checkout
- **Cost**: No monthly fee. 2.9% + $0.30 per successful transaction.
- **Webhooks**: Stripe sends events to `https://windowfit-production.up.railway.app/webhook` — this is how the server knows when payments succeed or subscriptions change.
- **Test vs Live**: Make sure you switch to Live keys when going to production.

---

### Resend
- **What it does**: Sends all transactional emails from the app:
  - Welcome email (new dealer)
  - Quote sent to customer
  - Deposit confirmation to dealer
  - Payment confirmed email
- **From address**: `WindowFit <hello@windowfit.io>`
- **Cost**: Free tier — 3,000 emails/month, 100/day. Pro is $20/mo for 50,000 emails/month.
- **Access**: resend.com → your domain + API key

---

### Anthropic (Claude API)
- **What it does**: Powers the Plan Takeoff tool. PDF pages are rendered as images and sent to Claude's vision API to identify window sizes and counts from architectural plan sets.
- **Model used**: `claude-sonnet-4-6`
- **Cost**: Pay per use. Roughly $3/MTok input tokens, $15/MTok output tokens. A full 48-page takeoff job uses several dollars of API credits.
- **Note**: Text-extraction-based takeoff rebuild planned — will reduce API usage significantly.
- **Access**: console.anthropic.com

---

### cron-job.org
- **What it does**: Pings `https://windowfit-production.up.railway.app/health` once per day at 10am MT. This makes a lightweight database query to Supabase, keeping the free-tier project from pausing.
- **Schedule**: `0 10 * * *` (daily at 10am Mountain Time)
- **Cost**: Free
- **Set up**: ✅ Done — May 2026
- **Access**: cron-job.org → your account

---

### Expo / EAS
- **What it does**: Builds and distributes the React Native mobile app (`mobile-app/`). EAS Build compiles iOS (.ipa) and Android (.apk/.aab) binaries.
- **Cost**: Free for development builds. EAS Build Production is $29/mo.
- **Current status**: App builds tested locally with Expo Go. Production build not yet submitted to App Store / Play Store.
- **Access**: expo.dev → your account

---

## API Keys — Fill In

> Do not commit this section to GitHub if you store actual key values here.

| Key | Service | Where It Lives |
|-----|---------|---------------|
| `SUPABASE_URL` | Supabase | Railway env vars |
| `SUPABASE_ANON_KEY` | Supabase | Railway env vars + `.env.local` |
| `SUPABASE_SERVICE_KEY` | Supabase | Railway env vars |
| `STRIPE_SECRET_KEY` | Stripe | Railway env vars |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Railway env vars |
| `RESEND_API_KEY` | Resend | Railway env vars |
| `ANTHROPIC_API_KEY` | Anthropic | Railway env vars |
| `PORTAL_URL` | App config | Railway env vars |

---

## Monthly Cost Estimate

| Scenario | Estimated Monthly Cost |
|----------|----------------------|
| Pre-revenue / development | ~$0–$5 (Railway starter credit) |
| 1–5 paying dealers | ~$5–$25 (Railway + possible Supabase Pro) |
| 10+ dealers, active usage | ~$30–$60 (Railway + Supabase Pro + Anthropic usage) |
| Stripe fees | Variable — 2.9% + $0.30 per transaction |

*Anthropic API costs scale with takeoff tool usage — budget ~$2–5 per takeoff job on large plan sets.*
