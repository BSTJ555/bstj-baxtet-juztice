/**
 * Goodwill Donation Model 85/15 — BSTJ DATA MASTER Schema v3.0, section 3.
 * All amounts are in THB. Every step mirrors the spec's numbered formula
 * so the code can be audited line-by-line against the document.
 */
export interface DonationSplit {
  grossPaidThb: number;
  caseNetThb: number; // 1. Case_Fund = Gross * 0.85
  serviceFeeThb: number; // 2. Service_Fee = Gross * 0.15
  vatOutputThb: number; // 3. VAT_Output = Service_Fee - (Service_Fee / 1.07)
  netServiceRevenueThb: number; // 4. Net_Service_Revenue = Service_Fee / 1.07
  citReserveThb: number; // 5. CIT_Reserve = Net_Service_Revenue * 0.15
  netProfitThb: number; // 6. Net_Profit = Net_Service_Revenue * 0.85
  backendShareThb: number; // 7a. backend_share = Net_Profit * 0.50
  fundTheStarShareThb: number; // 7b. fund_TheStar_share = Net_Profit * 0.25
  fundMntnShareThb: number; // 7c. fund_MNTN_share = Net_Profit * 0.25
}

const CASE_SHARE = 0.85;
const SERVICE_FEE_SHARE = 0.15;
const VAT_RATE = 0.07;
const CIT_RESERVE_RATE = 0.15;
const BACKEND_SHARE_RATE = 0.5;
const FUND_THESTAR_SHARE_RATE = 0.25;
const FUND_MNTN_SHARE_RATE = 0.25;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDonationSplit(grossPaidThb: number): DonationSplit {
  if (!Number.isFinite(grossPaidThb) || grossPaidThb <= 0) {
    throw new Error("grossPaidThb must be a positive finite number");
  }

  const caseNetThb = round2(grossPaidThb * CASE_SHARE);
  const serviceFeeThb = round2(grossPaidThb * SERVICE_FEE_SHARE);
  const netServiceRevenueThb = round2(serviceFeeThb / (1 + VAT_RATE));
  const vatOutputThb = round2(serviceFeeThb - netServiceRevenueThb);
  const citReserveThb = round2(netServiceRevenueThb * CIT_RESERVE_RATE);
  const netProfitThb = round2(netServiceRevenueThb * (1 - CIT_RESERVE_RATE));

  const backendShareThb = round2(netProfitThb * BACKEND_SHARE_RATE);
  const fundTheStarShareThb = round2(netProfitThb * FUND_THESTAR_SHARE_RATE);
  const fundMntnShareThb = round2(netProfitThb * FUND_MNTN_SHARE_RATE);

  return {
    grossPaidThb: round2(grossPaidThb),
    caseNetThb,
    serviceFeeThb,
    vatOutputThb,
    netServiceRevenueThb,
    citReserveThb,
    netProfitThb,
    backendShareThb,
    fundTheStarShareThb,
    fundMntnShareThb,
  };
}
