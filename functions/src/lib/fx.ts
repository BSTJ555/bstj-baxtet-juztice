import { getFirestore } from "firebase-admin/firestore";

/**
 * Rule 2 (Core Architecture): "1 STAR = 1 USD, referenced against real-time FX".
 *
 * `system_config/fx_rate` is the source of truth the frontend also reads
 * (via a Firestore listener, read-only per firestore.rules) so both sides
 * always show the same number. Until a real FX-provider sync job populates
 * that doc, `USD_THB_FX_RATE` is a local/emulator fallback — never hardcode
 * a rate in a live deployment.
 */
export async function getUsdToThbRate(): Promise<number> {
  const configDoc = await getFirestore().collection("system_config").doc("fx_rate").get();
  const fromFirestore = configDoc.get("usd_thb") as number | undefined;
  if (Number.isFinite(fromFirestore) && (fromFirestore as number) > 0) {
    return fromFirestore as number;
  }

  const configured = process.env.USD_THB_FX_RATE;
  if (configured) {
    const parsed = Number(configured);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  throw new Error(
    "No real-time FX source configured. Set system_config/fx_rate.usd_thb or USD_THB_FX_RATE.",
  );
}

export async function starToThb(starAmount: number): Promise<number> {
  const usdToThb = await getUsdToThbRate();
  // 1 STAR = 1 USD (Rule 2), converted to THB at the current rate.
  return starAmount * usdToThb;
}
