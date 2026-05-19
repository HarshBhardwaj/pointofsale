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

```bash
cd packages/db
npx prisma migrate dev --name init
npx prisma db seed
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
