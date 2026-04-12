"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

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

const statusDot: Record<string, string> = {
  Queued: "bg-yellow-400",
  Processing: "bg-blue-400 animate-pulse",
  Completed: "bg-emerald-400",
  Failed: "bg-red-400",
  Dead: "bg-red-500",
  Cancelled: "bg-zinc-500",
};

const statusText: Record<string, string> = {
  Queued: "text-yellow-400",
  Processing: "text-blue-400",
  Completed: "text-emerald-400",
  Failed: "text-red-400",
  Dead: "text-red-500",
  Cancelled: "text-zinc-500",
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

  useEffect(() => {
    fetchJobs();
  }, []);

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

  const hasActive = jobs.some(
    (j) => j.status === "Queued" || j.status === "Processing"
  );

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(fetchJobs, 5000);
    return () => clearInterval(id);
  }, [hasActive]);

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
    { label: "Total masters", value: totalMasters },
    { label: "This month", value: thisMonth },
    { label: "Credits", value: credits },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          {jobs.length > 0 && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/v1/export/jobs/csv`}
              className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              target="_blank"
            >
              Export CSV
            </a>
          )}
        </div>
        <Link
          href="/dashboard/upload"
          className="px-4 py-2 rounded-lg bg-white text-zinc-950 text-[13px] font-medium hover:bg-zinc-200 transition-colors"
        >
          New Master
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800/40 p-5"
          >
            <p className="text-3xl font-semibold text-white tracking-tight">
              {stat.value}
            </p>
            <p className="text-[13px] text-zinc-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Jobs */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-600 text-sm">Loading...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-zinc-400 font-medium mb-1">No masters yet</p>
          <p className="text-zinc-600 text-sm mb-6">
            Upload your first track to get started.
          </p>
          <Link
            href="/dashboard/upload"
            className="inline-flex px-5 py-2 rounded-lg bg-white text-zinc-950 text-[13px] font-medium hover:bg-zinc-200 transition-colors"
          >
            Upload track
          </Link>
        </div>
      ) : (
        <div>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_120px_120px_100px] gap-4 px-4 pb-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Track
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Preset
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
              Status
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium text-right">
              Date
            </span>
          </div>

          {/* Rows */}
          <div>
            {jobs.map((job) => {
              const dot = statusDot[job.status] || statusDot.Queued;
              const textColor = statusText[job.status] || statusText.Queued;
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="grid grid-cols-[1fr_120px_120px_100px] gap-4 items-center px-4 py-3 border-b border-zinc-800/30 hover:bg-white/[0.02] transition-colors group"
                >
                  <span className="text-[13px] font-medium text-zinc-200 truncate">
                    {job.preset} — {job.quality}
                  </span>
                  <span className="text-[13px] text-zinc-400">
                    {job.preset}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                    <span className={`text-[13px] ${textColor}`}>
                      {job.status}
                    </span>
                  </span>
                  <span className="text-[13px] text-zinc-500 text-right">
                    {timeAgo(job.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
