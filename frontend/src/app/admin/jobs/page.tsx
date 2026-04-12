"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Ban,
} from "lucide-react";
import { adminApi } from "@/lib/api";

interface Job {
  id: string;
  userId: string;
  status: string;
  preset: string;
  quality: string;
  progress: number;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  creditsCost: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Queued: { icon: <Clock className="w-3.5 h-3.5" />, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  Processing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "text-blue-400", bg: "bg-blue-400/10" },
  Completed: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  Failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-400", bg: "bg-red-400/10" },
  Dead: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-red-500", bg: "bg-red-500/10" },
  Cancelled: { icon: <Ban className="w-3.5 h-3.5" />, color: "text-zinc-500", bg: "bg-zinc-500/10" },
};

const STATUSES = ["", "Queued", "Processing", "Completed", "Failed", "Dead", "Cancelled"];

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.jobs(page, statusFilter);
      setJobs(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, [page, statusFilter]);

  const handleRetry = async (id: string) => {
    try {
      await adminApi.retryJob(id);
      toast.success("Job requeued");
      fetchJobs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await adminApi.cancelJob(id);
      toast.success("Job cancelled");
      fetchJobs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };

  const duration = (job: Job) => {
    if (!job.startedAt || !job.finishedAt) return "-";
    const sec = (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000;
    return `${sec.toFixed(1)}s`;
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Preset</th>
                <th className="text-left px-4 py-3 font-medium">Quality</th>
                <th className="text-right px-4 py-3 font-medium">Progress</th>
                <th className="text-right px-4 py-3 font-medium">Attempts</th>
                <th className="text-right px-4 py-3 font-medium">Duration</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500">Loading...</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500">No jobs found</td></tr>
              ) : jobs.map((job) => {
                const sc = statusConfig[job.status] || statusConfig.Queued;
                return (
                  <tr key={job.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{job.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color} ${sc.bg}`}>
                        {sc.icon} {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{job.preset}</td>
                    <td className="px-4 py-3">{job.quality}</td>
                    <td className="px-4 py-3 text-right">
                      {job.status === "Processing" ? (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${job.progress}%` }} />
                          </div>
                          <span className="text-xs">{job.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500">{job.progress}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{job.attemptCount}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{duration(job)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(job.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {(job.status === "Failed" || job.status === "Dead") && (
                          <button
                            onClick={() => handleRetry(job.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-700 text-amber-400 transition"
                            title="Retry"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(job.status === "Queued" || job.status === "Processing") && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-700 text-red-400 transition"
                            title="Cancel"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">{total} jobs total</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-zinc-700 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error details for failed jobs */}
      {jobs.filter(j => j.errorMessage).length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-3 text-zinc-400">Recent Errors</h2>
          <div className="space-y-2">
            {jobs.filter(j => j.errorMessage).slice(0, 5).map((job) => (
              <div key={job.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-zinc-500">{job.id.slice(0, 8)}</span>
                  {job.errorCode && <span className="text-red-400 text-xs font-medium">{job.errorCode}</span>}
                </div>
                <p className="text-zinc-400 text-xs">{job.errorMessage}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
