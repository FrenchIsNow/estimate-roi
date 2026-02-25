"use client";

import React, { useMemo, useState, useEffect } from "react";
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

import {
  TRACK,
  fmtPct,
  fmtUsd,
  clamp,
  safeNumber,
  normalizeWeights,
  simulateLoanInFine,
  simulateInvestmentProfitShare,
  toCsv,
  runSelfTests,
  SimulationResult,
  LoanSummary,
  InvestmentSummary,
  ScenarioOverrides,
  AssetResult,
  ScenarioDebug,
} from "@/lib/simulator";

function BadgeOk({ ok, okLabel = "OK", failLabel = "ÉCHEC" }: { ok: boolean; okLabel?: string; failLabel?: string }) {
  return ok ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">{okLabel}</Badge>
  ) : (
    <Badge variant="destructive">{failLabel}</Badge>
  );
}

export default function ScenarioExplorer() {
  useEffect(() => {
    runSelfTests();
  }, []);

  const allYears = useMemo(() => {
    const s = new Set<number>();
    Object.values(TRACK).forEach((a) =>
      Object.keys(a.apyByYear).forEach((y) => s.add(Number(y)))
    );
    return Array.from(s).sort((a, b) => a - b);
  }, []);

  // =========================
  // UI State
  // =========================
  const [mode, setMode] = useState("Pret"); // "Pret" | "Invest"

  const [yearsChoice, setYearsChoice] = useState<number[]>(
    [2022, 2023, 2024, 2025].filter((y) => allYears.includes(y))
  );

  const [wUIn, setWUIn] = useState(0.5);
  const [wEIn, setWEIn] = useState(0.25);
  const [wBIn, setWBIn] = useState(0.25);
  const weights = useMemo(() => normalizeWeights(wUIn, wEIn, wBIn), [wUIn, wEIn, wBIn]);

  const [termYears, setTermYears] = useState(8);
  const [custodyFee, setCustodyFee] = useState(0.004);
  const [annualOpex, setAnnualOpex] = useState(120_000);
  const [annualSalaries, setAnnualSalaries] = useState(192_000);

  const scenarioNames = useMemo(() => ["Pessimiste", "Réaliste", "Optimiste"], []);
  const [useOverrides, setUseOverrides] = useState(false);
  const [overridesByScenario, setOverridesByScenario] = useState<Record<string, ScenarioOverrides>>({
    Pessimiste: { USDC: null, ETH: null, BTC: null },
    Réaliste: { USDC: null, ETH: null, BTC: null },
    Optimiste: { USDC: null, ETH: null, BTC: null },
  });

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

  const yearsToggle = (y: number) => {
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

  const setOverride = (scenario: string, asset: string, valuePct: string) => {
    const v = valuePct === "" ? null : Number(valuePct) / 100;
    setOverridesByScenario((prev) => ({
      ...prev,
      [scenario]: { ...prev[scenario], [asset]: Number.isFinite(v ?? NaN) ? v : null },
    }));
  };

  // =========================
  // Run scenarios
  // =========================
  const scenarios = useMemo<SimulationResult<LoanSummary | InvestmentSummary>[]>(() => {
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
    scenarioNames,
  ]);

  const okAll = useMemo(() => {
    if (mode !== "Pret") return true;
    return scenarios.every((s) => {
      const sm = s.summary as LoanSummary;
      return Math.abs(sm.principalNonRembourse) < 1e-6;
    });
  }, [mode, scenarios]);

  const pessimisticChart = scenarios[0].rows.map((r) => ({
    annee: r.annee,
    aumFin: Math.max(r.aumFin ?? 0, 0),
    reserveFin: Math.max(r.reserveFin ?? 0, 0),
    diversFin: Math.max(r.diversFin ?? 0, 0),
  }));

  const downloadFile = (filename: string, content: string, mime = "text/plain") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsvPack = () => {
    const sumRows = scenarios.map((s) => {
      if (mode === "Pret") {
        const sm = s.summary as LoanSummary;
        return {
          Mode: s.mode,
          Scenario: sm.scenario,
          Rendement_Portefeuille_CAGR: sm.rendementPortefeuille,
          Principal: sm.principal,
          Duree: sm.duree,
          Taux_Interet: sm.tauxInteret,
          Total_Interets_Payes: sm.totalInteretsPayes,
          Principal_Rembourse: sm.principalRembourse,
          Total_Paye: sm.totalPaye,
          Principal_Non_Rembourse: sm.principalNonRembourse,
          AUM_Apres_Remb: sm.aumApresRemb,
          Divers_Apres_Remb: sm.diversificationApresRemb,
          Reserve_Apres_Remb: sm.reserveApresRemb,
          Capital_Continuite: sm.capitalContinuite,
        };
      }

      const sm = s.summary as InvestmentSummary;
      return {
        Mode: s.mode,
        Scenario: sm.scenario,
        Rendement_Portefeuille_CAGR: sm.rendementPortefeuille,
        Capital_Investi: sm.capitalInvesti,
        Duree: sm.duree,
        Fee_Mgmt: sm.feesMEV_Mgmt,
        Fee_Perf: sm.feesMEV_Perf,
        Split_Investisseur: sm.splitInvestisseur,
        Split_Entite: sm.splitEntite,
        Distribution: sm.distribution,
        AUM_Avant_Distrib_Finale: sm.aumAvantDistribFinale,
        AUM_Apres_Distrib_Finale: sm.aumApresDistribFinale,
        Profit_Total_Net: sm.profitTotalNet,
        Total_Distrib_Invest: sm.totalDistribInvest,
        Total_Distrib_Entite: sm.totalDistribEntite,
      };
    });

    downloadFile("resume_scenarios.csv", toCsv(sumRows), "text/csv");
    scenarios.forEach((s) => {
      downloadFile(
        `cashflows_${s.scenario.toLowerCase().replaceAll("é", "e").replaceAll("à", "a")}_${mode}.csv`,
        toCsv(s.rows),
        "text/csv"
      );
    });
  };

  const debugByScenario = useMemo(() => {
    const out: Record<string, ScenarioDebug> = {};
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
                      <Label className="text-xs">Taux d&apos;intérêt annuel (coupon)</Label>
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
                        <p className="text-xs text-slate-600">Le reste du surplus reste dans l&apos;AUM principal (réinvesti dans le même modèle).</p>
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
                    Le &quot;Surplus&quot; est la hausse nette d&apos;AUM après coûts vs AUM départ (planché à 0). On n&apos;alimente les poches que quand l&apos;année est nette positive.
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
                    En mode &quot;Fin&quot;, on distribue les profits (pas le capital) à la maturité. L&apos;app affiche AUM avant ET après distribution finale.
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
                      if (mode === "Pret") {
                        const sm = s.summary as LoanSummary;
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

                      const sm = s.summary as InvestmentSummary;
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
                    Note : en mode &quot;Fin&quot;, la ligne &quot;Distrib.&quot; inclut la distribution finale. L&apos;app conserve et affiche AUM avant et après distribution finale (voir détails annuels / export CSV).
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const s = scenarios.find((x) => (x.summary as any).scenario === name);
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
                                    if (k === "rendementPortefeuille") return <TableCell key={k}>{fmtPct(v as number)}</TableCell>;
                                    return <TableCell key={k} className="tabular-nums">{fmtUsd(safeNumber(v))}</TableCell>;
                                  })}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {mode === "Pret" && s && (
                          <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                            <div className="font-medium">Remboursement final (à maturité)</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                              <div>Principal remboursé (réserve): {fmtUsd((s.summary as LoanSummary).rembourseParReserve)}</div>
                              <div>Principal remboursé (divers): {fmtUsd((s.summary as LoanSummary).rembourseParDivers)}</div>
                              <div>Principal remboursé (AUM): {fmtUsd((s.summary as LoanSummary).rembourseParAum)}</div>
                              <div>Principal non remboursé: {fmtUsd((s.summary as LoanSummary).principalNonRembourse)}</div>
                              <div>Total intérêts payés: {fmtUsd((s.summary as LoanSummary).totalInteretsPayes)}</div>
                              <div>Total payé au prêteur: {fmtUsd((s.summary as LoanSummary).totalPaye)}</div>
                            </div>
                          </div>
                        )}

                        {mode === "Invest" && s && distribution === "Fin" && (
                          <div className="mt-3 rounded-lg border bg-white p-3 text-sm">
                            <div className="font-medium">Distribution finale (maturité)</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                              <div>AUM avant distrib finale: {fmtUsd((s.summary as InvestmentSummary).aumAvantDistribFinale)}</div>
                              <div>AUM après distrib finale: {fmtUsd((s.summary as InvestmentSummary).aumApresDistribFinale)}</div>
                              <div>Distrib finale investisseur: {fmtUsd((s.summary as InvestmentSummary).distribFinalInvest)}</div>
                              <div>Distrib finale entité: {fmtUsd((s.summary as InvestmentSummary).distribFinalEntite)}</div>
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
                                {Object.entries(dbg as ScenarioDebug).map(([asset, d]: [string, AssetResult]) => (
                                  <TableRow key={asset}>
                                    <TableCell className="font-medium">{asset}</TableCell>
                                    <TableCell>{d.source}</TableCell>
                                    <TableCell>
                                      {d.entriesAll.map(([y, r]: [number, number]) => `${y}: ${fmtPct(r)}`).join(" | ")}
                                    </TableCell>
                                    <TableCell>
                                      {d.usedEntries.map(([y, r]: [number, number]) => `${y}: ${fmtPct(r)}`).join(" | ")}
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
