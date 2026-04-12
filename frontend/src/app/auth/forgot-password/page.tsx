"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
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
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo variant="page" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-violet-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Check your email</h2>
            <p className="text-zinc-400 text-sm mb-6">
              If an account exists for <span className="text-zinc-200">{email}</span>,
              we&apos;ve sent a password reset link.
            </p>
            <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 text-sm">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-center mb-2">Forgot your password?</h2>
            <p className="text-zinc-400 text-sm text-center mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-violet-500 transition"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
            </form>

            <Link
              href="/auth/login"
              className="flex items-center gap-1 justify-center text-zinc-500 hover:text-zinc-300 text-sm mt-6 transition"
            >
              <ArrowLeft className="w-3 h-3" /> Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
