import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { computeDonationSplit } from "../lib/financial";
import { peekNextReceiptId } from "../lib/receiptId";
import { writeAuditLog } from "../lib/audit";

interface ConfirmAllocationRequest {
  allocationId: string;
}

const ALLOCATION_WINDOW_MS = 5 * 60 * 1000; // 300s, spec appendix item 3

/**
 * Confirms a pending STAR allocation inside the 5-minute server-side
 * window and, in a single atomic transaction, applies the 85/15 split
 * (spec section 3) to the case, the receipt ledger and the three funds.
 * If the window has already elapsed, the caller should expect the
 * scheduler (expireStaleAllocations) to have already seized the STAR —
 * this function re-checks server time itself rather than trusting the
 * client, per the "Anti-Clock Tampering" rule.
 */
export const confirmAllocation = onCall<ConfirmAllocationRequest>(
  async (request) => {
    const memberId = request.auth?.uid;
    if (!memberId) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }

    const { allocationId } = request.data;
    if (!allocationId || typeof allocationId !== "string") {
      throw new HttpsError("invalid-argument", "allocationId is required.");
    }

    const db = getFirestore();
    const allocationRef = db.collection("pending_allocations").doc(allocationId);

    const receiptId = await db.runTransaction(async (tx) => {
      const allocationSnap = await tx.get(allocationRef);
      if (!allocationSnap.exists) {
        throw new HttpsError("not-found", "Allocation not found.");
      }
      const allocation = allocationSnap.data()!;

      if (allocation.member_id !== memberId) {
        throw new HttpsError("permission-denied", "Not your allocation.");
      }
      if (allocation.status !== "PENDING") {
        throw new HttpsError(
          "failed-precondition",
          `Allocation is ${allocation.status}, not PENDING.`,
        );
      }

      const initiatedAt = (allocation.initiated_at as Timestamp).toMillis();
      const elapsedMs = Date.now() - initiatedAt; // server clock, not the client's
      if (elapsedMs > ALLOCATION_WINDOW_MS) {
        throw new HttpsError(
          "deadline-exceeded",
          "Allocation window expired; STAR will be seized by the scheduler.",
        );
      }

      const caseRef = db.collection("donation_cases").doc(allocation.case_id);
      const caseSnap = await tx.get(caseRef);
      if (!caseSnap.exists) {
        throw new HttpsError("not-found", "Donation case no longer exists.");
      }

      const pendingReceiptId = await peekNextReceiptId(db, tx);
      const split = computeDonationSplit(allocation.gross_amount_thb as number);

      // --- write phase: every tx.get above has resolved ---
      pendingReceiptId.commit();

      const receiptRef = db.collection("receipts").doc();
      tx.set(receiptRef, {
        receipt_id: pendingReceiptId.receiptId,
        member_id: memberId,
        gross_paid_thb: split.grossPaidThb,
        case_net_85_thb: split.caseNetThb,
        vat_7_thb: split.vatOutputThb,
        cit_reserve_15_thb: split.citReserveThb,
        system_fee_net: split.netServiceRevenueThb,
        fund_MNTN_share: split.fundMntnShareThb,
        fund_TheStar_share: split.fundTheStarShareThb,
        backend_dev_share: split.backendShareThb,
        case_id: allocation.case_id,
        timestamp: FieldValue.serverTimestamp(),
      });

      tx.update(caseRef, {
        current_raised_net_85: FieldValue.increment(split.caseNetThb),
      });

      tx.set(db.collection("fund_MNTN").doc(), {
        amount_thb: split.fundMntnShareThb,
        source_receipt_id: pendingReceiptId.receiptId,
        member_id: memberId,
        timestamp: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("fund_TheStar").doc(), {
        amount_thb: split.fundTheStarShareThb,
        source_receipt_id: pendingReceiptId.receiptId,
        member_id: memberId,
        timestamp: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection("backend_TheStar_MNTN").doc(), {
        amount_thb: split.backendShareThb,
        source_receipt_id: pendingReceiptId.receiptId,
        member_id: memberId,
        timestamp: FieldValue.serverTimestamp(),
      });

      tx.update(allocationRef, {
        status: "COMPLETED",
        completed_at: FieldValue.serverTimestamp(),
        receipt_id: pendingReceiptId.receiptId,
      });

      return pendingReceiptId.receiptId;
    });

    await writeAuditLog(db, {
      action: "ALLOCATION_CONFIRMED",
      memberId,
      targetCaseId: (await allocationRef.get()).get("case_id"),
      details: { allocationId, receiptId },
    });

    return { receiptId };
  },
);
