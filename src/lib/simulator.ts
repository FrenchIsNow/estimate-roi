// =====================================================
// TRACK RECORD (tes screenshots)
// Rendements annuels (APY) en décimal.
// Par défaut, on considère que ces rendements sont NETS des fees MEV.
// =====================================================

export interface TrackData {
  label: string;
  apyByYear: Record<number, number>;
}

export const TRACK: Record<string, TrackData> = {
  USDC: {
    label: "Stablecoin (USD) Yield",
    apyByYear: {
      2020: 0.1821,
      2021: 0.1901,
      2022: 0.1269,
      2023: 0.123,
      2024: 0.3573,
      2025: 0.1131,
    },
  },
  ETH: {
    label: "Ethereum (ETH) Yield",
    apyByYear: {
      2022: 0.2163,
      2023: 0.1544,
      2024: 0.1188,
      2025: 0.093,
    },
  },
  BTC: {
    label: "Bitcoin (BTC) Yield",
    apyByYear: {
      2024: 0.0754,
      2025: 0.0386,
    },
  },
};

// =====================================================
// Helpers format
// =====================================================

export function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtUsd(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(x);
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export interface WeightsResult {
  wU: number;
  wE: number;
  wB: number;
  sumIn: number;
  normalized: boolean;
}

export function normalizeWeights(wU: number, wE: number, wB: number): WeightsResult {
  const s = safeNumber(wU) + safeNumber(wE) + safeNumber(wB);
  if (s <= 0) return { wU: 0.5, wE: 0.25, wB: 0.25, sumIn: s, normalized: true };
  return { wU: wU / s, wE: wE / s, wB: wB / s, sumIn: s, normalized: Math.abs(s - 1) > 1e-9 };
}

// =====================================================
// Stats + CAGR
// =====================================================

export function pickEntriesForYears(apyByYear: Record<number, number>, yearsChoice: number[]): [number, number][] {
  const entries = Object.entries(apyByYear)
    .map(([y, r]) => [Number(y), Number(r)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  let filtered = yearsChoice?.length
    ? entries.filter(([y]) => yearsChoice.includes(y))
    : entries;

  if (!filtered.length) filtered = entries;
  return filtered;
}

export function cagrFromAnnualReturns(returns: number[]): number | null {
  if (!returns.length) return null;
  const product = returns.reduce((p, r) => p * (1 + r), 1);
  return Math.pow(product, 1 / returns.length) - 1;
}

export function meanArithmetic(returns: number[]): number | null {
  if (!returns.length) return null;
  return returns.reduce((s, v) => s + v, 0) / returns.length;
}

export function minMax(returns: number[]): { min: number | null; max: number | null } {
  if (!returns.length) return { min: null, max: null };
  return { min: Math.min(...returns), max: Math.max(...returns) };
}

export function scenarioSplitEntries(entries: [number, number][], scenario: string): [number, number][] {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  const k = Math.max(1, Math.ceil(n / 2));
  if (scenario === "Réaliste") return sorted;
  if (scenario === "Pessimiste") return sorted.slice(0, k);
  if (scenario === "Optimiste") return sorted.slice(n - k);
  throw new Error("Scénario inconnu");
}

export function computeScenarioCagrFromTrack(
  assetKey: string,
  scenario: string,
  yearsChoice: number[]
): AssetResult {
  const entriesAll = pickEntriesForYears(TRACK[assetKey].apyByYear, yearsChoice);
  const usedEntries = scenarioSplitEntries(entriesAll, scenario);
  const returnsUsed = usedEntries.map(([, r]) => r);
  const cagr = cagrFromAnnualReturns(returnsUsed);

  const returnsAll = entriesAll.map(([, r]) => r);
  const mm = minMax(returnsAll);

  return {
    assetKey,
    label: TRACK[assetKey].label,
    entriesAll,
    usedEntries,
    returnsAll,
    cagr,
    min: mm.min,
    max: mm.max,
    mean: meanArithmetic(returnsAll),
  };
}

export interface AssetResult {
  assetKey: string;
  label: string;
  entriesAll: [number, number][];
  usedEntries: [number, number][];
  returnsAll: number[];
  cagr: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  source?: string;
  cagrScenario?: number | null;
}

export interface ScenarioDebug {
  USDC: AssetResult;
  ETH: AssetResult;
  BTC: AssetResult;
}

export interface PortfolioReturnResult {
  rp: number;
  dbg: ScenarioDebug;
}

export interface SimulationRow {
  [key: string]: number | string | boolean | undefined;
  annee: number;
  aumDepart: number;
  rendementPortefeuille: number;
  profitAvantFees?: number;
  profitBrut?: number;
  feesMEV_Mgmt: number;
  feesMEV_Perf: number;
  fraisCustody: number;
  interets?: number;
  interetsCumul?: number;
  opexSalaires: number;
  aumApresCouts?: number;
  profitNet?: number;
  surplus?: number;
  reserveDepart?: number;
  reserveContribution?: number;
  reserveFin?: number;
  diversDepart?: number;
  diversContribution?: number;
  diversFin?: number;
  aumFin: number;
  paiementPreteurAnnuel?: number;
  conserveTotal?: number;
  distribInvest?: number;
  distribEntite?: number;
}

export interface LoanSummary {
  scenario: string;
  rendementPortefeuille: number;
  principal: number;
  duree: number;
  tauxInteret: number;
  coutsInitiaux: number;
  aumT0: number;
  totalInteretsPayes: number;
  principalRembourse: number;
  totalPaye: number;
  principalNonRembourse: number;
  reserveApresRemb: number;
  diversificationApresRemb: number;
  aumApresRemb: number;
  capitalContinuite: number;
  rembourseParReserve: number;
  rembourseParDivers: number;
  rembourseParAum: number;
}

export interface InvestmentSummary {
  scenario: string;
  rendementPortefeuille: number;
  capitalInvesti: number;
  duree: number;
  feesMEV_Mgmt: number;
  feesMEV_Perf: number;
  splitInvestisseur: number;
  splitEntite: number;
  distribution: string;
  aumAvantDistribFinale: number;
  aumApresDistribFinale: number;
  profitTotalNet: number;
  totalDistribInvest: number;
  totalDistribEntite: number;
  distribFinalInvest: number;
  distribFinalEntite: number;
}

export interface ScenarioOverrides {
  USDC: number | null;
  ETH: number | null;
  BTC: number | null;
}

export interface AllOverrides {
  enabled: boolean;
  byScenario: Record<string, ScenarioOverrides>;
}

export interface SimulationResult<T> {
  mode: string;
  scenario: string;
  rp: number;
  dbg: ScenarioDebug;
  rows: SimulationRow[];
  summary: T;
}

export interface SimulateLoanParams {
  scenario: string;
  yearsChoice: number[];
  principal: number;
  termYears: number;
  coupon: number;
  wU: number;
  wE: number;
  wB: number;
  overrides?: AllOverrides;
  returnsAreNetOfMev: boolean;
  mevMgmt: number;
  mevPerf: number;
  custodyFee: number;
  upfrontCosts: number;
  annualOpex: number;
  annualSalaries: number;
  reserveEnabled: boolean;
  reserveShare: number;
  reserveYield: number;
  diversEnabled: boolean;
  diversShare: number;
  diversYield: number;
  useDiversForRepayment: boolean;
}

export interface SimulateInvestmentParams {
  scenario: string;
  yearsChoice: number[];
  capitalInvesti: number;
  termYears: number;
  wU: number;
  wE: number;
  wB: number;
  overrides?: AllOverrides;
  mevMgmt: number;
  mevPerf: number;
  custodyFee: number;
  annualOpex: number;
  annualSalaries: number;
  splitInvestisseur: number;
  splitEntite: number;
  distribution: string;
}

export function portfolioReturnCagrScenario({
  scenario,
  yearsChoice,
  wU,
  wE,
  wB,
  overrides,
}: {
  scenario: string;
  yearsChoice: number[];
  wU: number;
  wE: number;
  wB: number;
  overrides?: AllOverrides;
}): PortfolioReturnResult {
  const ovEnabled = !!overrides?.enabled;
  const ov = overrides?.byScenario?.[scenario];

  const dU = computeScenarioCagrFromTrack("USDC", scenario, yearsChoice);
  const dE = computeScenarioCagrFromTrack("ETH", scenario, yearsChoice);
  const dB = computeScenarioCagrFromTrack("BTC", scenario, yearsChoice);

  const cU = ovEnabled && ov?.USDC != null ? ov.USDC : dU.cagr;
  const cE = ovEnabled && ov?.ETH != null ? ov.ETH : dE.cagr;
  const cB = ovEnabled && ov?.BTC != null ? ov.BTC : dB.cagr;

  const rp = wU * (cU ?? 0) + wE * (cE ?? 0) + wB * (cB ?? 0);

  return {
    rp,
    dbg: {
      USDC: { ...dU, cagrScenario: cU, source: ovEnabled && ov?.USDC != null ? "manuel" : "track" },
      ETH: { ...dE, cagrScenario: cE, source: ovEnabled && ov?.ETH != null ? "manuel" : "track" },
      BTC: { ...dB, cagrScenario: cB, source: ovEnabled && ov?.BTC != null ? "manuel" : "track" },
    },
  };
}

export function applyMevFees(startAum: number, grossReturn: number, mgmtFee: number, perfFee: number) {
  const mgmt = mgmtFee * startAum;
  const profitBefore = grossReturn * startAum;
  const profitAfterMgmt = profitBefore - mgmt;
  const perf = perfFee * Math.max(profitAfterMgmt, 0);
  const endAum = startAum + profitBefore - mgmt - perf;
  return { endAum, mgmt, perf, profitBefore };
}

export function simulateLoanInFine(params: SimulateLoanParams): SimulationResult<LoanSummary> {
  const {
    scenario,
    yearsChoice,
    principal,
    termYears,
    coupon,
    wU,
    wE,
    wB,
    overrides,
    returnsAreNetOfMev,
    mevMgmt,
    mevPerf,
    custodyFee,
    upfrontCosts,
    annualOpex,
    annualSalaries,
    reserveEnabled,
    reserveShare,
    reserveYield,
    diversEnabled,
    diversShare,
    diversYield,
    useDiversForRepayment,
  } = params;

  const { rp, dbg } = portfolioReturnCagrScenario({ scenario, yearsChoice, wU, wE, wB, overrides });

  let aum = Math.max(principal - upfrontCosts, 0);
  let reserve = 0;
  let diversification = 0;
  let totalInteretsPayes = 0;
  const rows: SimulationRow[] = [];

  for (let y = 1; y <= termYears; y++) {
    const aumDepart = aum;

    let aumFinStrategie;
    let profitAvantFees;
    let feesMEV_Mgmt = 0;
    let feesMEV_Perf = 0;

    if (returnsAreNetOfMev) {
      profitAvantFees = aumDepart * rp;
      aumFinStrategie = aumDepart * (1 + rp);
    } else {
      const f = applyMevFees(aumDepart, rp, mevMgmt, mevPerf);
      aumFinStrategie = f.endAum;
      profitAvantFees = f.profitBefore;
      feesMEV_Mgmt = f.mgmt;
      feesMEV_Perf = f.perf;
    }

    const fraisCustody = custodyFee * aumDepart;
    const aumApresCustody = aumFinStrategie - fraisCustody;
    const interets = principal * coupon;
    totalInteretsPayes += interets;
    const opexSalaires = annualOpex + annualSalaries;

    let aumApresCouts = aumApresCustody - interets - opexSalaires;
    const surplus = Math.max(aumApresCouts - aumDepart, 0);

    const rs = reserveEnabled ? clamp(reserveShare, 0, 1) : 0;
    const ds = diversEnabled ? clamp(diversShare, 0, 1) : 0;

    let rsAdj = rs;
    let dsAdj = ds;
    if (rsAdj + dsAdj > 1) {
      const t = rsAdj + dsAdj;
      rsAdj /= t;
      dsAdj /= t;
    }

    const reserveContribution = surplus > 0 ? rsAdj * surplus : 0;
    const diversContribution = surplus > 0 ? dsAdj * surplus : 0;

    aumApresCouts -= reserveContribution + diversContribution;
    reserve = reserve * (1 + reserveYield) + reserveContribution;
    diversification = diversification * (1 + diversYield) + diversContribution;
    aum = aumApresCouts;

    const conserveTotal = Math.max(aum - aumDepart, 0) + reserveContribution + diversContribution;

    rows.push({
      annee: y,
      aumDepart,
      rendementPortefeuille: rp,
      profitAvantFees,
      feesMEV_Mgmt,
      feesMEV_Perf,
      fraisCustody,
      interets,
      interetsCumul: totalInteretsPayes,
      opexSalaires,
      aumApresCouts,
      surplus,
      reserveDepart: y === 1 ? 0 : rows[y - 2].reserveFin,
      reserveContribution,
      reserveFin: reserve,
      diversDepart: y === 1 ? 0 : rows[y - 2].diversFin,
      diversContribution,
      diversFin: diversification,
      aumFin: aum,
      paiementPreteurAnnuel: interets,
      conserveTotal,
    });
  }

  let restant = principal;
  const rembourseParReserve = Math.min(reserve, restant);
  restant -= rembourseParReserve;
  reserve -= rembourseParReserve;

  let rembourseParDivers = 0;
  if (useDiversForRepayment) {
    rembourseParDivers = Math.min(diversification, restant);
    restant -= rembourseParDivers;
    diversification -= rembourseParDivers;
  }

  const rembourseParAum = Math.min(Math.max(aum, 0), restant);
  restant -= rembourseParAum;
  aum -= rembourseParAum;
  const principalNonRembourse = restant;
  const principalRembourse = principal - principalNonRembourse;
  const totalPaye = totalInteretsPayes + principalRembourse;
  const capitalContinuite = aum + diversification;

  return {
    mode: "Prêt in fine",
    scenario,
    rp,
    dbg,
    rows,
    summary: {
      scenario,
      rendementPortefeuille: rp,
      principal,
      duree: termYears,
      tauxInteret: coupon,
      coutsInitiaux: upfrontCosts,
      aumT0: Math.max(principal - upfrontCosts, 0),
      totalInteretsPayes,
      principalRembourse,
      totalPaye,
      principalNonRembourse,
      reserveApresRemb: reserve,
      diversificationApresRemb: diversification,
      aumApresRemb: aum,
      capitalContinuite,
      rembourseParReserve,
      rembourseParDivers,
      rembourseParAum,
    },
  };
}

export function simulateInvestmentProfitShare(
  params: SimulateInvestmentParams
): SimulationResult<InvestmentSummary> {
  const {
    scenario,
    yearsChoice,
    capitalInvesti,
    termYears,
    wU,
    wE,
    wB,
    overrides,
    mevMgmt,
    mevPerf,
    custodyFee,
    annualOpex,
    annualSalaries,
    splitInvestisseur,
    splitEntite,
    distribution: distributionMode,
  } = params;

  const { rp, dbg } = portfolioReturnCagrScenario({ scenario, yearsChoice, wU, wE, wB, overrides });

  let aum = Math.max(capitalInvesti, 0);
  let totalDistribInvest = 0;
  let totalDistribEntite = 0;
  const rows: SimulationRow[] = [];

  for (let y = 1; y <= termYears; y++) {
    const aumDepart = aum;
    const profitBrut = aumDepart * rp;
    const feesMEV_Mgmt = mevMgmt * aumDepart;
    const profitApresMgmt = profitBrut - feesMEV_Mgmt;
    const feesMEV_Perf = mevPerf * Math.max(profitApresMgmt, 0);
    const fraisCustody = custodyFee * aumDepart;
    const opexSalaires = annualOpex + annualSalaries;
    const profitNet = profitBrut - feesMEV_Mgmt - feesMEV_Perf - fraisCustody - opexSalaires;

    aum = aumDepart + profitNet;
    let distribInvest = 0;
    let distribEntite = 0;

    if (distributionMode === "Annuel" && profitNet > 0) {
      distribInvest = profitNet * splitInvestisseur;
      distribEntite = profitNet * splitEntite;
      totalDistribInvest += distribInvest;
      totalDistribEntite += distribEntite;
      aum = aum - (distribInvest + distribEntite);
    }

    rows.push({
      annee: y,
      aumDepart,
      rendementPortefeuille: rp,
      profitBrut,
      feesMEV_Mgmt,
      feesMEV_Perf,
      fraisCustody,
      opexSalaires,
      profitNet,
      distribInvest,
      distribEntite,
      aumFin: aum,
    });
  }

  const aumAvantDistribFinale = aum;
  const profitTotalNet = aumAvantDistribFinale - capitalInvesti + totalDistribInvest + totalDistribEntite;
  let distribFinalInvest = 0;
  let distribFinalEntite = 0;
  let aumApresDistribFinale = aumAvantDistribFinale;

  if (distributionMode === "Fin" && profitTotalNet > 0) {
    distribFinalInvest = profitTotalNet * splitInvestisseur;
    distribFinalEntite = profitTotalNet * splitEntite;
    totalDistribInvest += distribFinalInvest;
    totalDistribEntite += distribFinalEntite;
    aumApresDistribFinale = aumAvantDistribFinale - (distribFinalInvest + distribFinalEntite);
  }

  return {
    mode: "Investissement",
    scenario,
    rp,
    dbg,
    rows,
    summary: {
      scenario,
      rendementPortefeuille: rp,
      capitalInvesti,
      duree: termYears,
      feesMEV_Mgmt: mevMgmt,
      feesMEV_Perf: mevPerf,
      splitInvestisseur,
      splitEntite,
      distribution: distributionMode,
      aumAvantDistribFinale,
      aumApresDistribFinale,
      profitTotalNet,
      totalDistribInvest,
      totalDistribEntite,
      distribFinalInvest,
      distribFinalEntite,
    },
  };
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

export function runSelfTests() {
  try {
    const r = [0.1, 0.1];
    const c = cagrFromAnnualReturns(r);
    if (c === null || Math.abs(c - 0.1) > 1e-9) throw new Error("Self-test CAGR échoué");

    const nw = normalizeWeights(0.5, 0.25, 0.25);
    if (Math.abs(nw.wU + nw.wE + nw.wB - 1) > 1e-9) throw new Error("Self-test weights somme != 1");

    const nw2 = normalizeWeights(0.6, 0.6, 0.0);
    if (Math.abs(nw2.wU + nw2.wE + nw2.wB - 1) > 1e-9) throw new Error("Self-test weights normalisation échoué");

    const overrides = { enabled: false, byScenario: {} };

    const loan = simulateLoanInFine({
      scenario: "Réaliste",
      yearsChoice: [2022, 2023, 2024, 2025],
      principal: 1_000_000,
      termYears: 3,
      coupon: 0.08,
      wU: 0.5,
      wE: 0.25,
      wB: 0.25,
      overrides,
      returnsAreNetOfMev: true,
      mevMgmt: 0.02,
      mevPerf: 0.2,
      custodyFee: 0.004,
      upfrontCosts: 10_000,
      annualOpex: 20_000,
      annualSalaries: 0,
      reserveEnabled: true,
      reserveShare: 0.8,
      reserveYield: 0.04,
      diversEnabled: true,
      diversShare: 0.1,
      diversYield: 0.02,
      useDiversForRepayment: false,
    });
    if (!loan.rows || loan.rows.length !== 3) throw new Error("Self-test prêt in fine lignes");
    if (Math.abs((loan.rows[0].interets ?? 0) - 80_000) > 1e-6)
      throw new Error("Self-test intérêts prêt in fine");

    const invFin = simulateInvestmentProfitShare({
      scenario: "Réaliste",
      yearsChoice: [2022, 2023, 2024, 2025],
      capitalInvesti: 1_000_000,
      termYears: 2,
      wU: 0.5,
      wE: 0.25,
      wB: 0.25,
      overrides,
      mevMgmt: 0.02,
      mevPerf: 0.2,
      custodyFee: 0.0,
      annualOpex: 0,
      annualSalaries: 0,
      splitInvestisseur: 0.6,
      splitEntite: 0.4,
      distribution: "Fin",
    });
    if (invFin.summary.aumApresDistribFinale > invFin.summary.aumAvantDistribFinale + 1e-6)
      throw new Error("Self-test distrib fin incohérent");

    if (Math.abs(invFin.summary.splitInvestisseur + invFin.summary.splitEntite - 1) > 1e-9)
      throw new Error("Self-test split somme != 1");

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
