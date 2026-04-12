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

  if (verified) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Email verified!</h2>
          <p className="text-zinc-400 text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <h2 className="text-xl font-bold text-center mb-2">Verify your email</h2>
        <p className="text-zinc-400 text-sm text-center mb-6">
          We sent a 6-digit code to{" "}
          <span className="text-zinc-200">{user?.email ?? "your email"}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-violet-500 transition"
              placeholder="------"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Verify
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resending}
          className="flex items-center gap-2 justify-center text-zinc-500 hover:text-zinc-300 text-sm mt-6 transition mx-auto"
        >
          <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
          Resend code
        </button>
      </div>
    </div>
  );
}
