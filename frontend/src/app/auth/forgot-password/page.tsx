"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
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
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-zinc-500 text-sm mb-6">
                If an account exists for{" "}
                <span className="text-zinc-300">{email}</span>, we&apos;ve sent
                a password reset link.
              </p>
              <Link
                href="/auth/login"
                className="text-violet-400 hover:text-violet-300 text-sm font-medium transition"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
                <p className="text-zinc-500 text-sm mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition text-white placeholder-zinc-600"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Reset Link
                </button>
              </form>

              <div className="text-center mt-5">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
