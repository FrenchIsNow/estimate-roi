"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";

interface GatekeeperProps {
  children: React.ReactNode;
}

export default function Gatekeeper({ children }: GatekeeperProps) {
  const [accessCode, setAccessCode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const requiredCode = process.env.NEXT_PUBLIC_ACCESS_CODE || "1234";

  useEffect(() => {
    const storedAuth = localStorage.getItem("app_authorized");
    if (storedAuth === "true") {
      setIsAuthorized(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode === requiredCode) {
      setIsAuthorized(true);
      localStorage.setItem("app_authorized", "true");
      setError(false);
    } else {
      setError(true);
      setAccessCode("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans selection:bg-blue-500/30">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
          </div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 mb-6 shadow-lg shadow-blue-500/20">
              <Lock className="text-white" size={32} />
            </div>

            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Zone Sécurisée</h1>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Veuillez entrer votre code d&apos;accès pour accéder au Simulateur d&apos;Investissement.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <Input
                  type="password"
                  placeholder="Code d'accès"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className={`h-14 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl px-4 focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 ${
                    error ? "border-red-500/50 ring-2 ring-red-500/20" : ""
                  }`}
                  autoFocus
                />
                {error && (
                  <p className="absolute -bottom-6 left-0 text-xs text-red-400 animate-in slide-in-from-top-1">
                    Code incorrect. Veuillez réessayer.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-14 bg-white text-slate-950 hover:bg-slate-100 font-semibold rounded-xl transition-all duration-300 group flex items-center justify-center gap-2"
              >
                Accéder au simulateur
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-500">Estimate ROI v1.0</span>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
