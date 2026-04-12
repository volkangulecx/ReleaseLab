"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
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
    api
      .get("/api/v1/plans/current")
      .then(({ data }) => {
        setPlanData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative z-10">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  const usagePercent = Math.min(
    100,
    ((planData?.mastersUsed ?? 0) / (planData?.mastersLimit ?? 1)) * 100
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-8">Your Plan</h1>

        {/* Current plan card */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-5">{planData?.plan} Plan</h2>

          <div className="grid grid-cols-2 gap-6 mb-5">
            <div>
              <p className="text-zinc-500 text-sm">Masters this month</p>
              <p className="text-2xl font-bold text-white mt-1">
                {planData?.mastersUsed}{" "}
                <span className="text-zinc-600 text-base font-normal">
                  / {planData?.mastersLimit}
                </span>
              </p>
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Max file size</p>
              <p className="text-2xl font-bold text-white mt-1">{planData?.maxFileSizeMb} MB</p>
            </div>
          </div>

          {/* Usage bar */}
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all"
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          {planData?.subscription && (
            <p className="text-zinc-600 text-sm mt-4">
              {planData.subscription.canceledAt
                ? `Cancels at end of period: ${new Date(planData.subscription.currentPeriodEnd).toLocaleDateString("tr-TR")}`
                : `Renews: ${new Date(planData.subscription.currentPeriodEnd).toLocaleDateString("tr-TR")}`}
            </p>
          )}
        </div>

        {/* Upgrade options */}
        {planData?.plan !== "Studio" && (
          <>
            <h2 className="text-sm font-medium text-zinc-400 mb-4">
              {planData?.plan === "Free" ? "Upgrade your plan" : "Change plan"}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {planData?.plan === "Free" && (
                <button
                  onClick={() => handleSubscribe("pro")}
                  disabled={subscribing !== null}
                  className="border border-zinc-800/40 hover:border-violet-500/40 bg-zinc-900/50 hover:bg-violet-500/5 rounded-xl p-5 text-left transition"
                >
                  <p className="font-bold text-lg text-white">Pro</p>
                  <p className="text-violet-400 font-medium text-sm mt-1">$9/month</p>
                  <p className="text-zinc-600 text-sm mt-2">
                    20 masters, 200MB files, priority queue
                  </p>
                  {subscribing === "pro" && (
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400 mt-2" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleSubscribe("studio")}
                disabled={subscribing !== null}
                className="border border-zinc-800/40 hover:border-violet-500/40 bg-zinc-900/50 hover:bg-violet-500/5 rounded-xl p-5 text-left transition"
              >
                <p className="font-bold text-lg text-white">Studio</p>
                <p className="text-violet-400 font-medium text-sm mt-1">$29/month</p>
                <p className="text-zinc-600 text-sm mt-2">
                  100 masters, 500MB files, FLAC export
                </p>
                {subscribing === "studio" && (
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400 mt-2" />
                )}
              </button>
            </div>
          </>
        )}

        {/* Cancel */}
        {planData?.subscription && !planData.subscription.canceledAt && (
          <button
            onClick={handleCancel}
            disabled={canceling}
            className="text-zinc-600 hover:text-red-400 text-sm transition"
          >
            {canceling ? "Canceling..." : "Cancel subscription"}
          </button>
        )}
      </div>
    </div>
  );
}
