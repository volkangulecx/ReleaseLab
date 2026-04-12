"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Upload, Clock, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";

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

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  Queued: { icon: <Clock className="w-4 h-4" />, color: "text-yellow-400" },
  Processing: { icon: <Clock className="w-4 h-4 animate-spin" />, color: "text-blue-400" },
  Completed: { icon: <CheckCircle className="w-4 h-4" />, color: "text-emerald-400" },
  Failed: { icon: <XCircle className="w-4 h-4" />, color: "text-red-400" },
  Dead: { icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-500" },
  Cancelled: { icon: <XCircle className="w-4 h-4" />, color: "text-zinc-500" },
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.list().then(({ data }) => {
      setJobs(data.data || data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.displayName || user?.email?.split("@")[0]}
          </h1>
          <p className="text-zinc-500 mt-1">{user?.creditBalance} credits available</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          New Master
        </Link>
      </div>

      {/* Jobs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Recent Jobs</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-zinc-500">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-zinc-500 mb-4">No mastering jobs yet</p>
            <Link
              href="/dashboard/upload"
              className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1"
            >
              Upload your first track <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {jobs.map((job) => {
              const sc = statusConfig[job.status] || statusConfig.Queued;
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center px-6 py-4 hover:bg-zinc-800/50 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={sc.color}>{sc.icon}</span>
                      <span className="font-medium">{job.preset}</span>
                      <span className="text-zinc-500 text-sm">({job.quality})</span>
                    </div>
                    <p className="text-zinc-500 text-sm mt-1">
                      {new Date(job.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>

                  {job.status === "Processing" && (
                    <div className="w-32 mr-4">
                      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 text-right">{job.progress}%</p>
                    </div>
                  )}

                  <span className={`text-sm ${sc.color}`}>{job.status}</span>
                  <ArrowRight className="w-4 h-4 text-zinc-600 ml-3" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
