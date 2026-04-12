"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Music, LayoutDashboard, Upload, CreditCard, LogOut, Menu, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 mb-8">
        <Music className="w-6 h-6 text-violet-500" />
        <span className="text-lg font-bold">ReleaseLab</span>
      </div>

      <nav className="space-y-1 flex-1">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition"
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </Link>
        <Link
          href="/dashboard/upload"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition"
        >
          <Upload className="w-5 h-5" />
          New Master
        </Link>
        <Link
          href="/dashboard/credits"
          onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden inline-flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-300 hover:bg-zinc-800 transition"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 p-4 flex flex-col transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 transition"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800 p-4 flex-col">
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 pt-16 md:pt-8">{children}</main>
    </div>
  );
}
