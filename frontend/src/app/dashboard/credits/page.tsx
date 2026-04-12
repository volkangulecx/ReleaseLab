"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { creditsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface HistoryItem {
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

const PACKAGES = [
  { credits: 5, price: "$5", desc: "5 credits" },
  { credits: 15, price: "$12", desc: "15 credits (20% off)" },
  { credits: 50, price: "$35", desc: "50 credits (30% off)" },
];

export default function CreditsPage() {
  const user = useAuthStore((s) => s.user);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    creditsApi
      .balance()
      .then(({ data }) => {
        setHistory(data.recentHistory);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handlePurchase = async (credits: number) => {
    try {
      const { data } = await creditsApi.purchase(
        credits,
        window.location.origin + "/dashboard/credits",
        window.location.origin + "/dashboard/credits"
      );
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Purchase failed");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-8">Credits</h1>

        {/* Balance */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-8">
          <p className="text-zinc-500 text-sm">Current Balance</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-5xl font-bold text-white">{user?.creditBalance ?? 0}</span>
            <span className="text-zinc-500">credits</span>
          </div>
          <p className="text-zinc-600 text-sm mt-2">1 credit = 1 hi-res master export</p>
        </div>

        {/* Buy Credits */}
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Buy Credits</h2>
        <div className="grid grid-cols-3 gap-3 mb-10">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.credits}
              onClick={() => handlePurchase(pkg.credits)}
              className="group border border-zinc-800/40 hover:border-violet-500/40 bg-zinc-900/50 hover:bg-violet-500/5 rounded-xl p-5 text-center transition"
            >
              <Coins className="w-5 h-5 text-violet-400 mx-auto mb-3" />
              <p className="text-2xl font-bold text-white">{pkg.credits}</p>
              <p className="text-violet-400 font-medium text-sm mt-1">{pkg.price}</p>
              <p className="text-zinc-600 text-xs mt-1">{pkg.desc}</p>
            </button>
          ))}
        </div>

        {/* Transaction History */}
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Transaction History</h2>
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-600 text-sm">Loading...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No transactions yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40">
                  <th className="text-left text-zinc-500 font-medium px-4 py-3">Date</th>
                  <th className="text-left text-zinc-500 font-medium px-4 py-3">Type</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3">Amount</th>
                  <th className="text-right text-zinc-500 font-medium px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {history.map((item, i) => (
                  <tr key={i} className="hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.delta > 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="text-zinc-300 capitalize">{item.reason}</span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        item.delta > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {item.delta > 0 ? "+" : ""}
                      {item.delta}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{item.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
