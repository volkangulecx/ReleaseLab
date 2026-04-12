"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Upload, Sliders, CreditCard, Crown, Settings, LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/lib/store";
import { startConnection, stopConnection } from "@/lib/signalr";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/upload", icon: Upload, label: "New Master" },
  { href: "/dashboard/mixing", icon: Sliders, label: "Mixing" },
  { href: "/dashboard/credits", icon: CreditCard, label: "Credits" },
  { href: "/dashboard/plan", icon: Crown, label: "Plan" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { fetchUser(); }, [fetchUser]);
  useEffect(() => { if (!loading && !user) router.push("/auth/login"); }, [loading, user, router]);
  useEffect(() => {
    if (user) { startConnection(); return () => stopConnection(); }
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.displayName || user.email).slice(0, 2).toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link href="/dashboard" className="mb-8 block px-3 pt-1" onClick={() => setMobileOpen(false)}>
        <Logo variant="navbar" className="!drop-shadow-none" />
      </Link>

      {/* Nav */}
      <nav className="space-y-0.5 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-white/5 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "text-zinc-300" : "text-zinc-600"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-800/40 pt-4 mt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] font-semibold text-zinc-300 shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-zinc-300 truncate">
              {user.email}
            </p>
            <span className="text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              {user.plan}
            </span>
          </div>
        </div>
        <button
          onClick={async () => { await logout(); router.push("/auth/login"); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden rounded-lg p-2 bg-zinc-900 border border-zinc-800/40 text-zinc-400 hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-zinc-950 border-r border-zinc-800/40 p-4 transform transition-transform duration-200 ease-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[240px] border-r border-zinc-800/40 p-4 flex-col bg-zinc-950 shrink-0">
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 pt-16 md:p-10 overflow-x-hidden bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
