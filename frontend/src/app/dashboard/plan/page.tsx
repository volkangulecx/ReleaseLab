"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Crown, Zap, Shield, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface CurrentPlan {
  plan: string;
  mastersUsed: number;
  mastersLimit: number;
  canCreateMaster: boolean;
  maxFileSizeMb: number;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    canceledAt: string | null;
  } | null;
}

export default function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const [planData, setPlanData] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    api.get("/api/v1/plans/current").then(({ data }) => {
      setPlanData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubscribe = async (plan: string) => {
    setSubscribing(plan);
    try {
      const { data } = await api.post("/api/v1/plans/subscribe", {
        plan,
        successUrl: window.location.origin + "/dashboard/plan",
        cancelUrl: window.location.origin + "/dashboard/plan",
      });
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await api.post("/api/v1/plans/cancel");
      toast.success("Subscription will end at period end");
      const { data } = await api.get("/api/v1/plans/current");
      setPlanData(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Your Plan</h1>

      {/* Current plan card */}
      <div className="bg-gradient-to-br from-violet-600/20 to-violet-800/20 border border-violet-500/30 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-6 h-6 text-violet-400" />
          <h2 className="text-xl font-bold">{planData?.plan} Plan</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-zinc-400 text-sm">Masters this month</p>
            <p className="text-2xl font-bold">
              {planData?.mastersUsed} <span className="text-zinc-500 text-base">/ {planData?.mastersLimit}</span>
            </p>
          </div>
          <div>
            <p className="text-zinc-400 text-sm">Max file size</p>
            <p className="text-2xl font-bold">{planData?.maxFileSizeMb} MB</p>
          </div>
        </div>

        {/* Usage bar */}
        <div className="mt-4">
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${Math.min(100, ((planData?.mastersUsed ?? 0) / (planData?.mastersLimit ?? 1)) * 100)}%` }}
            />
          </div>
        </div>

        {planData?.subscription && (
          <div className="mt-4 pt-4 border-t border-violet-500/20 text-sm text-zinc-400">
            {planData.subscription.canceledAt ? (
              <p>Cancels at end of period: {new Date(planData.subscription.currentPeriodEnd).toLocaleDateString("tr-TR")}</p>
            ) : (
              <p>Renews: {new Date(planData.subscription.currentPeriodEnd).toLocaleDateString("tr-TR")}</p>
            )}
          </div>
        )}
      </div>

      {/* Upgrade options */}
      {planData?.plan !== "Studio" && (
        <>
          <h2 className="font-semibold mb-4">
            {planData?.plan === "Free" ? "Upgrade your plan" : "Change plan"}
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {planData?.plan === "Free" && (
              <button
                onClick={() => handleSubscribe("pro")}
                disabled={subscribing !== null}
                className="border border-violet-500 bg-violet-500/10 rounded-xl p-5 text-left transition hover:bg-violet-500/20"
              >
                <Zap className="w-6 h-6 text-violet-400 mb-2" />
                <p className="font-bold text-lg">Pro</p>
                <p className="text-violet-400 font-medium">$9/month</p>
                <p className="text-zinc-500 text-sm mt-2">20 masters, 200MB files, priority queue</p>
                {subscribing === "pro" && <Loader2 className="w-4 h-4 animate-spin mt-2" />}
              </button>
            )}
            <button
              onClick={() => handleSubscribe("studio")}
              disabled={subscribing !== null}
              className="border border-amber-500 bg-amber-500/10 rounded-xl p-5 text-left transition hover:bg-amber-500/20"
            >
              <Shield className="w-6 h-6 text-amber-400 mb-2" />
              <p className="font-bold text-lg">Studio</p>
              <p className="text-amber-400 font-medium">$29/month</p>
              <p className="text-zinc-500 text-sm mt-2">100 masters, 500MB files, FLAC export</p>
              {subscribing === "studio" && <Loader2 className="w-4 h-4 animate-spin mt-2" />}
            </button>
          </div>
        </>
      )}

      {/* Cancel */}
      {planData?.subscription && !planData.subscription.canceledAt && (
        <button
          onClick={handleCancel}
          disabled={canceling}
          className="text-zinc-500 hover:text-red-400 text-sm transition"
        >
          {canceling ? "Canceling..." : "Cancel subscription"}
        </button>
      )}
    </div>
  );
}
