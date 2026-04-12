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
  Music,
  Flame,
  Sun,
  Volume2,
  Scale,
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

const PRESET_CONFIG: Record<string, { gradient: string; icon: typeof Music; glowColor: string }> = {
  Warm: { gradient: "from-orange-500 to-red-500", icon: Flame, glowColor: "rgba(249,115,22,0.3)" },
  Bright: { gradient: "from-blue-500 to-cyan-400", icon: Sun, glowColor: "rgba(59,130,246,0.3)" },
  Loud: { gradient: "from-red-500 to-pink-500", icon: Volume2, glowColor: "rgba(239,68,68,0.3)" },
  Balanced: { gradient: "from-violet-500 to-purple-500", icon: Scale, glowColor: "rgba(139,92,246,0.3)" },
};

/* SVG circular progress ring */
function ProgressRing({
  progress,
  size = 180,
  stroke = 10,
  gradientId = "jobGrad",
}: {
  progress: number;
  size?: number;
  stroke?: number;
  gradientId?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(63,63,70,0.4)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
    </svg>
  );
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

    // Cleanup on unmount
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
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 animate-pulse-glow">
          <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
          <span className="text-zinc-500 text-sm">Loading job...</span>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isActive = job.status === "Queued" || job.status === "Processing";
  const isDone = job.status === "Completed";
  const isFailed = job.status === "Failed" || job.status === "Dead";

  const presetConf = PRESET_CONFIG[job.preset] || PRESET_CONFIG.Balanced;
  const PresetIcon = presetConf.icon;

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
    <div className="max-w-3xl mx-auto p-8 animate-fade-in-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to
        Dashboard
      </Link>

      {/* Header Card */}
      <div className="glass-strong rounded-2xl p-6 mb-6 animate-fade-in">
        <div className="flex items-center gap-5">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${presetConf.gradient} shadow-lg flex-shrink-0`}
            style={{ boxShadow: `0 8px 30px ${presetConf.glowColor}` }}
          >
            <PresetIcon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white">{job.preset} Master</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {job.quality} &middot;{" "}
              {new Date(job.createdAt).toLocaleString("tr-TR")}
              {elapsedSec !== null && <> &middot; Completed in {elapsedSec}s</>}
            </p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              isDone
                ? "bg-emerald-500/15 text-emerald-400"
                : isFailed
                  ? "bg-red-500/15 text-red-400"
                  : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {job.status}
          </div>
        </div>
      </div>

      {/* Processing / Progress Section */}
      {isActive && (
        <div className="glass rounded-2xl p-8 mb-6 animate-fade-in-up delay-100">
          <div className="flex flex-col items-center">
            <div className="relative animate-pulse-glow rounded-full">
              <ProgressRing progress={job.progress} size={180} stroke={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold gradient-text">{job.progress}%</span>
              </div>
            </div>
            <p className="text-zinc-300 font-medium mt-6 text-lg">{stageText}</p>
            {job.progress > 0 && job.progress < 100 && (
              <p className="text-zinc-600 text-sm mt-1">
                Estimated time remaining: ~{Math.max(1, Math.round(((100 - job.progress) / Math.max(job.progress, 1)) * 10))}s
              </p>
            )}
          </div>

          <div className="flex justify-center mt-6">
            <button
              onClick={handleCancel}
              className="border border-zinc-700 hover:border-red-500/60 text-zinc-400 hover:text-red-400 px-5 py-2 rounded-xl transition-all duration-300 text-sm"
            >
              Cancel Job
            </button>
          </div>
        </div>
      )}

      {/* Completed Section */}
      {isDone && (
        <div className="animate-fade-in-up delay-100">
          {/* Success banner */}
          <div className="glass rounded-2xl p-6 mb-6 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: "radial-gradient(circle at 50% 0%, #10b981 0%, transparent 60%)",
              }}
            />
            <div className="relative flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4 glow-violet animate-scale-in"
                style={{ boxShadow: "0 0 30px rgba(16,185,129,0.25), 0 0 60px rgba(16,185,129,0.1)" }}
              >
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Mastering Complete</h2>
              <p className="text-zinc-500 text-sm mt-1">
                Your track has been mastered with the {job.preset} preset
              </p>
            </div>
          </div>

          {/* Download cards */}
          <div className={`grid ${job.quality === "HiRes" ? "grid-cols-2" : "grid-cols-1"} gap-4 mb-6`}>
            <button
              onClick={() => handleDownload("preview")}
              className="group relative rounded-2xl p-[1.5px] transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, rgba(63,63,70,0.6), rgba(63,63,70,0.3))",
              }}
            >
              <div className="rounded-2xl bg-zinc-950/90 p-6 h-full text-left group-hover:bg-zinc-900/90 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-zinc-700 transition-colors">
                  <Download className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                </div>
                <p className="font-semibold text-white">Preview</p>
                <p className="text-zinc-500 text-sm mt-1">MP3 128kbps</p>
              </div>
            </button>

            {job.quality === "HiRes" && (
              <button
                onClick={() => handleDownload("master")}
                className="group relative rounded-2xl p-[1.5px] transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #a855f7)",
                }}
              >
                <div className="rounded-2xl bg-zinc-950/90 p-6 h-full text-left group-hover:bg-zinc-900/90 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                    <Download className="w-5 h-5 text-violet-400" />
                  </div>
                  <p className="font-semibold text-white">Master</p>
                  <p className="text-zinc-500 text-sm mt-1">WAV + MP3 320kbps</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Failed Section */}
      {isFailed && (
        <div className="animate-fade-in-up delay-100">
          <div
            className="glass rounded-2xl p-6 mb-6 relative overflow-hidden"
            style={{ boxShadow: "0 0 40px rgba(239,68,68,0.1), 0 0 80px rgba(239,68,68,0.05)" }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                background: "radial-gradient(circle at 50% 0%, #ef4444 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Mastering Failed</h2>
                  <p className="text-zinc-500 text-sm">Something went wrong during processing</p>
                </div>
              </div>
              {job.errorMessage && (
                <div className="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <p className="text-red-300 text-sm font-mono">{job.errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions (for completed/failed) */}
      {(isDone || isFailed) && (
        <div className="flex gap-3 mb-8 animate-fade-in-up delay-200">
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/20 text-sm"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
            }}
          >
            <Plus className="w-4 h-4" />
            New Master
          </Link>
        </div>
      )}

      {/* A/B Comparison -- only when completed */}
      {isDone && inputUrl && outputUrl && (
        <div className="animate-fade-in-up delay-300">
          <h2 className="text-lg font-semibold mb-4 text-white">Before / After</h2>
          <div className="glass rounded-2xl p-5">
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
  );
}
