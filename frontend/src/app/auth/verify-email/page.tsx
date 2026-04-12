"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, fetchUser } = useAuthStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await authApi.verifyEmail(user.email, code);
      setVerified(true);
      await fetchUser();
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await authApi.sendVerification(user.email);
      toast.success("New code sent!");
    } catch {
      toast.error("Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo variant="page" />
        </div>

        {/* Card */}
        <div className="glass-strong rounded-3xl p-8 md:p-10 glow-violet-sm">
          {verified ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email verified!</h2>
              <p className="text-zinc-500 text-sm">Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white">Verify your email</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  We sent a 6-digit code to{" "}
                  <span className="text-zinc-300">{user?.email ?? "your email"}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-4 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition text-white placeholder-zinc-600"
                    placeholder="------"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify
                </button>
              </form>

              <div className="text-center mt-5">
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
