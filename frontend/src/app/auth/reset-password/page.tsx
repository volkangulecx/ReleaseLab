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
      <div className="text-center">
        <p className="text-zinc-400 mb-4">Invalid or missing reset link.</p>
        <Link href="/auth/forgot-password" className="text-violet-400 hover:text-violet-300">
          Request a new one
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Password reset!</h2>
        <p className="text-zinc-400 text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-center mb-2">Set new password</h2>
      <p className="text-zinc-400 text-sm text-center mb-6">
        for <span className="text-zinc-200">{email}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">New Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-violet-500 transition"
            placeholder="Min 6 characters"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Confirm Password</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-violet-500 transition"
            placeholder="Same as above"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Reset Password
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo variant="page" />
        </div>
        <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-500" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
