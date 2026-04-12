"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Upload, Music, Loader2, Sparkles } from "lucide-react";
import { uploadApi, jobsApi } from "@/lib/api";
import axios from "axios";

const PRESETS = [
  { id: "Warm", label: "Warm", desc: "Smooth, rich low-mids. Great for R&B, Soul, Jazz.", color: "border-orange-500 bg-orange-500/10" },
  { id: "Bright", label: "Bright", desc: "Crisp highs and clear presence. Pop, Indie, Acoustic.", color: "border-sky-500 bg-sky-500/10" },
  { id: "Loud", label: "Loud", desc: "Maximum punch and energy. EDM, Hip-Hop, Rock.", color: "border-red-500 bg-red-500/10" },
  { id: "Balanced", label: "Balanced", desc: "Natural, transparent mastering. Works with anything.", color: "border-violet-500 bg-violet-500/10" },
];

const QUALITIES = [
  { id: "Preview", label: "Preview (Free)", desc: "MP3 128kbps" },
  { id: "HiRes", label: "Hi-Res (1 credit)", desc: "WAV + MP3 320kbps" },
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">New Master</h1>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-12 text-center transition cursor-pointer"
          onClick={() => document.getElementById("file-input")?.click()}
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
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium">Uploading {file?.name}...</p>
              <div className="w-64 h-2 bg-zinc-700 rounded-full overflow-hidden mx-auto mt-4">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-zinc-500 text-sm mt-2">{uploadProgress}%</p>
            </div>
          ) : (
            <div>
              <Upload className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-lg font-medium">Drop your audio file here</p>
              <p className="text-zinc-500 text-sm mt-2">WAV, MP3, or FLAC (max 500MB)</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preset Selection */}
      {step === "preset" && (
        <div>
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-6">
            <Music className="w-5 h-5 text-violet-500" />
            <div>
              <p className="font-medium">{file?.name}</p>
              <p className="text-zinc-500 text-sm">{(file!.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </div>

          <h2 className="font-semibold mb-4">Choose a Preset</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`border rounded-xl p-4 text-left transition ${
                  preset === p.id ? p.color + " border-2" : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <p className="font-semibold">{p.label}</p>
                <p className="text-zinc-400 text-sm mt-1">{p.desc}</p>
              </button>
            ))}
          </div>

          <h2 className="font-semibold mb-4">Quality</h2>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={`border rounded-xl p-4 text-left transition ${
                  quality === q.id
                    ? "border-violet-500 bg-violet-500/10 border-2"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <p className="font-semibold">{q.label}</p>
                <p className="text-zinc-400 text-sm mt-1">{q.desc}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleCreateJob}
            disabled={creating}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
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
