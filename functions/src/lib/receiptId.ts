import { Firestore, Transaction } from "firebase-admin/firestore";

function todayStamp(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export interface PendingReceiptId {
  receiptId: string;
  /** Call during the transaction's write phase (after all tx.get calls). */
  commit: () => void;
}

/**
 * Generates REC-YYYYMMDD-XXX (spec section 2, bucket 3) using a per-day
 * atomic counter. Firestore transactions require every read to happen
 * before any write, so this only performs the tx.get here — call
 * `commit()` later, alongside the transaction's other writes.
 */
export async function peekNextReceiptId(
  db: Firestore,
  tx: Transaction,
): Promise<PendingReceiptId> {
  const dateStamp = todayStamp();
  const counterRef = db.collection("system_config").doc(`receipt_counter_${dateStamp}`);
  const counterSnap = await tx.get(counterRef);
  const next = (counterSnap.exists ? (counterSnap.get("count") as number) : 0) + 1;

  return {
    receiptId: `REC-${dateStamp}-${String(next).padStart(3, "0")}`,
    commit: () => {
      tx.set(counterRef, { count: next }, { merge: true });
    },
  };
}
