"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users, Briefcase, ArrowLeft, Shield, Menu, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";

const navItems = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    } else if (!loading && user && !user.isAdmin) {
      router.push("/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !user.isAdmin) return null;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-2 mb-8">
        <Shield className="w-6 h-6 text-amber-500" />
        <span className="text-lg font-bold">Admin Panel</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
          Admin
        </span>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isActive
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 pt-4 mt-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to app
        </Link>
        <div className="px-3 mt-3">
          <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile hamburger */}
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

      {/* Main content */}
      <main className="flex-1 p-8 pt-16 md:pt-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
