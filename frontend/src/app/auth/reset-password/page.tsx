"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, CheckCircle } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { authApi } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email, token, password);
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Reset failed. Token may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!email || !token) {
    return (
      <div className="glass-strong rounded-3xl p-8 md:p-10 glow-violet-sm text-center">
        <p className="text-zinc-400 mb-4">Invalid or missing reset link.</p>
        <Link
          href="/auth/forgot-password"
          className="text-violet-400 hover:text-violet-300 text-sm font-medium transition"
        >
          Request a new one
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="glass-strong rounded-3xl p-8 md:p-10 glow-violet-sm text-center">
        <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Password reset!</h2>
        <p className="text-zinc-500 text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-3xl p-8 md:p-10 glow-violet-sm">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Set new password</h1>
        <p className="text-zinc-500 text-sm mt-1">
          for <span className="text-zinc-300">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            New Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition text-white placeholder-zinc-600"
            placeholder="Min 6 characters"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition text-white placeholder-zinc-600"
            placeholder="Same as above"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Reset Password
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense
          fallback={
            <div className="glass-strong rounded-3xl p-8 md:p-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
