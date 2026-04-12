"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Loader2 } from "lucide-react";
import { uploadApi, jobsApi } from "@/lib/api";
import axios from "axios";

const PRESETS = [
  {
    id: "Warm",
    label: "Warm",
    desc: "Smooth, rich low-mids. Great for R&B, Soul, Jazz.",
  },
  {
    id: "Bright",
    label: "Bright",
    desc: "Crisp highs and clear presence. Pop, Indie, Acoustic.",
  },
  {
    id: "Loud",
    label: "Loud",
    desc: "Maximum punch and energy. EDM, Hip-Hop, Rock.",
  },
  {
    id: "Balanced",
    label: "Balanced",
    desc: "Natural, transparent mastering. Works with anything.",
  },
];

const QUALITIES = [
  { id: "Preview", label: "Preview", sublabel: "Free", desc: "MP3 128kbps" },
  { id: "HiRes", label: "Hi-Res", sublabel: "1 credit", desc: "WAV + MP3 320kbps" },
];

type Step = "upload" | "preset" | "processing";

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
      const { data: initData } = await uploadApi.init(f.name, f.size, f.type);

      await axios.put(initData.uploadUrl, f, {
        headers: { "Content-Type": f.type },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

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
  const stepLabels = ["Upload", "Preset", "Master"];

  return (
    <div className="max-w-xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10 text-[13px] font-medium">
        {stepLabels.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span className={i <= currentStepIndex ? "text-white" : "text-zinc-500"}>
              {i + 1}. {label}
            </span>
            {i < stepLabels.length - 1 && (
              <span className="text-zinc-700">&rarr;</span>
            )}
          </span>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !uploading && document.getElementById("file-input")?.click()}
            className="relative rounded-xl border border-dashed border-zinc-700/60 hover:border-zinc-600 p-16 text-center cursor-pointer transition-colors"
          >
            <input
              id="file-input"
              type="file"
              accept=".wav,.mp3,.flac"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {uploading ? (
              <div>
                {/* Progress bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800 rounded-t-xl overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-white font-medium mb-1">Uploading... {uploadProgress}%</p>
                <p className="text-zinc-500 text-sm truncate max-w-xs mx-auto">{file?.name}</p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-300 font-medium mb-1">
                  Drop audio file or click to browse
                </p>
                <p className="text-zinc-600 text-sm">
                  WAV, MP3, or FLAC up to 500 MB
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Preset + Quality + Start */}
      {step === "preset" && (
        <div>
          {/* Uploaded file */}
          <div className="flex items-center gap-3 mb-8 px-1">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[13px] text-zinc-300 truncate">{file?.name}</span>
            <button
              onClick={() => {
                setStep("upload");
                setFile(null);
                setFileId(null);
              }}
              className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors ml-auto shrink-0"
            >
              Change
            </button>
          </div>

          {/* Preset selection */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Preset</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {PRESETS.map((p) => {
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-white/80 bg-white/[0.03]"
                      : "border-zinc-800/40 hover:border-zinc-700/60 hover:bg-white/[0.02]"
                  }`}
                >
                  <p className={`text-[13px] font-semibold mb-0.5 ${isSelected ? "text-white" : "text-zinc-300"}`}>
                    {p.label}
                  </p>
                  <p className="text-[12px] text-zinc-500 leading-relaxed">{p.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Quality */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Quality</p>
          <div className="space-y-2 mb-10">
            {QUALITIES.map((q) => {
              const isSelected = quality === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setQuality(q.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-white/80 bg-white/[0.03]"
                      : "border-zinc-800/40 hover:border-zinc-700/60"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-white" : "border-zinc-600"
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className={`text-[13px] font-medium ${isSelected ? "text-white" : "text-zinc-300"}`}>
                      {q.label}
                    </span>
                    <span className="text-[12px] text-zinc-500 ml-2">
                      {q.sublabel} &middot; {q.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Start button */}
          <button
            onClick={handleCreateJob}
            disabled={creating}
            className="w-full py-3.5 rounded-xl font-medium text-[14px] text-zinc-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
            }}
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            Start Mastering
          </button>
        </div>
      )}
    </div>
  );
}
