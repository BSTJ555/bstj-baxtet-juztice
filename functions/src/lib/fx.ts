/**
 * Rule 2 (Core Architecture): "1 STAR = 1 USD, referenced against real-time FX".
 *
 * This is a placeholder — plug in the org's real-time FX provider (e.g. an
 * exchange-rate API call, cached in Firestore/Remote Config) before this
 * goes to production. Never hardcode a rate in a live deployment.
 */
export async function getUsdToThbRate(): Promise<number> {
  const configured = process.env.USD_THB_FX_RATE;
  if (configured) {
    const parsed = Number(configured);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  throw new Error(
    "No real-time FX source configured. Set USD_THB_FX_RATE or wire up a live FX provider.",
  );
}

export async function starToThb(starAmount: number): Promise<number> {
  const usdToThb = await getUsdToThbRate();
  // 1 STAR = 1 USD (Rule 2), converted to THB at the current rate.
  return starAmount * usdToThb;
}
