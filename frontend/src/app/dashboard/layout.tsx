"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Music, LayoutDashboard, Upload, CreditCard, LogOut } from "lucide-react";
import { useAuthStore } from "@/lib/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <Music className="w-6 h-6 text-violet-500" />
          <span className="text-lg font-bold">ReleaseLab</span>
        </div>

        <nav className="space-y-1 flex-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/upload"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition"
          >
            <Upload className="w-5 h-5" />
            New Master
          </Link>
          <Link
            href="/dashboard/credits"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition"
          >
            <CreditCard className="w-5 h-5" />
            Credits
          </Link>
        </nav>

        <div className="border-t border-zinc-800 pt-4 mt-4">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
            <p className="text-xs text-zinc-500">{user.plan} Plan</p>
            <p className="text-xs text-violet-400 mt-1">{user.creditBalance} credits</p>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.push("/auth/login");
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition w-full"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
