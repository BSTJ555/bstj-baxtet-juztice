# bstj-baxtet-juztice
BSTJ BAXTET JUZTICE - Decentralized Moral-Economic Ecosystem for Youth Cultivation

## Stack

- Google Cloud Firestore (NoSQL, 5 master data buckets — see `BSTJ DATA MASTER Schema v3.0`)
- Cloud Functions (Node.js + TypeScript, Admin SDK) — the only thing allowed to write financial data
- Firebase Security Rules — clients are read-only / create-request only

This follows the spec's Core Architecture Rules: every write to amounts, levels
or case status goes through a Cloud Function using atomic transactions; the
client SDK can never touch those fields directly (`allow write: if false` in
`firestore.rules`).

## Layout

```
firebase.json            Firebase project config (Firestore + Functions + emulators)
firestore.rules           Security rules (deny client writes on all data collections)
firestore.indexes.json    Composite indexes from spec appendix item 2
functions/
  src/
    index.ts              Exports all Cloud Functions
    lib/
      financial.ts         85/15 Goodwill Donation Model formulas (spec section 3)
      fx.ts                STAR -> THB conversion (plug in a real-time FX provider)
      receiptId.ts          REC-YYYYMMDD-XXX generator (per-day atomic counter)
      audit.ts              sha256-sealed audit_logs writer
    donations/
      initiateAllocation.ts  Creates a pending_allocations doc (No-Wallet Architecture)
      confirmAllocation.ts   Atomically applies the 85/15 split within the 5-minute window
    scheduler/
      expireStaleAllocations.ts  "Comet Recoil Protocol": alerts at 4min, seizes STAR at 5min
```

## Getting started

```bash
npm install -g firebase-tools
firebase login
# set the real project id in .firebaserc, then:
cd functions && npm install && npm run build
firebase emulators:start --only functions,firestore,pubsub
```

Set a temporary FX rate for local testing (production needs a real provider,
see `functions/src/lib/fx.ts`):

```bash
export USD_THB_FX_RATE=36.5
```

## What still needs real infrastructure before production

- **Real-time FX source** for STAR → THB (`functions/src/lib/fx.ts` throws until configured)
- **Passkey / WebAuthn enrollment** — `members.passkey_enabled` and `hardware_hash` are modeled
  in Firestore, but the actual WebAuthn ceremony (ceremony endpoints, credential storage) isn't
  wired up yet
- **Custom claims for `admin` / Warden roles** — `firestore.rules` checks
  `request.auth.token.admin`; the Cloud Function that sets this claim doesn't exist yet
- A real Firebase project (`.firebaserc` currently has a placeholder project id)
