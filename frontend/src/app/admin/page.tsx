"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Briefcase,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Skull,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import toast from "react-hot-toast";

interface Stats {
  total: number;
  queued: number;
  processing: number;
  completed24h: number;
  failed24h: number;
  dead: number;
  newUsers7d: number;
  totalUsers: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .stats()
      .then((res) => setStats(res.data))
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "New Users (7d)",
      value: stats.newUsers7d,
      icon: UserPlus,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Total Jobs",
      value: stats.total,
      icon: Briefcase,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Queued",
      value: stats.queued,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Processing",
      value: stats.processing,
      icon: Cpu,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Completed (24h)",
      value: stats.completed24h,
      icon: CheckCircle2,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Failed (24h)",
      value: stats.failed24h,
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Dead Jobs",
      value: stats.dead,
      icon: Skull,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-sm text-zinc-400">{card.label}</span>
            </div>
            <p className="text-3xl font-bold">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
