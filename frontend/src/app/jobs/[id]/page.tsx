"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
  Plus,
} from "lucide-react";
import { jobsApi, analysisApi } from "@/lib/api";
import ABComparison from "@/components/ui/ABComparison";

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

interface Analysis {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  peakDb: number;
  loudnessLufs: number;
  waveform: number[];
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputAnalysis, setInputAnalysis] = useState<Analysis | null>(null);
  const [outputAnalysis, setOutputAnalysis] = useState<Analysis | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadJob();
    return () => eventSourceRef.current?.close();
  }, [id]);

  const loadJob = async () => {
    try {
      const { data } = await jobsApi.get(id);
      setJob(data);
      setLoading(false);

      if (data.status === "Queued" || data.status === "Processing") {
        startPolling();
      }

      if (data.status === "Completed") {
        loadAnalysis();
        loadDownloadUrls();
      }
    } catch {
      toast.error("Job not found");
      router.push("/dashboard");
    }
  };

  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const { data } = await jobsApi.get(id);
        setJob(data);
        if (data.status === "Completed" || data.status === "Failed" || data.status === "Dead") {
          clearInterval(interval);
          if (data.status === "Completed") {
            loadAnalysis();
            loadDownloadUrls();
          }
        }
      } catch {}
    }, 2000);

    eventSourceRef.current = { close: () => clearInterval(interval) } as any;
  };

  const loadAnalysis = async () => {
    try {
      const [inp, out] = await Promise.allSettled([
        analysisApi.analyzeJob(id, "input"),
        analysisApi.analyzeJob(id, "output"),
      ]);
      if (inp.status === "fulfilled") setInputAnalysis(inp.value.data);
      if (out.status === "fulfilled") setOutputAnalysis(out.value.data);
    } catch {}
  };

  const loadDownloadUrls = async () => {
    try {
      const [preview, master] = await Promise.allSettled([
        jobsApi.download(id, "preview"),
        jobsApi.download(id, "master"),
      ]);
      if (preview.status === "fulfilled") setOutputUrl(preview.value.data.downloadUrl);
      if (master.status === "fulfilled") setInputUrl(master.value.data.downloadUrl);
    } catch {}
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
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <span className="text-zinc-500 text-sm">Loading job...</span>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isActive = job.status === "Queued" || job.status === "Processing";
  const isDone = job.status === "Completed";
  const isFailed = job.status === "Failed" || job.status === "Dead";

  const elapsedSec = job.finishedAt
    ? Math.round((new Date(job.finishedAt).getTime() - new Date(job.createdAt).getTime()) / 1000)
    : null;

  const stageText =
    job.status === "Queued"
      ? "Waiting in queue..."
      : job.progress < 30
        ? "Analyzing audio..."
        : job.progress < 70
          ? "Applying mastering..."
          : "Finalizing output...";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/8 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10 animate-fade-in-up">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition text-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header card */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{job.preset} Master</h1>
              <p className="text-zinc-500 text-sm mt-1">
                {job.quality} &middot;{" "}
                {new Date(job.createdAt).toLocaleString("tr-TR")}
                {elapsedSec !== null && <> &middot; Completed in {elapsedSec}s</>}
              </p>
            </div>
            <span
              className={`text-sm font-medium ${
                isDone
                  ? "text-emerald-400"
                  : isFailed
                    ? "text-red-400"
                    : "text-violet-400"
              }`}
            >
              {job.status}
            </span>
          </div>
        </div>

        {/* Processing */}
        {isActive && (
          <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-zinc-300 text-sm font-medium">{stageText}</p>
              <span className="text-violet-400 text-sm font-bold">{job.progress}%</span>
            </div>

            {/* Thin progress bar */}
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${job.progress}%` }}
              />
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={handleCancel}
                className="border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 px-5 py-2 rounded-lg transition text-sm"
              >
                Cancel Job
              </button>
            </div>
          </div>
        )}

        {/* Completed */}
        {isDone && (
          <div className="space-y-4 mb-6">
            <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <p className="text-white font-medium">Mastering complete</p>
              </div>

              {/* Download buttons */}
              <div className={`grid ${job.quality === "HiRes" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                <button
                  onClick={() => handleDownload("preview")}
                  className="group border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-zinc-500 group-hover:text-violet-400 transition" />
                    <div>
                      <p className="font-medium text-white text-sm">Preview</p>
                      <p className="text-zinc-500 text-xs mt-0.5">MP3 128kbps</p>
                    </div>
                  </div>
                </button>

                {job.quality === "HiRes" && (
                  <button
                    onClick={() => handleDownload("master")}
                    className="group border border-violet-500/30 hover:border-violet-500/50 bg-violet-500/5 rounded-xl p-5 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <Download className="w-5 h-5 text-violet-400 transition" />
                      <div>
                        <p className="font-medium text-white text-sm">Master</p>
                        <p className="text-zinc-500 text-xs mt-0.5">WAV + MP3 320kbps</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="text-white font-medium">Mastering Failed</p>
            </div>
            {job.errorMessage && (
              <p className="text-red-400/80 text-sm mt-3 font-mono bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                {job.errorMessage}
              </p>
            )}
          </div>
        )}

        {/* New master action */}
        {(isDone || isFailed) && (
          <div className="mb-8">
            <Link
              href="/dashboard/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white text-sm bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25"
            >
              <Plus className="w-4 h-4" />
              New Master
            </Link>
          </div>
        )}

        {/* A/B Comparison */}
        {isDone && inputUrl && outputUrl && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-white">Before / After</h2>
            <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
              <ABComparison
                inputUrl={inputUrl}
                outputUrl={outputUrl}
                inputAnalysis={inputAnalysis}
                outputAnalysis={outputAnalysis}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
