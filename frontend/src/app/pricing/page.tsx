"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import Logo from "@/components/ui/Logo";
import api from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  monthlyMasters: number;
  maxFileSizeMb: number;
  priorityQueue: boolean;
  outputFormats: string[];
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api.get("/api/v1/plans").then(({ data }) => setPlans(data)).catch(() => {});
  }, []);

  const features = (plan: Plan) => [
    `${plan.monthlyMasters} masters/month`,
    `${plan.maxFileSizeMb}MB max file size`,
    plan.priorityQueue ? "Priority queue" : "Standard queue",
    ...plan.outputFormats.map((f) =>
      f === "wav" ? "WAV lossless export" : f === "mp3_320" ? "MP3 320kbps" : "FLAC export"
    ),
  ];

  const highlight = (id: string) =>
    id === "pro"
      ? "border-violet-500 bg-violet-500/5"
      : "border-zinc-800";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <Logo variant="sidebar" />
        </Link>
        <Link href="/auth/login" className="text-zinc-400 hover:text-white transition">
          Sign In
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold">Simple, transparent pricing</h1>
          <p className="text-zinc-400 text-lg mt-4">Start free. Upgrade when you need more.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.id} className={`border-2 rounded-2xl p-6 flex flex-col ${highlight(plan.id)}`}>
              {plan.id === "pro" && (
                <span className="self-start bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                  MOST POPULAR
                </span>
              )}
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <div className="mt-4 mb-6">
                {plan.priceCents === 0 ? (
                  <span className="text-4xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-4xl font-bold">${plan.priceCents / 100}</span>
                    <span className="text-zinc-400">/month</span>
                  </>
                )}
              </div>

              <ul className="space-y-3 flex-1">
                {features(plan).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    <span className="text-zinc-300">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.priceCents === 0 ? "/auth/register" : "/auth/register"}
                className={`mt-6 py-3 rounded-lg text-center font-medium transition flex items-center justify-center gap-2 ${
                  plan.id === "pro"
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "border border-zinc-700 hover:border-zinc-500 text-zinc-300"
                }`}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 text-zinc-500 text-sm">
          All plans include free preview. Credits available for pay-per-use.
        </div>
      </div>
    </div>
  );
}
