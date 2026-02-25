import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// =====================================================
// TRACK RECORD (tes screenshots)
// Rendements annuels (APY) en décimal.
// Par défaut, on considère que ces rendements sont NETS des fees MEV.
// =====================================================
const TRACK = {
  USDC: {
    label: "Stablecoin (USD) Yield",
    apyByYear: {
      2020: 0.1821, // partiel
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
      2022: 0.2163, // partiel
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
function fmtPct(x, digits = 2) {
  if (!isFinite(x) || x == null) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtUsd(x, digits = 0) {
  if (!isFinite(x) || x == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(x);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeNumber(n, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

function normalizeWeights(wU, wE, wB) {
  const s = safeNumber(wU) + safeNumber(wE) + safeNumber(wB);
  if (s <= 0) return { wU: 0.5, wE: 0.25, wB: 0.25, sumIn: s, normalized: true };
  return { wU: wU / s, wE: wE / s, wB: wB / s, sumIn: s, normalized: Math.abs(s - 1) > 1e-9 };
}

// =====================================================
// Stats + CAGR
// =====================================================
function pickEntriesForYears(apyByYear, yearsChoice) {
  const entries = Object.entries(apyByYear)
    .map(([y, r]) => [Number(y), Number(r)])
    .sort((a, b) => a[0] - b[0]);

  let filtered = yearsChoice?.length
    ? entries.filter(([y]) => yearsChoice.includes(y))
    : entries;

  // Fallback si aucune donnée sur les années sélectionnées
  if (!filtered.length) filtered = entries;

  return filtered; // [[year, r], ...]
}

function cagrFromAnnualReturns(returns) {
  // CAGR = (Π(1+r))^(1/n) - 1
  if (!returns.length) return null;
  const product = returns.reduce((p, r) => p * (1 + r), 1);
  return Math.pow(product, 1 / returns.length) - 1;
}

function meanArithmetic(returns) {
  if (!returns.length) return null;
  return returns.reduce((s, v) => s + v, 0) / returns.length;
}

function minMax(returns) {
  if (!returns.length) return { min: null, max: null };
  return { min: Math.min(...returns), max: Math.max(...returns) };
}

function scenarioSplitEntries(entries, scenario) {
  // entries: [[year, r], ...]
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  const k = Math.max(1, Math.ceil(n / 2));
  if (scenario === "Réaliste") return sorted;
  if (scenario === "Pessimiste") return sorted.slice(0, k);
  if (scenario === "Optimiste") return sorted.slice(n - k);
  throw new Error("Scénario inconnu");
}

function computeScenarioCagrFromTrack(assetKey, scenario, yearsChoice) {
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

function portfolioReturnCagrScenario({ scenario, yearsChoice, wU, wE, wB, overrides }) {
  // overrides: { enabled: boolean, byScenario: { [scenario]: { USDC, ETH, BTC } } }
  const ovEnabled = !!overrides?.enabled;
  const ov = overrides?.byScenario?.[scenario];

  const dU = computeScenarioCagrFromTrack("USDC", scenario, yearsChoice);
  const dE = computeScenarioCagrFromTrack("ETH", scenario, yearsChoice);
  const dB = computeScenarioCagrFromTrack("BTC", scenario, yearsChoice);

  const cU = ovEnabled && ov?.USDC != null ? ov.USDC : dU.cagr;
  const cE = ovEnabled && ov?.ETH != null ? ov.ETH : dE.cagr;
  const cB = ovEnabled && ov?.BTC != null ? ov.BTC : dB.cagr;

  const rp = wU * cU + wE * cE + wB * cB;

  return {
    rp,
    dbg: {
      USDC: { ...dU, cagrScenario: cU, source: ovEnabled && ov?.USDC != null ? "manuel" : "track" },
      ETH: { ...dE, cagrScenario: cE, source: ovEnabled && ov?.ETH != null ? "manuel" : "track" },
      BTC: { ...dB, cagrScenario: cB, source: ovEnabled && ov?.BTC != null ? "manuel" : "track" },
    },
  };
}

// =====================================================
// Fees MEV (si tu considères les rendements BRUTS)
// IMPORTANT : modèle simplifié (pas de high-water mark).
// =====================================================
function applyMevFees(startAum, grossReturn, mgmtFee, perfFee) {
  const mgmt = mgmtFee * startAum;
  const profitBefore = grossReturn * startAum;
  const profitAfterMgmt = profitBefore - mgmt;
  const perf = perfFee * Math.max(profitAfterMgmt, 0);
  const endAum = startAum + profitBefore - mgmt - perf;
  return { endAum, mgmt, perf, profitBefore };
}

// =====================================================
// MODE 1 — PRÊT IN FINE
// Modèle annuel, intérêt-only, remboursement bullet à maturité.
// Poches : réserve (remboursement) + diversification.
// =====================================================
function simulateLoanInFine({
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
}) {
  const { rp, dbg } = portfolioReturnCagrScenario({ scenario, yearsChoice, wU, wE, wB, overrides });

  let aum = Math.max(principal - upfrontCosts, 0);
  let reserve = 0;
  let diversification = 0;

  let totalInteretsPayes = 0;

  const rows = [];

  for (let y = 1; y <= termYears; y++) {
    const aumDepart = aum;
    const reserveDepart = reserve;
    const diversDepart = diversification;

    // 1) Performance
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

    // 2) Custody
    const fraisCustody = custodyFee * aumDepart;
    const aumApresCustody = aumFinStrategie - fraisCustody;

    // 3) Service de la dette (intérêts) + OPEX
    const interets = principal * coupon; // intérêt-only
    totalInteretsPayes += interets;
    const opexSalaires = annualOpex + annualSalaries;

    let aumApresCouts = aumApresCustody - interets - opexSalaires;

    // 4) Surplus net (si et seulement si l'année est globalement positive après coûts)
    // Surplus = augmentation nette d'AUM après coûts vs AUM départ.
    const surplus = Math.max(aumApresCouts - aumDepart, 0);

    // 5) Allocation du surplus
    const rs = reserveEnabled ? clamp(reserveShare, 0, 1) : 0;
    const ds = diversEnabled ? clamp(diversShare, 0, 1) : 0;

    // Si rs+ds>1, renormalise.
    let rsAdj = rs;
    let dsAdj = ds;
    if (rsAdj + dsAdj > 1) {
      const t = rsAdj + dsAdj;
      rsAdj /= t;
      dsAdj /= t;
    }

    const reserveContribution = surplus > 0 ? rsAdj * surplus : 0;
    const diversContribution = surplus > 0 ? dsAdj * surplus : 0;

    // On retire les contributions de l'AUM principal (car elles vont dans les poches)
    aumApresCouts -= (reserveContribution + diversContribution);

    // 6) Croissance des poches
    reserve = reserve * (1 + reserveYield) + reserveContribution;
    diversification = diversification * (1 + diversYield) + diversContribution;

    // 7) AUM principal réinvesti
    aum = aumApresCouts;

    // 8) Ce que tu "gardes" cette année = ce qui reste dans l'AUM principal + ce qui est versé dans les poches
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
      reserveDepart,
      reserveContribution,
      reserveFin: reserve,
      diversDepart,
      diversContribution,
      diversFin: diversification,
      aumFin: aum,
      paiementPreteurAnnuel: interets,
      conserveTotal,
    });
  }

  // Remboursement bullet à maturité
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

  // Total payé au prêteur : intérêts annuels + principal remboursé à la fin
  const principalRembourse = principal - principalNonRembourse;
  const totalPaye = totalInteretsPayes + principalRembourse;

  // Capital de continuité = AUM restant + diversification restante
  // (la réserve restante est assimilable à un buffer de sûreté)
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

// =====================================================
// MODE 2 — INVESTISSEMENT (partage des bénéfices)
// - Investisseur apporte un capital (pas une dette)
// - MEV prend mgmt + perf (paramétrables)
// - Après ces coûts, on partage le profit NET : split invest / split entité.
// - Distribution annuelle OU à maturité.
// IMPORTANT : la distribution "Fin" distribue les profits, pas le capital (par défaut).
// =====================================================
function simulateInvestmentProfitShare({
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
  distribution: distributionMode, // "Annuel" | "Fin"
}) {
  const { rp, dbg } = portfolioReturnCagrScenario({ scenario, yearsChoice, wU, wE, wB, overrides });

  let aum = Math.max(capitalInvesti, 0);

  let totalDistribInvest = 0;
  let totalDistribEntite = 0;

  const rows = [];

  for (let y = 1; y <= termYears; y++) {
    const aumDepart = aum;

    const profitBrut = aumDepart * rp;

    const feesMEV_Mgmt = mevMgmt * aumDepart;
    const profitApresMgmt = profitBrut - feesMEV_Mgmt;
    const feesMEV_Perf = mevPerf * Math.max(profitApresMgmt, 0);

    const fraisCustody = custodyFee * aumDepart;
    const opexSalaires = annualOpex + annualSalaries;

    const profitNet = profitBrut - feesMEV_Mgmt - feesMEV_Perf - fraisCustody - opexSalaires;

    // Capitalisation
    aum = aumDepart + profitNet;

    let distribInvest = 0;
    let distribEntite = 0;

    // Distribution annuelle des profits nets positifs
    if (distributionMode === "Annuel" && profitNet > 0) {
      distribInvest = profitNet * splitInvestisseur;
      distribEntite = profitNet * splitEntite;
      totalDistribInvest += distribInvest;
      totalDistribEntite += distribEntite;
      // retrait de l'AUM (cash-out)
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

  // Profit net total réellement créé (incluant les distributions déjà versées)
  const profitTotalNet = (aumAvantDistribFinale - capitalInvesti) + totalDistribInvest + totalDistribEntite;

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

// =====================================================
// Export CSV
// =====================================================
function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
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

function download(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function BadgeOk({ ok, okLabel = "OK", failLabel = "ÉCHEC" }) {
  return ok ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">{okLabel}</Badge>
  ) : (
    <Badge variant="destructive">{failLabel}</Badge>
  );
}

// =====================================================
// Self-tests (preview/dev)
// Objectif : éviter erreurs de calcul silencieuses.
// =====================================================
function runSelfTests() {
  try {
    // 1) CAGR
    const r = [0.1, 0.1];
    const c = cagrFromAnnualReturns(r);
    if (Math.abs(c - 0.1) > 1e-9) throw new Error("Self-test CAGR échoué");

    // 2) Normalisation weights
    const nw = normalizeWeights(0.5, 0.25, 0.25);
    if (Math.abs(nw.wU + nw.wE + nw.wB - 1) > 1e-9) throw new Error("Self-test weights somme != 1");

    const nw2 = normalizeWeights(0.6, 0.6, 0.0);
    if (Math.abs(nw2.wU + nw2.wE + nw2.wB - 1) > 1e-9) throw new Error("Self-test weights normalisation échoué");

    const overrides = { enabled: false, byScenario: {} };

    // 3) Prêt in fine : intérêt-only constant
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
    if (Math.abs(loan.rows[0].interets - 80_000) > 1e-6) throw new Error("Self-test intérêts prêt in fine");

    // 4) Investissement : distribution FIN retire bien l'argent
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
    if (invFin.summary.aumApresDistribFinale > invFin.summary.aumAvantDistribFinale + 1e-6) throw new Error("Self-test distrib fin incohérent");

    // 5) Investissement : split somme 1
    if (Math.abs(invFin.summary.splitInvestisseur + invFin.summary.splitEntite - 1) > 1e-9) throw new Error("Self-test split somme != 1");

    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return false;
  }
}

export default function App() {
  useMemo(() => {
    if (typeof window !== "undefined") runSelfTests();
    return null;
  }, []);

  const allYears = useMemo(() => {
    const s = new Set();
    Object.values(TRACK).forEach((a) =>
      Object.keys(a.apyByYear).forEach((y) => s.add(Number(y)))
    );
    return Array.from(s).sort((a, b) => a - b);
  }, []);

  // =========================
  // UI State
  // =========================
  const [mode, setMode] = useState("Pret"); // "Pret" | "Invest"

  const [yearsChoice, setYearsChoice] = useState(
    [2022, 2023, 2024, 2025].filter((y) => allYears.includes(y))
  );

  // Inputs weights (non normalisés), normalisation automatique dans les calculs.
  const [wUIn, setWUIn] = useState(0.5);
  const [wEIn, setWEIn] = useState(0.25);
  const [wBIn, setWBIn] = useState(0.25);
  const weights = useMemo(() => normalizeWeights(wUIn, wEIn, wBIn), [wUIn, wEIn, wBIn]);

  // Commun
  const [termYears, setTermYears] = useState(8);
  const [custodyFee, setCustodyFee] = useState(0.004);
  const [annualOpex, setAnnualOpex] = useState(120_000);
  const [annualSalaries, setAnnualSalaries] = useState(192_000);

  // Overrides scenario returns
  const scenarioNames = ["Pessimiste", "Réaliste", "Optimiste"];
  const [useOverrides, setUseOverrides] = useState(false);
  const [overridesByScenario, setOverridesByScenario] = useState({
    Pessimiste: { USDC: null, ETH: null, BTC: null },
    Réaliste: { USDC: null, ETH: null, BTC: null },
    Optimiste: { USDC: null, ETH: null, BTC: null },
  });

  // Prêt in fine
  const [principal, setPrincipal] = useState(10_000_000);
  const [coupon, setCoupon] = useState(0.08);
  const [upfrontCosts, setUpfrontCosts] = useState(50_000);
  const [returnsNetOfMev, setReturnsNetOfMev] = useState(true);
  const [mevMgmtLoan, setMevMgmtLoan] = useState(0.02);
  const [mevPerfLoan, setMevPerfLoan] = useState(0.2);

  const [reserveEnabled, setReserveEnabled] = useState(true);
  const [reserveShare, setReserveShare] = useState(0.8);
  const [reserveYield, setReserveYield] = useState(0.04);

  const [diversEnabled, setDiversEnabled] = useState(true);
  const [diversShare, setDiversShare] = useState(0.1);
  const [diversYield, setDiversYield] = useState(0.02);
  const [useDiversForRepayment, setUseDiversForRepayment] = useState(false);

  // Investissement
  const [capitalInvesti, setCapitalInvesti] = useState(10_000_000);
  const [mevMgmtInv, setMevMgmtInv] = useState(0.02);
  const [mevPerfInv, setMevPerfInv] = useState(0.2);
  const [splitInvestisseur, setSplitInvestisseur] = useState(0.6);
  const splitEntite = 1 - splitInvestisseur;
  const [distribution, setDistribution] = useState("Annuel"); // "Annuel" | "Fin"

  const overrides = useMemo(
    () => ({ enabled: useOverrides, byScenario: overridesByScenario }),
    [useOverrides, overridesByScenario]
  );

  const yearsToggle = (y) => {
    setYearsChoice((prev) =>
      prev.includes(y)
        ? prev.filter((v) => v !== y)
        : [...prev, y].sort((a, b) => a - b)
    );
  };

  const resetWeights = () => {
    setWUIn(0.5);
    setWEIn(0.25);
    setWBIn(0.25);
  };

  const setOverride = (scenario, asset, valuePct) => {
    const v = valuePct === "" ? null : Number(valuePct) / 100;
    setOverridesByScenario((prev) => ({
      ...prev,
      [scenario]: { ...prev[scenario], [asset]: Number.isFinite(v) ? v : null },
    }));
  };

  // =========================
  // Run scenarios
  // =========================
  const scenarios = useMemo(() => {
    const wU = weights.wU;
    const wE = weights.wE;
    const wB = weights.wB;

    if (mode === "Pret") {
      return scenarioNames.map((scenario) =>
        simulateLoanInFine({
          scenario,
          yearsChoice,
          principal,
          termYears,
          coupon,
          wU,
          wE,
          wB,
          overrides,
          returnsAreNetOfMev: returnsNetOfMev,
          mevMgmt: mevMgmtLoan,
          mevPerf: mevPerfLoan,
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
        })
      );
    }

    return scenarioNames.map((scenario) =>
      simulateInvestmentProfitShare({
        scenario,
        yearsChoice,
        capitalInvesti,
        termYears,
        wU,
        wE,
        wB,
        overrides,
        mevMgmt: mevMgmtInv,
        mevPerf: mevPerfInv,
        custodyFee,
        annualOpex,
        annualSalaries,
        splitInvestisseur,
        splitEntite,
        distribution,
      })
    );
  }, [
    mode,
    yearsChoice,
    principal,
    termYears,
    coupon,
    weights,
    overrides,
    returnsNetOfMev,
    mevMgmtLoan,
    mevPerfLoan,
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
    capitalInvesti,
    mevMgmtInv,
    mevPerfInv,
    splitInvestisseur,
    splitEntite,
    distribution,
  ]);

  const okAll = useMemo(() => {
    if (mode !== "Pret") return true;
    return scenarios.every((s) => Math.abs(s.summary.principalNonRembourse) < 1e-6);
  }, [mode, scenarios]);

  const pessimisticChart = scenarios[0].rows.map((r) => ({
    annee: r.annee,
    aumFin: Math.max(r.aumFin ?? 0, 0),
    reserveFin: Math.max(r.reserveFin ?? 0, 0),
    diversFin: Math.max(r.diversFin ?? 0, 0),
  }));

  const exportCsvPack = () => {
    const sumRows = scenarios.map((s) => {
      if (mode === "Pret") {
        return {
          Mode: s.mode,
          Scenario: s.summary.scenario,
          Rendement_Portefeuille_CAGR: s.summary.rendementPortefeuille,
          Principal: s.summary.principal,
          Duree: s.summary.duree,
          Taux_Interet: s.summary.tauxInteret,
          Total_Interets_Payes: s.summary.totalInteretsPayes,
          Principal_Rembourse: s.summary.principalRembourse,
          Total_Paye: s.summary.totalPaye,
          Principal_Non_Rembourse: s.summary.principalNonRembourse,
          AUM_Apres_Remb: s.summary.aumApresRemb,
          Divers_Apres_Remb: s.summary.diversificationApresRemb,
          Reserve_Apres_Remb: s.summary.reserveApresRemb,
          Capital_Continuite: s.summary.capitalContinuite,
        };
      }

      return {
        Mode: s.mode,
        Scenario: s.summary.scenario,
        Rendement_Portefeuille_CAGR: s.summary.rendementPortefeuille,
        Capital_Investi: s.summary.capitalInvesti,
        Duree: s.summary.duree,
        Fee_Mgmt: s.summary.feesMEV_Mgmt,
        Fee_Perf: s.summary.feesMEV_Perf,
        Split_Investisseur: s.summary.splitInvestisseur,
        Split_Entite: s.summary.splitEntite,
        Distribution: s.summary.distribution,
        AUM_Avant_Distrib_Finale: s.summary.aumAvantDistribFinale,
        AUM_Apres_Distrib_Finale: s.summary.aumApresDistribFinale,
        Profit_Total_Net: s.summary.profitTotalNet,
        Total_Distrib_Invest: s.summary.totalDistribInvest,
        Total_Distrib_Entite: s.summary.totalDistribEntite,
      };
    });

    download("resume_scenarios.csv", toCsv(sumRows), "text/csv");
    scenarios.forEach((s) => {
      download(
        `cashflows_${s.scenario.toLowerCase().replaceAll("é", "e").replaceAll("à", "a")}_${mode}.csv`,
        toCsv(s.rows),
        "text/csv"
      );
    });
  };

  // Debug: on rend la transparence par scénario
  const debugByScenario = useMemo(() => {
    const out = {};
    scenarios.forEach((s) => {
      out[s.scenario] = s.dbg;
    });
    return out;
  }, [scenarios]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Simulateur institutionnel — scénarios (CAGR) + cashflows complets
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Français • Normalisation automatique des pondérations • Prêt in fine OU investissement profit share
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Imprimer en PDF
            </Button>
            <Button onClick={exportCsvPack}>Télécharger pack CSV</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* INPUTS */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Paramètres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="font-medium">Mode de calcul</Label>
                <div className="flex gap-2">
                  <Button
                    variant={mode === "Pret" ? "default" : "outline"}
                    onClick={() => setMode("Pret")}
                  >
                    Prêt in fine
                  </Button>
                  <Button
                    variant={mode === "Invest" ? "default" : "outline"}
                    onClick={() => setMode("Invest")}
                  >
                    Investissement (profit share)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Années utilisées (track record)</Label>
                  <Badge variant="outline">CAGR</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allYears.map((y) => (
                    <Button
                      key={y}
                      size="sm"
                      variant={yearsChoice.includes(y) ? "default" : "outline"}
                      onClick={() => yearsToggle(y)}
                    >
                      {y}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-slate-600">
                  Réaliste = toutes les années • Pessimiste = pire moitié • Optimiste = meilleure moitié (par asset).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Allocation (entrée)</Label>
                  <Button size="sm" variant="outline" onClick={resetWeights}>
                    Reset 50/25/25
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">USDC</Label>
                    <Input
                      type="number"
                      value={wUIn}
                      step="0.01"
                      onChange={(e) => setWUIn(clamp(Number(e.target.value), 0, 10))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">ETH</Label>
                    <Input
                      type="number"
                      value={wEIn}
                      step="0.01"
                      onChange={(e) => setWEIn(clamp(Number(e.target.value), 0, 10))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">BTC</Label>
                    <Input
                      type="number"
                      value={wBIn}
                      step="0.01"
                      onChange={(e) => setWBIn(clamp(Number(e.target.value), 0, 10))}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Allocation utilisée (normalisée)</div>
                    <Badge variant="outline">Somme entrée: {weights.sumIn.toFixed(2)}</Badge>
                  </div>
                  <div className="text-sm tabular-nums">
                    USDC {fmtPct(weights.wU, 2)} • ETH {fmtPct(weights.wE, 2)} • BTC {fmtPct(weights.wB, 2)}
                  </div>
                  {weights.normalized && (
                    <div className="text-xs text-amber-700">
                      Les poids ont été normalisés automatiquement pour que la somme = 100%.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Paramètres communs</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Durée (années)</Label>
                    <Input
                      type="number"
                      value={termYears}
                      step="1"
                      onChange={(e) => setTermYears(clamp(Number(e.target.value), 0, 30))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Frais custody (annuel % AUM)</Label>
                    <Input
                      type="number"
                      value={custodyFee}
                      step="0.0005"
                      onChange={(e) => setCustodyFee(clamp(Number(e.target.value), 0, 0.05))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">OPEX fixe annuel</Label>
                    <Input
                      type="number"
                      value={annualOpex}
                      step="10000"
                      onChange={(e) => setAnnualOpex(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Salaires annuels (2 pers.)</Label>
                    <Input
                      type="number"
                      value={annualSalaries}
                      step="12000"
                      onChange={(e) => setAnnualSalaries(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                </div>
              </div>

              {/* Overrides */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Rendements scénarios personnalisés</Label>
                  <Switch checked={useOverrides} onCheckedChange={setUseOverrides} />
                </div>
                <p className="text-xs text-slate-600">
                  Active pour surcharger les CAGR par scénario et par asset (en %). Laisse vide pour utiliser le track record.
                </p>

                {useOverrides && (
                  <div className="space-y-3 rounded-lg border bg-white p-3">
                    {scenarioNames.map((sc) => (
                      <div key={sc} className="space-y-2">
                        <div className="text-sm font-medium">{sc}</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[11px]">USDC (CAGR %)</Label>
                            <Input
                              value={overridesByScenario[sc].USDC == null ? "" : (overridesByScenario[sc].USDC * 100).toFixed(2)}
                              onChange={(e) => setOverride(sc, "USDC", e.target.value)}
                              placeholder="auto"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">ETH (CAGR %)</Label>
                            <Input
                              value={overridesByScenario[sc].ETH == null ? "" : (overridesByScenario[sc].ETH * 100).toFixed(2)}
                              onChange={(e) => setOverride(sc, "ETH", e.target.value)}
                              placeholder="auto"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">BTC (CAGR %)</Label>
                            <Input
                              value={overridesByScenario[sc].BTC == null ? "" : (overridesByScenario[sc].BTC * 100).toFixed(2)}
                              onChange={(e) => setOverride(sc, "BTC", e.target.value)}
                              placeholder="auto"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MODE PRET */}
              {mode === "Pret" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-medium">Prêt in fine</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Principal (USD)</Label>
                        <Input
                          type="number"
                          value={principal}
                          step="250000"
                          onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Coûts initiaux (t0)</Label>
                        <Input
                          type="number"
                          value={upfrontCosts}
                          step="5000"
                          onChange={(e) => setUpfrontCosts(Math.max(0, Number(e.target.value)))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Taux d'intérêt annuel (coupon)</Label>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[coupon]}
                          min={0}
                          max={0.2}
                          step={0.0025}
                          onValueChange={(v) => setCoupon(v[0])}
                        />
                        <div className="w-20 text-right text-sm tabular-nums">
                          {fmtPct(coupon)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
                      <div>
                        <div className="text-sm font-medium">Rendements déjà NETS des fees MEV</div>
                        <div className="text-xs text-slate-600">
                          Si désactivé, application 2% mgmt + 20% perf (modèle simplifié, sans HWM).
                        </div>
                      </div>
                      <Switch checked={returnsNetOfMev} onCheckedChange={setReturnsNetOfMev} />
                    </div>

                    <div className={`grid grid-cols-2 gap-3 ${returnsNetOfMev ? "opacity-50 pointer-events-none" : ""}`}>
                      <div className="space-y-2">
                        <Label className="text-xs">MEV mgmt fee</Label>
                        <Input
                          type="number"
                          value={mevMgmtLoan}
                          step="0.0025"
                          onChange={(e) => setMevMgmtLoan(clamp(Number(e.target.value), 0, 0.2))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">MEV perf fee</Label>
                        <Input
                          type="number"
                          value={mevPerfLoan}
                          step="0.01"
                          onChange={(e) => setMevPerfLoan(clamp(Number(e.target.value), 0, 0.8))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Réserve de remboursement (sinking fund)</Label>
                      <Switch checked={reserveEnabled} onCheckedChange={setReserveEnabled} />
                    </div>
                    <div className={`${reserveEnabled ? "" : "opacity-50 pointer-events-none"} space-y-3`}>
                      <div className="space-y-2">
                        <Label className="text-xs">Part du surplus vers réserve</Label>
                        <div className="flex items-center gap-3">
                          <Slider value={[reserveShare]} min={0} max={1} step={0.05} onValueChange={(v) => setReserveShare(v[0])} />
                          <div className="w-20 text-right text-sm tabular-nums">{fmtPct(reserveShare)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Rendement annuel de la réserve</Label>
                        <div className="flex items-center gap-3">
                          <Slider value={[reserveYield]} min={0} max={0.1} step={0.0025} onValueChange={(v) => setReserveYield(v[0])} />
                          <div className="w-20 text-right text-sm tabular-nums">{fmtPct(reserveYield)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Poche diversification</Label>
                      <Switch checked={diversEnabled} onCheckedChange={setDiversEnabled} />
                    </div>
                    <div className={`${diversEnabled ? "" : "opacity-50 pointer-events-none"} space-y-3`}>
                      <div className="space-y-2">
                        <Label className="text-xs">Part du surplus vers diversification</Label>
                        <div className="flex items-center gap-3">
                          <Slider value={[diversShare]} min={0} max={1} step={0.05} onValueChange={(v) => setDiversShare(v[0])} />
                          <div className="w-20 text-right text-sm tabular-nums">{fmtPct(diversShare)}</div>
                        </div>
                        <p className="text-xs text-slate-600">Le reste du surplus reste dans l'AUM principal (réinvesti dans le même modèle).</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Rendement annuel diversification</Label>
                        <div className="flex items-center gap-3">
                          <Slider value={[diversYield]} min={0} max={0.15} step={0.0025} onValueChange={(v) => setDiversYield(v[0])} />
                          <div className="w-20 text-right text-sm tabular-nums">{fmtPct(diversYield)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-white">
                        <div>
                          <div className="text-sm font-medium">Utiliser la diversification pour rembourser le principal</div>
                          <div className="text-xs text-slate-600">Si OFF, la diversification est protégée et reste comme capital de continuité.</div>
                        </div>
                        <Switch checked={useDiversForRepayment} onCheckedChange={setUseDiversForRepayment} />
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    Le "Surplus" est la hausse nette d'AUM après coûts vs AUM départ (planché à 0). On n'alimente les poches que quand l'année est nette positive.
                  </div>
                </div>
              )}

              {/* MODE INVEST */}
              {mode === "Invest" && (
                <div className="space-y-4">
                  <Label className="font-medium">Investissement (profit share)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Capital investi (USD)</Label>
                      <Input
                        type="number"
                        value={capitalInvesti}
                        step="250000"
                        onChange={(e) => setCapitalInvesti(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Distribution</Label>
                      <div className="flex gap-2">
                        <Button variant={distribution === "Annuel" ? "default" : "outline"} onClick={() => setDistribution("Annuel")}>
                          Annuel
                        </Button>
                        <Button variant={distribution === "Fin" ? "default" : "outline"} onClick={() => setDistribution("Fin")}>
                          Fin
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">MEV mgmt fee</Label>
                      <Input type="number" value={mevMgmtInv} step="0.0025" onChange={(e) => setMevMgmtInv(clamp(Number(e.target.value), 0, 0.2))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">MEV perf fee</Label>
                      <Input type="number" value={mevPerfInv} step="0.01" onChange={(e) => setMevPerfInv(clamp(Number(e.target.value), 0, 0.8))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Split profit net — Investisseur / Votre entité</Label>
                    <div className="flex items-center gap-3">
                      <Slider value={[splitInvestisseur]} min={0} max={1} step={0.01} onValueChange={(v) => setSplitInvestisseur(v[0])} />
                      <div className="w-40 text-right text-sm tabular-nums">{fmtPct(splitInvestisseur)} / {fmtPct(splitEntite)}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    En mode "Fin", on distribue les profits (pas le capital) à la maturité. L'app affiche AUM avant ET après distribution finale.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OUTPUTS */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Résumé des scénarios</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {mode === "Pret" ? "Intérêts annuels + remboursement bullet + capital de continuité" : "Profit net + distributions"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeOk ok={okAll} okLabel="OK" failLabel="Risque" />
                  <Badge variant="outline">
                    {mode === "Pret" ? (okAll ? "Remboursement OK (3 scénarios)" : "Au moins un scénario ne rembourse pas") : "Investissement"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scénario</TableHead>
                      <TableHead>Rendement (CAGR)</TableHead>
                      {mode === "Pret" ? (
                        <>
                          <TableHead>Intérêts totaux</TableHead>
                          <TableHead>Principal remboursé</TableHead>
                          <TableHead>Non remboursé</TableHead>
                          <TableHead>Capital continuité</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Profit net total</TableHead>
                          <TableHead>Distrib. investisseur</TableHead>
                          <TableHead>Distrib. entité</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarios.map((s) => {
                      const sm = s.summary;
                      if (mode === "Pret") {
                        const ok = Math.abs(sm.principalNonRembourse) < 1e-6;
                        return (
                          <TableRow key={sm.scenario}>
                            <TableCell className="font-medium">{sm.scenario}</TableCell>
                            <TableCell>{fmtPct(sm.rendementPortefeuille)}</TableCell>
                            <TableCell>{fmtUsd(sm.totalInteretsPayes)}</TableCell>
                            <TableCell>{fmtUsd(sm.principalRembourse)}</TableCell>
                            <TableCell className={ok ? "text-emerald-700" : "text-rose-700"}>{fmtUsd(sm.principalNonRembourse)}</TableCell>
                            <TableCell>{fmtUsd(sm.capitalContinuite)}</TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={sm.scenario}>
                          <TableCell className="font-medium">{sm.scenario}</TableCell>
                          <TableCell>{fmtPct(sm.rendementPortefeuille)}</TableCell>
                          <TableCell>{fmtUsd(sm.profitTotalNet)}</TableCell>
                          <TableCell>{fmtUsd(sm.totalDistribInvest)}</TableCell>
                          <TableCell>{fmtUsd(sm.totalDistribEntite)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {mode === "Invest" && (
                  <div className="mt-3 text-xs text-slate-600">
                    Note : en mode "Fin", la ligne "Distrib." inclut la distribution finale. L'app conserve et affiche AUM avant et après distribution finale (voir détails annuels / export CSV).
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trajectoire (scénario Pessimiste)</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pessimisticChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="annee" />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                    <Tooltip formatter={(v) => fmtUsd(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="aumFin" name="AUM fin (réinvesti)" dot={false} />
                    {mode === "Pret" && (
                      <>
                        <Line type="monotone" dataKey="reserveFin" name="Réserve" dot={false} />
                        <Line type="monotone" dataKey="diversFin" name="Diversification" dot={false} />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Détail annuel — cashflows et allocations</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Prêt in fine : paiement prêteur annuel = intérêts. Remboursement du principal = à maturité (dans le résumé).
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="Pessimiste" className="w-full">
                  <TabsList>
                    <TabsTrigger value="Pessimiste">Pessimiste</TabsTrigger>
                    <TabsTrigger value="Réaliste">Réaliste</TabsTrigger>
                    <TabsTrigger value="Optimiste">Optimiste</TabsTrigger>
                  </TabsList>

                  {scenarioNames.map((name) => {
                    const s = scenarios.find((x) => x.scenario === name);
                    const rows = s?.rows ?? [];

                    const colsPret = [
                      ["annee", "Année"],
                      ["aumDepart", "AUM départ"],
                      ["profitAvantFees", "Profit"],
                      ["fraisCustody", "Custody"],
                      ["interets", "Intérêts"],
                      ["interetsCumul", "Intérêts cumul"],
                      ["opexSalaires", "OPEX+Sal"],
                      ["surplus", "Surplus"],
                      ["reserveContribution", "Vers réserve"],
                      ["reserveFin", "Réserve fin"],
                      ["diversContribution", "Vers divers"],
                      ["diversFin", "Divers fin"],
                      ["aumFin", "AUM fin"],
                      ["paiementPreteurAnnuel", "Paiement prêteur"],
                    ];

                    const colsInv = [
                      ["annee", "Année"],
                      ["aumDepart", "AUM départ"],
                      ["profitBrut", "Profit brut"],
                      ["feesMEV_Mgmt", "MEV mgmt"],
                      ["feesMEV_Perf", "MEV perf"],
                      ["fraisCustody", "Custody"],
                      ["opexSalaires", "OPEX+Sal"],
                      ["profitNet", "Profit net"],
                      ["distribInvest", "Distrib invest"],
                      ["distribEntite", "Distrib entité"],
                      ["aumFin", "AUM fin"],
                    ];

                    const cols = mode === "Pret" ? colsPret : colsInv;

                    return (
                      <TabsContent key={name} value={name} className="mt-4">
                        <div className="overflow-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {cols.map(([k, label]) => (
                                  <TableHead key={k}>{label}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {rows.map((r) => (
                                <TableRow key={r.annee}>
                                  {cols.map(([k]) => {
                                    const v = r[k];
                                    if (k === "annee") return <TableCell key={k} className="font-medium">{v}</TableCell>;
                                    if (k === "rendementPortefeuille") return <TableCell key={k}>{fmtPct(v)}</TableCell>;
                                    return <TableCell key={k} className="tabular-nums">{fmtUsd(safeNumber(v))}</TableCell>;
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {mode === "Pret" && (
                          <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                            <div className="font-medium">Remboursement final (à maturité)</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                              <div>Principal remboursé (réserve): {fmtUsd(s.summary.rembourseParReserve)}</div>
                              <div>Principal remboursé (divers): {fmtUsd(s.summary.rembourseParDivers)}</div>
                              <div>Principal remboursé (AUM): {fmtUsd(s.summary.rembourseParAum)}</div>
                              <div>Principal non remboursé: {fmtUsd(s.summary.principalNonRembourse)}</div>
                              <div>Total intérêts payés: {fmtUsd(s.summary.totalInteretsPayes)}</div>
                              <div>Total payé au prêteur: {fmtUsd(s.summary.totalPaye)}</div>
                            </div>
                          </div>
                        )}

                        {mode === "Invest" && distribution === "Fin" && (
                          <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                            <div className="font-medium">Distribution finale (maturité)</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                              <div>AUM avant distrib finale: {fmtUsd(s.summary.aumAvantDistribFinale)}</div>
                              <div>AUM après distrib finale: {fmtUsd(s.summary.aumApresDistribFinale)}</div>
                              <div>Distrib finale investisseur: {fmtUsd(s.summary.distribFinalInvest)}</div>
                              <div>Distrib finale entité: {fmtUsd(s.summary.distribFinalEntite)}</div>
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transparence — calcul des rendements de scénario (track record → CAGR)</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Détail par scénario et par asset : années utilisées, années retenues (split), min/moy/max, CAGR utilisé (track ou manuel).
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="Pessimiste" className="w-full">
                  <TabsList>
                    <TabsTrigger value="Pessimiste">Pessimiste</TabsTrigger>
                    <TabsTrigger value="Réaliste">Réaliste</TabsTrigger>
                    <TabsTrigger value="Optimiste">Optimiste</TabsTrigger>
                  </TabsList>

                  {scenarioNames.map((sc) => {
                    const dbg = debugByScenario[sc];
                    return (
                      <TabsContent key={sc} value={sc} className="mt-4">
                        {!dbg ? (
                          <div className="text-sm text-slate-600">Données indisponibles.</div>
                        ) : (
                          <div className="space-y-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Asset</TableHead>
                                  <TableHead>Source</TableHead>
                                  <TableHead>Années dispo (sélection)</TableHead>
                                  <TableHead>Années retenues (split)</TableHead>
                                  <TableHead>Min</TableHead>
                                  <TableHead>Moyenne</TableHead>
                                  <TableHead>Max</TableHead>
                                  <TableHead>CAGR utilisé</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(dbg).map(([asset, d]) => (
                                  <TableRow key={asset}>
                                    <TableCell className="font-medium">{asset}</TableCell>
                                    <TableCell>{d.source}</TableCell>
                                    <TableCell>
                                      {d.entriesAll.map(([y, r]) => `${y}: ${fmtPct(r)}`).join(" | ")}
                                    </TableCell>
                                    <TableCell>
                                      {d.usedEntries.map(([y, r]) => `${y}: ${fmtPct(r)}`).join(" | ")}
                                    </TableCell>
                                    <TableCell>{fmtPct(d.min)}</TableCell>
                                    <TableCell>{fmtPct(d.mean)}</TableCell>
                                    <TableCell>{fmtPct(d.max)}</TableCell>
                                    <TableCell>{fmtPct(d.cagrScenario)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            <div className="text-xs text-slate-600">
                              Formule : CAGR = (Π(1+r))^(1/n) − 1. Rendement portefeuille = Σ poids(normalisés) × CAGR_asset.
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Button onClick={exportCsvPack}>Télécharger pack CSV</Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  Imprimer en PDF
                </Button>
                <Badge variant="outline">Deck-grade (appendix)</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
