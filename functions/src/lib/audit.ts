import { createHash } from "crypto";
import { Firestore, FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * Spec section 2, bucket 5 (complaints & audit_logs):
 * every audit entry is sealed with a sha256_seal_hash so the log file
 * cannot be silently edited after the fact.
 */
export interface AuditLogInput {
  action: string;
  memberId: string;
  targetCaseId?: string;
  details: Record<string, unknown>;
}

function sealHash(input: AuditLogInput, sealedAtIso: string): string {
  const payload = JSON.stringify({ ...input, sealedAtIso });
  return createHash("sha256").update(payload).digest("hex");
}

export async function writeAuditLog(
  db: Firestore,
  input: AuditLogInput,
): Promise<void> {
  const sealedAtIso = new Date().toISOString();
  const sha256_seal_hash = sealHash(input, sealedAtIso);

  await db.collection("audit_logs").add({
    action: input.action,
    member_id: input.memberId,
    target_case_id: input.targetCaseId ?? null,
    details: input.details,
    sha256_seal_hash,
    timestamp: FieldValue.serverTimestamp(),
  });
}

export function firestoreDb() {
  return getFirestore();
}
