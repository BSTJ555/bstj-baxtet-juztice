import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { starToThb } from "../lib/fx";

interface InitiateAllocationRequest {
  caseId: string;
  starAmount: number;
}

/**
 * Rule 2 (No-Wallet Architecture): STAR is never stored as a balance.
 * This creates a `pending_allocations` doc that must be confirmed within
 * the 5-minute server-side window (see scheduler/expireStaleAllocations.ts,
 * the "Comet Recoil Protocol") or the STAR is seized automatically.
 */
export const initiateAllocation = onCall<InitiateAllocationRequest>(
  async (request) => {
    const memberId = request.auth?.uid;
    if (!memberId) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }

    const { caseId, starAmount } = request.data;
    if (!caseId || typeof caseId !== "string") {
      throw new HttpsError("invalid-argument", "caseId is required.");
    }
    if (!Number.isFinite(starAmount) || starAmount <= 0) {
      throw new HttpsError("invalid-argument", "starAmount must be positive.");
    }

    const db = getFirestore();

    const caseSnap = await db.collection("donation_cases").doc(caseId).get();
    if (!caseSnap.exists) {
      throw new HttpsError("not-found", "Donation case not found.");
    }
    const approvalStatus = caseSnap.get("approval_status");
    if (approvalStatus !== "APPROVED" && approvalStatus !== "FUNDING") {
      throw new HttpsError(
        "failed-precondition",
        `Case is not open for funding (status: ${approvalStatus}).`,
      );
    }

    const grossAmountThb = await starToThb(starAmount);

    const allocationRef = db.collection("pending_allocations").doc();
    await allocationRef.set({
      member_id: memberId,
      case_id: caseId,
      star_amount: starAmount,
      gross_amount_thb: grossAmountThb,
      status: "PENDING",
      initiated_at: FieldValue.serverTimestamp(),
      alerted_at: null,
    });

    return {
      allocationId: allocationRef.id,
      grossAmountThb,
      windowSeconds: 300,
    };
  },
);
