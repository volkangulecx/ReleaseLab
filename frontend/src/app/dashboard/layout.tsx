"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Upload, CreditCard, Crown, Settings, LogOut, Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAuthStore } from "@/lib/store";
import { startConnection, stopConnection } from "@/lib/signalr";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/upload", icon: Upload, label: "New Master" },
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
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.displayName || user.email).slice(0, 2).toUpperCase();

  const sidebarContent = (
    <>
      {/* Logo */}
      <Link href="/dashboard" className="mb-8 block" onClick={() => setMobileOpen(false)}>
        <Logo variant="sidebar" />
      </Link>

      {/* Nav */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-violet-500/10 text-violet-400 shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-violet-400" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-800/60 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.displayName || user.email.split("@")[0]}</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">{user.plan}</span>
              <span className="text-[11px] text-violet-400">{user.creditBalance} cr</span>
            </div>
          </div>
        </div>
        <button
          onClick={async () => { await logout(); router.push("/auth/login"); }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300 transition w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden glass rounded-xl p-2.5 text-zinc-300 hover:text-white transition"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800/50 p-5 flex flex-col transform transition-transform duration-300 ease-out md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[260px] border-r border-zinc-800/50 p-5 flex-col bg-zinc-950/50">
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 pt-16 md:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
