"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CreditCard, Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
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
    creditsApi.balance().then(({ data }) => {
      setHistory(data.recentHistory);
      setLoading(false);
    }).catch(() => setLoading(false));
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Credits</h1>

      {/* Balance */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-xl p-6 mb-8">
        <p className="text-violet-200 text-sm">Current Balance</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-4xl font-bold">{user?.creditBalance ?? 0}</span>
          <span className="text-violet-200">credits</span>
        </div>
        <p className="text-violet-300 text-sm mt-2">1 credit = 1 hi-res master export</p>
      </div>

      {/* Buy */}
      <h2 className="font-semibold mb-4">Buy Credits</h2>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {PACKAGES.map((pkg) => (
          <button
            key={pkg.credits}
            onClick={() => handlePurchase(pkg.credits)}
            className="border border-zinc-700 hover:border-violet-500 rounded-xl p-4 text-center transition hover:bg-violet-500/5"
          >
            <Coins className="w-6 h-6 text-violet-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{pkg.credits}</p>
            <p className="text-violet-400 font-medium">{pkg.price}</p>
            <p className="text-zinc-500 text-xs mt-1">{pkg.desc}</p>
          </button>
        ))}
      </div>

      {/* History */}
      <h2 className="font-semibold mb-4">Transaction History</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No transactions yet</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {history.map((item, i) => (
              <div key={i} className="flex items-center px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                  item.delta > 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}>
                  {item.delta > 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{item.reason}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <span className={`font-medium ${item.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {item.delta > 0 ? "+" : ""}{item.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
