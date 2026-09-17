# bstj-baxtet-juztice
BSTJ BAXTET JUZTICE - Decentralized Moral-Economic Ecosystem for Youth Cultivation

## Stack

- Node.js + TypeScript + Express
- PostgreSQL via Prisma ORM
- Docker Compose for local Postgres

## Getting started

```bash
cp .env.example .env
docker compose up -d          # start local Postgres
npm install
npx prisma migrate dev --name init
npm run dev                   # starts the API on http://localhost:3000
```

`GET /health` checks the app and database connectivity.

