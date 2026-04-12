"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";
import {
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Music,
  CalendarDays,
  Coins,
} from "lucide-react";

interface Job {
  id: string;
  status: string;
  preset: string;
  quality: string;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; dot: string; badge: string }
> = {
  Queued: {
    icon: <Clock className="w-4 h-4" />,
    color: "text-yellow-400",
    dot: "bg-yellow-400",
    badge: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  },
  Processing: {
    icon: <Clock className="w-4 h-4 animate-spin" />,
    color: "text-blue-400",
    dot: "bg-blue-400 animate-pulse",
    badge: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  },
  Completed: {
    icon: <CheckCircle className="w-4 h-4" />,
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  },
  Failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-400",
    dot: "bg-red-400",
    badge: "bg-red-400/10 text-red-400 border-red-400/20",
  },
  Dead: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-red-500",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
  },
  Cancelled: {
    icon: <XCircle className="w-4 h-4" />,
    color: "text-zinc-500",
    dot: "bg-zinc-500",
    badge: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  },
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const prevJobsRef = useRef<Job[]>([]);

  const fetchJobs = () => {
    jobsApi
      .list()
      .then(({ data }) => {
        const newJobs: Job[] = data.data || data;
        const prev = prevJobsRef.current;

        // Notify on newly completed jobs
        for (const nj of newJobs) {
          const old = prev.find((j) => j.id === nj.id);
          if (old && old.status === "Processing" && nj.status === "Completed") {
            toast.success(`${nj.preset} master completed!`);
          }
        }

        prevJobsRef.current = newJobs;
        setJobs(newJobs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Initial load
  useEffect(() => {
    fetchJobs();
  }, []);

  // Listen for SignalR events to auto-refresh
  useEffect(() => {
    const onCompleted = () => fetchJobs();
    const onFailed = () => fetchJobs();
    const onProgress = () => fetchJobs();
    window.addEventListener("job:completed", onCompleted);
    window.addEventListener("job:failed", onFailed);
    window.addEventListener("job:progress", onProgress);
    return () => {
      window.removeEventListener("job:completed", onCompleted);
      window.removeEventListener("job:failed", onFailed);
      window.removeEventListener("job:progress", onProgress);
    };
  }, []);

  // Auto-refresh when active jobs exist
  const hasActive = jobs.some(
    (j) => j.status === "Queued" || j.status === "Processing"
  );

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(fetchJobs, 5000);
    return () => clearInterval(id);
  }, [hasActive]);

  // Stats
  const totalMasters = jobs.length;
  const thisMonth = useMemo(() => {
    const now = new Date();
    return jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [jobs]);
  const credits = user?.creditBalance ?? 0;

  const stats = [
    {
      label: "Total Masters",
      value: totalMasters,
      icon: Music,
      gradient: "from-violet-600/20 to-violet-400/5",
      iconBg: "bg-violet-500/15",
      iconColor: "text-violet-400",
    },
    {
      label: "This Month",
      value: thisMonth,
      icon: CalendarDays,
      gradient: "from-blue-600/20 to-blue-400/5",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-400",
    },
    {
      label: "Credits",
      value: credits,
      icon: Coins,
      gradient: "from-amber-600/20 to-amber-400/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-400",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-950/80 via-violet-900/40 to-zinc-900/60 border border-violet-500/10 p-8 mb-8 animate-fade-in-up">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-violet-600/15 rounded-full blur-[80px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back,{" "}
              <span className="gradient-text">
                {user?.displayName || user?.email?.split("@")[0]}
              </span>
            </h1>
            <p className="text-zinc-400">
              Manage your masters and track your mastering progress.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {jobs.length > 0 && (
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/v1/export/jobs/csv`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700/50 bg-zinc-800/50 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-all"
                target="_blank"
              >
                <Download className="w-4 h-4" /> Export CSV
              </a>
            )}
            <Link
              href="/dashboard/upload"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25"
            >
              <Upload className="w-4 h-4" />
              New Master
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile action buttons */}
      <div className="flex sm:hidden items-center gap-3 mb-6">
        {jobs.length > 0 && (
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/v1/export/jobs/csv`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700/50 bg-zinc-800/50 text-sm text-zinc-300 hover:bg-zinc-700/50 transition"
            target="_blank"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        )}
        <Link
          href="/dashboard/upload"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium transition-all"
        >
          <Upload className="w-4 h-4" />
          New Master
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-xl glass p-5 animate-fade-in-up`}
            style={{ animationDelay: `${(i + 1) * 100}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-60`} />
            <div className="relative z-10 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-zinc-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs list */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Jobs</h2>
          <span className="text-xs text-zinc-600">{jobs.length} total</span>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Loading your masters...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-16 text-center animate-fade-in-up">
            <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
              <Upload className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No masters yet</h3>
            <p className="text-zinc-500 mb-6 max-w-xs mx-auto">
              Upload your first track and experience AI-powered mastering in seconds.
            </p>
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25"
            >
              Upload your first track <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {jobs.map((job, i) => {
              const sc = statusConfig[job.status] || statusConfig.Queued;
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center px-6 py-4 hover:bg-white/[0.02] transition-all duration-200 hover:scale-[1.005] group animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Status dot */}
                  <div className="mr-4 flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
                  </div>

                  {/* Center info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span className="font-semibold text-white truncate">{job.preset}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/50 text-zinc-400 font-medium uppercase tracking-wide flex-shrink-0">
                        {job.quality}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-sm">{timeAgo(job.createdAt)}</p>
                  </div>

                  {/* Right side: progress bar or status badge */}
                  {job.status === "Processing" ? (
                    <div className="w-32 mr-4 flex-shrink-0">
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 text-right font-medium">
                        {job.progress}%
                      </p>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${sc.badge} flex-shrink-0`}
                    >
                      {job.status}
                    </span>
                  )}

                  <ArrowRight className="w-4 h-4 text-zinc-700 ml-3 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
