# 🚚 Truck POS

A production-grade Point of Sale system built for food trucks and multi-location small businesses in Berlin, Germany.

## Stack

| Layer | Technology |
|---|---|
| Frontend / POS | Next.js 14 (App Router) + Tailwind CSS |
| Backend API | Node.js + TypeScript + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | Clerk |
| Card payments | Stripe Terminal |
| QR payments | PayPal Orders API |
| Fiscalization | fiskaly (KassenSichV / TSE) |
| Hosting | Railway (Frankfurt region) |

## Project structure

```
/
├── apps/
│   ├── web/          # Next.js frontend (POS + dashboard + admin)
│   └── api/          # Express backend API
├── packages/
│   └── db/           # Prisma schema + migrations
└── docs/             # Architecture docs
```

## Docker (self-hosted server)

Run the full stack (PostgreSQL, API, and web) with Docker Compose:

```bash
cp .env.docker.example .env
# Edit .env — set YOUR_SERVER_IP, secrets, and POSTGRES_PASSWORD

docker compose up -d --build
```

| Service | URL |
|---|---|
| Web (POS) | http://localhost:3000 |
| API | http://localhost:3001 |
| API health | http://localhost:3001/health |

On first deploy, set `RUN_DB_SEED=true` in `.env` to load demo data, then set it back to `false`.

**Production notes:**
- Set `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, and `API_URL` to your real domain or server IP (browsers must reach the API at the URL baked into the web build).
- Rebuild the web image after changing any `NEXT_PUBLIC_*` variable: `docker compose up -d --build web`
- Do not leave Clerk or Stripe keys blank in `.env` (remove the line instead); empty values break the web image build
- For Stripe webhooks, expose port 3001 (or put a reverse proxy in front) and point webhooks to `https://your-domain/webhooks/stripe`
- Commit Prisma migrations (`packages/db/prisma/migrations`) for production; without them, the API container uses `prisma db push` on startup

## Quick start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Stripe account (with Terminal enabled)
- PayPal developer account
- fiskaly account
- Clerk account

### 1. Clone and install

```bash
git clone https://github.com/HarshBhardwaj/pointofsale.git
cd pointofsale
npm install
```

### 2. Set up environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Fill in your keys — see each .env.example for descriptions
```

### 3. Set up the database

With Docker Postgres running (`docker compose up -d postgres`), set `DATABASE_URL` in the root `.env` (see `.env.docker.example`; host port **5433**).

```bash
# From repo root (loads root .env)
npm run db:migrate:deploy
npm run db:seed --workspace=packages/db   # optional demo data
```

For a new migration during development:

```bash
npm run db:migrate
```

### 4. Run development servers

```bash
# From root
npm run dev
# API runs on http://localhost:3001
# Web runs on http://localhost:3000
```

## Payment setup

### Stripe Terminal
1. Enable Terminal in your Stripe dashboard
2. Create a location for each truck
3. Register your Stripe S700 reader to each location
4. Add the location ID and publishable key to your `.env`

### PayPal QR
1. Create a PayPal developer app at developer.paypal.com
2. Enable Orders API
3. Add client ID and secret to your `.env`

### fiskaly (German fiscalization — legally required)
1. Create an account at fiskaly.com
2. Create a TSS (Technical Security System) per location
3. Create a Client per device
4. Add API keys to your `.env`

## German compliance

This system is designed to comply with:
- **KassenSichV** — every transaction signed by fiskaly TSE
- **Belegpflicht** — receipt offered for every sale
- **DSFinV-K** — standardized export format (via fiskaly)
- **GoBD** — immutable audit log, no deletion of transaction records
- **GDPR** — minimal customer data collection

⚠️ Consult a Steuerberater before going live to confirm your VAT rates (7% food vs 19% drinks).

## License

MIT
