import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { writeAuditLog } from "../lib/audit";

const ALERT_AT_MS = 4 * 60 * 1000; // 4 minutes elapsed -> 60s left
const EXPIRE_AT_MS = 5 * 60 * 1000; // 5 minutes elapsed -> seize STAR

/**
 * "Comet Recoil Protocol" (spec appendix item 3).
 *
 * Runs every minute. Server time is the only clock that counts — the
 * client-side countdown is cosmetic. At the 4-minute mark this flips
 * `alerted_at`, which clients already listen to via a realtime Firestore
 * subscription on their own `pending_allocations/{id}` doc (that listener
 * *is* the push alert, no separate FCM wiring required). At 5 minutes the
 * allocation is marked EXPIRED and its STAR is seized into the System
 * Vault automatically.
 */
export const expireStaleAllocations = onSchedule(
  { schedule: "every 1 minutes", timeZone: "UTC" },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    const pendingSnap = await db
      .collection("pending_allocations")
      .where("status", "==", "PENDING")
      .get();

    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      const initiatedAt = (data.initiated_at as Timestamp).toMillis();
      const elapsedMs = now - initiatedAt;

      if (elapsedMs >= EXPIRE_AT_MS) {
        await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(doc.ref);
          if (freshSnap.get("status") !== "PENDING") return; // already resolved

          const vaultRef = db.collection("system_vault").doc("seizedStar");
          tx.set(
            vaultRef,
            {
              total_star: FieldValue.increment(data.star_amount as number),
              last_seized_at: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          tx.update(doc.ref, {
            status: "EXPIRED",
            expired_at: FieldValue.serverTimestamp(),
          });
        });

        await writeAuditLog(db, {
          action: "ALLOCATION_EXPIRED_SEIZED",
          memberId: data.member_id as string,
          targetCaseId: data.case_id as string,
          details: { allocationId: doc.id, starAmount: data.star_amount },
        });
      } else if (elapsedMs >= ALERT_AT_MS && !data.alerted_at) {
        await doc.ref.update({ alerted_at: FieldValue.serverTimestamp() });
      }
    }
  },
);
