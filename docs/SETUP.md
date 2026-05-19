# Developer setup guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or Railway/Supabase)
- A Stripe account with Terminal enabled
- A PayPal developer account
- A fiskaly account (legally required for German POS)
- A Clerk account (auth)

---

## 1. Clone and install

```bash
git clone https://github.com/HarshBhardwaj/pointofsale.git
cd pointofsale
npm install
```

---

## 2. Configure environment variables

### API (`apps/api/.env`)
```
DATABASE_URL="postgresql://user:password@localhost:5432/truckpos"
CLERK_SECRET_KEY="sk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_BASE_URL="https://api-m.sandbox.paypal.com"
FISKALY_API_KEY="..."
FISKALY_API_SECRET="..."
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:3001"
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/pos"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/pos"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## 3. Set up the database

```bash
# Generate Prisma client
npm run db:migrate

# Seed with demo data (products, location, tax rates)
npm run db:seed
```

---

## 4. Run in development

```bash
npm run dev
# API  → http://localhost:3001
# Web  → http://localhost:3000
```

---

## 5. Set up Stripe Terminal

1. Go to Stripe Dashboard → Terminal → Locations
2. Create a location for each truck (name, address)
3. Copy the Location ID → add to `Location.stripeLocationId` in the DB (via Prisma Studio: `npm run db:studio`)
4. Register your Stripe S700 reader to the location
5. Copy the Reader ID → add to `Device.stripeReaderId` in the DB
6. For local testing: use `tmr_` simulated readers

Stripe webhook events to enable:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `refund.created`

Set webhook endpoint: `https://your-api-domain.com/webhooks/stripe`

---

## 6. Set up PayPal

1. Go to developer.paypal.com → My Apps & Credentials
2. Create an app → enable Orders API
3. Copy Client ID + Secret → `.env`
4. For live payments: switch `PAYPAL_BASE_URL` to `https://api-m.paypal.com`

PayPal webhook events to enable:
- `CHECKOUT.ORDER.APPROVED`

Set webhook endpoint: `https://your-api-domain.com/webhooks/paypal`

---

## 7. Set up fiskaly (KassenSichV — legally required in Germany)

1. Sign up at https://fiskaly.com
2. Create an Organization
3. Create a TSS (Technical Security System) for each location
4. Create a Client for each device/reader
5. Add Organization API key + secret to `.env`
6. Add `fiskalyTssId` to each `Location` record in the DB
7. Add `fiskalyClientId` to each `Device` record in the DB

---

## 8. Deploy to Railway (recommended — Frankfurt region = EU data residency)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway up
```

Set all environment variables in the Railway dashboard for both services.

---

## Key URLs once running

| Path | Description |
|---|---|
| `/pos` | Staff POS interface |
| `/admin` | Menu management |
| `/dashboard` | Revenue & order analytics |
| `/locations` | Location & device management |
| `/refunds` | Issue refunds |
| `/pay/:token` | Customer QR payment page (public) |
| `/sign-in` | Staff login |
| `GET /health` | API health check |
| `GET /api/analytics/summary` | Revenue summary |
| `POST /webhooks/stripe` | Stripe webhook receiver |
| `POST /webhooks/paypal` | PayPal webhook receiver |

---

## German compliance checklist

- [ ] fiskaly TSS created for each location (`fiskalyTssId` set)
- [ ] fiskaly Client created for each device (`fiskalyClientId` set)
- [ ] Every transaction calls `finishFiskalyTransaction` (done automatically via Stripe webhook)
- [ ] Receipt issued for every sale (Belegpflicht)
- [ ] VAT breakdown on receipt (7% food / 19% drinks — confirm with Steuerberater)
- [ ] Audit log never deleted (enforced by no DELETE route on AuditLog)
- [ ] DSFinV-K export available via `POST /api/analytics/dsfinvk` (add when fiskaly keys ready)
- [ ] Data retained for 10 years (configure DB backup policy)
