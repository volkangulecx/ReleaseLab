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

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Profile Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold">Profile</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-violet-500 transition"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>

      {/* Email Verification */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold">Email Verification</h2>
        </div>

        <div className="flex items-center gap-3">
          {user?.email ? (
            // We don't have emailVerified in the current user response, so show verify button
            <>
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <p className="text-zinc-400 text-sm flex-1">Verify your email to unlock all features</p>
              <button
                onClick={handleSendVerification}
                className="text-violet-400 hover:text-violet-300 text-sm font-medium transition"
              >
                Send verification email
              </button>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-zinc-400 text-sm">Email verified</p>
            </>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold">Account</h2>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Plan</span>
            <span className="font-medium">{user?.plan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Credits</span>
            <span className="font-medium">{user?.creditBalance}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Member since</span>
            <span className="font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
