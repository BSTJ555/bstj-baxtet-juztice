/**
 * Seeds demo data into the Firestore EMULATOR only — never touches a real
 * project. Run this in a second Cloud Shell tab while
 * `firebase emulators:start --only functions,firestore` is running in the
 * first one.
 *
 * Usage:
 *   node scripts/seed-emulator.js
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const admin = require("firebase-admin");
admin.initializeApp({ projectId: "the-stat-f8c06" });
const db = admin.firestore();

async function seed() {
  await db.collection("system_config").doc("fx_rate").set({
    usd_thb: 35.5,
  });
  console.log("Seeded system_config/fx_rate");

  await db.collection("donation_cases").doc("STAR-2026-001").set({
    requester_id: "demo-requester",
    target_amount_thb: 177500,
    current_raised_net_85: 0,
    approval_status: "FUNDING",
    payout_bank_account: "0000000000",
    live_face_scan_passed: true,
    submitted_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("Seeded donation_cases/STAR-2026-001");

  console.log("Done. Open http://127.0.0.1:4000/firestore to see the data.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
