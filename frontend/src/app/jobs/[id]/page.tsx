"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle, XCircle, Download, Loader2, Music } from "lucide-react";
import { jobsApi } from "@/lib/api";

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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    jobsApi.get(id).then(({ data }) => {
      setJob(data);
      setLoading(false);

      // Start SSE if job is in progress
      if (data.status === "Queued" || data.status === "Processing") {
        startSSE();
      }
    }).catch(() => {
      toast.error("Job not found");
      router.push("/dashboard");
    });

    return () => eventSourceRef.current?.close();
  }, [id]);

  const startSSE = () => {
    const token = localStorage.getItem("accessToken");
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const es = new EventSource(`${baseUrl}/api/v1/jobs/${id}/stream?access_token=${token}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setJob((prev) =>
          prev ? { ...prev, progress: data.progress, status: data.status || prev.status } : prev
        );

        if (data.progress === 100 || data.status === "Completed" || data.status === "Failed") {
          es.close();
          // Reload full job data
          jobsApi.get(id).then(({ data }) => setJob(data));
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Poll fallback
      const interval = setInterval(async () => {
        try {
          const { data } = await jobsApi.get(id);
          setJob(data);
          if (data.status === "Completed" || data.status === "Failed" || data.status === "Dead") {
            clearInterval(interval);
          }
        } catch {}
      }, 3000);
    };

    eventSourceRef.current = es;
  };

  const handleDownload = async (kind: "preview" | "master") => {
    try {
      const { data } = await jobsApi.download(id, kind);
      window.open(data.downloadUrl, "_blank");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Download failed");
    }
  };

  const handleCancel = async () => {
    try {
      await jobsApi.cancel(id);
      const { data } = await jobsApi.get(id);
      setJob(data);
      toast.success("Job cancelled");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Cancel failed");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!job) return null;

  const isActive = job.status === "Queued" || job.status === "Processing";
  const isDone = job.status === "Completed";
  const isFailed = job.status === "Failed" || job.status === "Dead";

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center">
            <Music className="w-6 h-6 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{job.preset} Master</h1>
            <p className="text-zinc-500 text-sm">
              {job.quality} &middot;{" "}
              {new Date(job.createdAt).toLocaleString("tr-TR")}
            </p>
          </div>
        </div>

        {/* Progress */}
        {isActive && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">
                {job.status === "Queued" ? "Waiting in queue..." : "Processing..."}
              </span>
              <span className="text-sm font-medium">{job.progress}%</span>
            </div>
            <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Completed */}
        {isDone && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-emerald-400 mb-4">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Mastering Complete</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDownload("preview")}
                className="border border-zinc-700 hover:border-zinc-500 rounded-lg p-4 text-left transition"
              >
                <Download className="w-5 h-5 text-zinc-400 mb-2" />
                <p className="font-medium">Preview</p>
                <p className="text-zinc-500 text-sm">MP3 128kbps</p>
              </button>

              {job.quality === "HiRes" && (
                <button
                  onClick={() => handleDownload("master")}
                  className="border border-violet-500 bg-violet-500/10 rounded-lg p-4 text-left transition hover:bg-violet-500/20"
                >
                  <Download className="w-5 h-5 text-violet-400 mb-2" />
                  <p className="font-medium">Master</p>
                  <p className="text-zinc-500 text-sm">WAV + MP3 320kbps</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="flex items-center gap-2 text-red-400 mb-4">
            <XCircle className="w-5 h-5" />
            <div>
              <span className="font-medium">Mastering Failed</span>
              {job.errorMessage && (
                <p className="text-zinc-500 text-sm mt-1">{job.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          {isActive && (
            <button
              onClick={handleCancel}
              className="border border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-red-400 px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          )}
          <Link
            href="/dashboard/upload"
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-4 py-2 rounded-lg transition"
          >
            New Master
          </Link>
        </div>
      </div>
    </div>
  );
}
