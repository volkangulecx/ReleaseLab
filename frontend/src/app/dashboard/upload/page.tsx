"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Upload, Music, Loader2, Sparkles, CheckCircle, Flame, Sun, Volume2, Scale } from "lucide-react";
import { uploadApi, jobsApi } from "@/lib/api";
import axios from "axios";

const PRESETS = [
  {
    id: "Warm",
    label: "Warm",
    desc: "Smooth, rich low-mids. Great for R&B, Soul, Jazz.",
    gradient: "from-orange-500 to-red-500",
    glowColor: "rgba(249, 115, 22, 0.3)",
    icon: Flame,
  },
  {
    id: "Bright",
    label: "Bright",
    desc: "Crisp highs and clear presence. Pop, Indie, Acoustic.",
    gradient: "from-blue-500 to-cyan-400",
    glowColor: "rgba(59, 130, 246, 0.3)",
    icon: Sun,
  },
  {
    id: "Loud",
    label: "Loud",
    desc: "Maximum punch and energy. EDM, Hip-Hop, Rock.",
    gradient: "from-red-500 to-pink-500",
    glowColor: "rgba(239, 68, 68, 0.3)",
    icon: Volume2,
  },
  {
    id: "Balanced",
    label: "Balanced",
    desc: "Natural, transparent mastering. Works with anything.",
    gradient: "from-violet-500 to-purple-500",
    glowColor: "rgba(139, 92, 246, 0.3)",
    icon: Scale,
  },
];

const QUALITIES = [
  { id: "Preview", label: "Preview", sublabel: "Free", desc: "MP3 128kbps" },
  { id: "HiRes", label: "Hi-Res", sublabel: "1 credit", desc: "WAV + MP3 320kbps" },
];

type Step = "upload" | "preset" | "processing";

/* SVG circular progress ring */
function ProgressRing({ progress, size = 120, stroke = 8 }: { progress: number; size?: number; stroke?: number }) {
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
        stroke="rgba(63,63,70,0.5)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#uploadGrad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-300"
      />
      <defs>
        <linearGradient id="uploadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [preset, setPreset] = useState("Balanced");
  const [quality, setQuality] = useState("Preview");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [creating, setCreating] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleFile = async (f: File) => {
    const allowed = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac"];
    if (!allowed.includes(f.type)) {
      toast.error("Unsupported format. Use WAV, MP3, or FLAC.");
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      toast.error("File too large (max 500MB)");
      return;
    }

    setFile(f);
    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get presigned URL
      const { data: initData } = await uploadApi.init(f.name, f.size, f.type);

      // 2. Upload directly to S3
      await axios.put(initData.uploadUrl, f, {
        headers: { "Content-Type": f.type },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      // 3. Confirm upload
      await uploadApi.complete(initData.fileId);

      setFileId(initData.fileId);
      setStep("preset");
      toast.success("File uploaded!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Upload failed");
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!fileId) return;
    setCreating(true);
    try {
      const { data: job } = await jobsApi.create(fileId, preset, quality);
      toast.success("Mastering started!");
      router.push(`/jobs/${job.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const currentStepIndex = step === "upload" ? 0 : step === "preset" ? 1 : 2;
  const steps = ["Upload", "Choose Preset", "Start"];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  i <= currentStepIndex
                    ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                }`}
              >
                {i < currentStepIndex ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium transition-colors ${
                  i <= currentStepIndex ? "text-white" : "text-zinc-600"
                }`}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-20 h-0.5 mx-3 mb-5 rounded-full transition-all duration-500 ${
                  i < currentStepIndex
                    ? "bg-gradient-to-r from-violet-500 to-purple-500"
                    : "bg-zinc-800"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-8 gradient-text">New Master</h1>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="animate-fade-in-up">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative group rounded-2xl p-[2px] cursor-pointer transition-all duration-300 hover:scale-[1.01]"
            onClick={() => !uploading && document.getElementById("file-input")?.click()}
            style={{
              background: uploading
                ? "linear-gradient(135deg, #8b5cf6, #a78bfa, #8b5cf6)"
                : "linear-gradient(135deg, rgba(63,63,70,0.6), rgba(63,63,70,0.3), rgba(63,63,70,0.6))",
            }}
          >
            {/* Animated gradient border on hover */}
            <div
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #a78bfa, #c4b5fd, #8b5cf6)",
                backgroundSize: "200% 200%",
                animation: "gradient-x 3s ease infinite",
              }}
            />

            <div className="relative rounded-2xl bg-zinc-950/90 p-14 text-center">
              <input
                id="file-input"
                type="file"
                accept=".wav,.mp3,.flac"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {uploading ? (
                <div className="flex flex-col items-center animate-scale-in">
                  <div className="relative">
                    <ProgressRing progress={uploadProgress} size={140} stroke={8} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold gradient-text">{uploadProgress}%</span>
                    </div>
                  </div>
                  <p className="text-lg font-medium mt-6 text-white">Uploading...</p>
                  <p className="text-zinc-500 text-sm mt-1 truncate max-w-xs">{file?.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="animate-float">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-6 border border-violet-500/20">
                      <Upload className="w-9 h-9 text-violet-400" />
                    </div>
                  </div>
                  <p className="text-xl font-semibold text-white mb-2">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-zinc-500 text-sm mb-5">Max file size: 500 MB</p>
                  <div className="flex items-center gap-2">
                    {["WAV", "MP3", "FLAC"].map((fmt) => (
                      <span
                        key={fmt}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preset Selection */}
      {step === "preset" && (
        <div className="animate-fade-in-up">
          {/* Uploaded file info card */}
          <div className="glass rounded-xl px-5 py-4 mb-8 flex items-center gap-4 animate-fade-in">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white truncate">{file?.name}</p>
              <p className="text-zinc-500 text-sm">
                {(file!.size / 1024 / 1024).toFixed(1)} MB — Ready to master
              </p>
            </div>
            <Music className="w-5 h-5 text-zinc-600 flex-shrink-0" />
          </div>

          <h2 className="font-semibold mb-4 text-zinc-300">Choose a Preset</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`relative group rounded-2xl p-[1.5px] text-left transition-all duration-300 ${
                    isSelected ? "scale-[1.02]" : "hover:scale-[1.01]"
                  }`}
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${p.gradient.includes("orange") ? "#f97316, #ef4444" : p.gradient.includes("blue") ? "#3b82f6, #22d3ee" : p.gradient.includes("red") ? "#ef4444, #ec4899" : "#8b5cf6, #a855f7"})`
                      : "rgba(63,63,70,0.4)",
                    boxShadow: isSelected ? `0 0 30px ${p.glowColor}` : "none",
                  }}
                >
                  <div className="rounded-2xl bg-zinc-950/90 p-5 h-full">
                    <div
                      className={`w-11 h-11 rounded-xl mb-3 flex items-center justify-center bg-gradient-to-br ${p.gradient} opacity-90`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-semibold text-white text-base">{p.label}</p>
                    <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quality segmented control */}
          <h2 className="font-semibold mb-4 text-zinc-300">Quality</h2>
          <div className="glass rounded-xl p-1.5 flex mb-8">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={`flex-1 rounded-lg py-3 px-4 text-center transition-all duration-300 ${
                  quality === q.id
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/20"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <p className="font-semibold text-sm">{q.label}</p>
                <p className={`text-xs mt-0.5 ${quality === q.id ? "text-violet-200" : "text-zinc-500"}`}>
                  {q.sublabel} — {q.desc}
                </p>
              </button>
            ))}
          </div>

          {/* Start button */}
          <button
            onClick={handleCreateJob}
            disabled={creating}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2.5 text-base"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #8b5cf6, #a855f7)",
            }}
          >
            {creating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            Start Mastering
          </button>
        </div>
      )}
    </div>
  );
}
