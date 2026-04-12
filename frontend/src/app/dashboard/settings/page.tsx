"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Loader2, User, Mail, Shield, CheckCircle, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setDisplayName(user.displayName ?? "");
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/v1/me", { displayName });
      await fetchUser();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!user) return;
    try {
      await api.post("/api/v1/auth/send-verification", { email: user.email });
      toast.success("Verification email sent!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

        {/* Profile Section */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-white">Profile</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-violet-500/30 transition text-white placeholder-zinc-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-500 cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 flex items-center gap-2 text-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </form>
        </div>

        {/* Email Verification */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-white">Email Verification</h2>
          </div>

          <div className="flex items-center gap-3">
            {user?.email ? (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-zinc-500 text-sm flex-1">
                  Verify your email to unlock all features
                </p>
                <button
                  onClick={handleSendVerification}
                  className="text-violet-400 hover:text-violet-300 text-sm font-medium transition whitespace-nowrap"
                >
                  Send verification email
                </button>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="text-zinc-500 text-sm">Email verified</p>
              </>
            )}
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-violet-400" />
            <h2 className="font-semibold text-white">Account</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Plan</span>
              <span className="text-white font-medium">{user?.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Credits</span>
              <span className="text-white font-medium">{user?.creditBalance}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Member since</span>
              <span className="text-white font-medium">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("tr-TR")
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
