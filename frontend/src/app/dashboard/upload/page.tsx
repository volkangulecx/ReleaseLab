"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, ChevronDown, Loader2, RotateCcw, X, Search } from "lucide-react";
import { uploadApi, jobsApi, recommendApi } from "@/lib/api";
import axios from "axios";

const PROCESSING_CHAIN = [
  { order: 1, name: "Cleanup" },
  { order: 2, name: "EQ" },
  { order: 3, name: "Compress" },
  { order: 4, name: "Stereo" },
  { order: 5, name: "Loudnorm" },
  { order: 6, name: "Limiter" },
];

const STANDARD_PRESETS = [
  {
    id: "Warm",
    label: "Warm",
    desc: "Smooth, rich low-mids. Great for R&B, Soul, Jazz.",
    targetLufs: -14,
    stereo: 1.0,
    lra: 10,
    eq: [
      { freq: 60, gain: 2 },
      { freq: 250, gain: 3 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: -1 },
      { freq: 12000, gain: -2 },
    ],
  },
  {
    id: "Bright",
    label: "Bright",
    desc: "Crisp highs and clear presence. Pop, Indie, Acoustic.",
    targetLufs: -14,
    stereo: 1.1,
    lra: 9,
    eq: [
      { freq: 60, gain: 0 },
      { freq: 250, gain: -1 },
      { freq: 1000, gain: 1 },
      { freq: 4000, gain: 3 },
      { freq: 12000, gain: 4 },
    ],
  },
  {
    id: "Loud",
    label: "Loud",
    desc: "Maximum punch and energy. EDM, Hip-Hop, Rock.",
    targetLufs: -9,
    stereo: 1.2,
    lra: 6,
    eq: [
      { freq: 60, gain: 3 },
      { freq: 250, gain: 1 },
      { freq: 1000, gain: 2 },
      { freq: 4000, gain: 2 },
      { freq: 12000, gain: 1 },
    ],
  },
  {
    id: "Balanced",
    label: "Balanced",
    desc: "Natural, transparent mastering. Works with anything.",
    targetLufs: -14,
    stereo: 1.0,
    lra: 10,
    eq: [
      { freq: 60, gain: 0 },
      { freq: 250, gain: 0 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: 0 },
      { freq: 12000, gain: 0 },
    ],
  },
];

const GENRE_PRESETS = [
  {
    id: "hiphop",
    label: "Hip-Hop",
    desc: "Heavy low-end, punchy drums, crisp vocals.",
    targetLufs: -11,
    stereo: 1.1,
    lra: 7,
    eq: [
      { freq: 60, gain: 4 },
      { freq: 250, gain: 2 },
      { freq: 1000, gain: -1 },
      { freq: 4000, gain: 2 },
      { freq: 12000, gain: 1 },
    ],
  },
  {
    id: "edm",
    label: "EDM",
    desc: "Loud, wide stereo, tight sub-bass, bright leads.",
    targetLufs: -8,
    stereo: 1.3,
    lra: 5,
    eq: [
      { freq: 60, gain: 3 },
      { freq: 250, gain: -1 },
      { freq: 1000, gain: 1 },
      { freq: 4000, gain: 3 },
      { freq: 12000, gain: 2 },
    ],
  },
  {
    id: "jazz",
    label: "Jazz",
    desc: "Warm dynamics, natural room, instrument clarity.",
    targetLufs: -16,
    stereo: 1.05,
    lra: 12,
    eq: [
      { freq: 60, gain: 1 },
      { freq: 250, gain: 2 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: -1 },
      { freq: 12000, gain: -1 },
    ],
  },
  {
    id: "classical",
    label: "Classical",
    desc: "Transparent, wide dynamic range, natural tonality.",
    targetLufs: -18,
    stereo: 1.0,
    lra: 14,
    eq: [
      { freq: 60, gain: 0 },
      { freq: 250, gain: 0 },
      { freq: 1000, gain: 0 },
      { freq: 4000, gain: 1 },
      { freq: 12000, gain: 0 },
    ],
  },
  {
    id: "pop",
    label: "Pop",
    desc: "Balanced brightness, polished vocals, radio-ready.",
    targetLufs: -14,
    stereo: 1.15,
    lra: 8,
    eq: [
      { freq: 60, gain: 1 },
      { freq: 250, gain: 0 },
      { freq: 1000, gain: 1 },
      { freq: 4000, gain: 2 },
      { freq: 12000, gain: 2 },
    ],
  },
  {
    id: "rock",
    label: "Rock",
    desc: "Gritty mids, punchy drums, full guitar presence.",
    targetLufs: -11,
    stereo: 1.1,
    lra: 8,
    eq: [
      { freq: 60, gain: 2 },
      { freq: 250, gain: 1 },
      { freq: 1000, gain: 3 },
      { freq: 4000, gain: 1 },
      { freq: 12000, gain: 0 },
    ],
  },
];

const QUALITIES = [
  { id: "Preview", label: "Preview", sublabel: "Free", desc: "MP3 128kbps" },
  { id: "HiRes", label: "Hi-Res", sublabel: "1 credit", desc: "WAV + MP3 320kbps" },
];

const LOUDNESS_TARGETS = [
  { id: "spotify", label: "Spotify", lufs: -14 },
  { id: "apple", label: "Apple", lufs: -16 },
  { id: "youtube", label: "YouTube", lufs: -13 },
  { id: "club", label: "Club", lufs: -8 },
  { id: "custom", label: "Custom", lufs: null },
];

type Step = "upload" | "preset" | "processing";
type PresetTab = "standard" | "genre";

function formatFreq(freq: number): string {
  return freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
}

function EqVisualization({ eq }: { eq: { freq: number; gain: number }[] }) {
  const maxGain = 6;
  const barHeight = 48;
  const centerY = barHeight / 2;

  return (
    <div className="flex items-end justify-center gap-3 py-2">
      {eq.map((band, i) => {
        const clampedGain = Math.max(-maxGain, Math.min(maxGain, band.gain));
        const height = Math.abs(clampedGain) * (centerY / maxGain);
        const isPositive = clampedGain >= 0;

        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: 24, height: barHeight }}>
              {/* Center line */}
              <div
                className="absolute left-0 right-0 h-px bg-zinc-700"
                style={{ top: centerY }}
              />
              {/* Bar */}
              {clampedGain !== 0 && (
                <div
                  className={`absolute left-1 right-1 rounded-sm ${
                    isPositive ? "bg-violet-500/70" : "bg-red-500/60"
                  }`}
                  style={{
                    top: isPositive ? centerY - height : centerY,
                    height: Math.max(height, 2),
                  }}
                />
              )}
            </div>
            <span className="text-[9px] text-zinc-500 font-mono">
              {formatFreq(band.freq)}
            </span>
            <span
              className={`text-[9px] font-mono ${
                clampedGain > 0
                  ? "text-violet-400"
                  : clampedGain < 0
                    ? "text-red-400"
                    : "text-zinc-600"
              }`}
            >
              {clampedGain > 0 ? "+" : ""}
              {clampedGain}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface MasteringRecommendation {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  meanLoudness: number;
  peakLevel: number;
  dynamicRange: number;
  noiseFloor: number;
  frequencyBalance: { low: number; mid: number; high: number };
  characteristics: string[];
  recommendedPreset: string;
  recommendedLufs: number;
  recommendedLoudnessTarget: string;
  deBreath: boolean;
  deNoise: boolean;
  deEss: boolean;
  lowEq: number;
  midEq: number;
  highEq: number;
  confidence: number;
  summary: string;
}

function FrequencyBalanceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-500 w-8 font-mono">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] text-zinc-400 w-8 text-right font-mono">{value}%</span>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [preset, setPreset] = useState("Balanced");
  const [presetTab, setPresetTab] = useState<PresetTab>("standard");
  const [quality, setQuality] = useState("Preview");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [creating, setCreating] = useState(false);

  // Reference track state
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refFileId, setRefFileId] = useState<string | null>(null);
  const [refUploading, setRefUploading] = useState(false);

  // Advanced mastering state
  const [loudnessTarget, setLoudnessTarget] = useState<string | null>(null);
  const [customLufs, setCustomLufs] = useState(-14);
  const [eqExpanded, setEqExpanded] = useState(false);
  const [lowEq, setLowEq] = useState(0);
  const [midEq, setMidEq] = useState(0);

  // Vocal processing
  const [deBreath, setDeBreath] = useState(false);
  const [deNoise, setDeNoise] = useState(false);
  const [deEss, setDeEss] = useState(false);
  const [highEq, setHighEq] = useState(0);

  // Recommendation state
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<MasteringRecommendation | null>(null);

  const allPresets = useMemo(
    () => [...STANDARD_PRESETS, ...GENRE_PRESETS],
    []
  );

  const selectedPreset = useMemo(
    () => allPresets.find((p) => p.id === preset) || STANDARD_PRESETS[3],
    [preset, allPresets]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleFile = async (f: File) => {
    console.log("[Upload] File selected:", f.name, "type:", f.type, "size:", f.size);

    const allowedMimes = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/x-flac", "audio/x-m4a", "audio/mp4", "audio/aac", ""];
    const allowedExts = [".wav", ".mp3", ".flac", ".m4a", ".aac", ".ogg"];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    const mimeOk = allowedMimes.includes(f.type);
    const extOk = allowedExts.includes(ext);

    if (!mimeOk && !extOk) {
      toast.error(`Unsupported: ${f.name} (type: ${f.type || "unknown"})`);
      return;
    }

    const contentType = f.type && f.type !== "application/octet-stream"
      ? f.type
      : ext === ".wav" ? "audio/wav"
      : ext === ".mp3" ? "audio/mpeg"
      : ext === ".flac" ? "audio/flac"
      : ext === ".m4a" ? "audio/mp4"
      : "audio/mpeg";
    if (f.size > 500 * 1024 * 1024) {
      toast.error("File too large (max 500MB)");
      return;
    }

    setFile(f);
    setUploading(true);
    setUploadProgress(0);

    try {
      console.log("[Upload] Step 1: init...");
      const { data: initData } = await uploadApi.init(f.name, f.size, contentType);
      console.log("[Upload] Step 1 OK, fileId:", initData.fileId);

      console.log("[Upload] Step 2: S3 PUT...");
      await axios.put(initData.uploadUrl, f, {
        headers: { "Content-Type": contentType },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      console.log("[Upload] Step 2 OK");

      console.log("[Upload] Step 3: complete...");
      await uploadApi.complete(initData.fileId);
      console.log("[Upload] Step 3 OK");

      setFileId(initData.fileId);
      setStep("preset");
      toast.success("File uploaded!");
    } catch (err: any) {
      console.error("[Upload] FAILED:", err, err?.response?.status, err?.response?.data);
      const msg = err?.response?.data?.message || err?.message || "Upload failed";
      toast.error(msg);
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRefFile = async (f: File) => {
    const allowedExts = [".wav", ".mp3", ".flac"];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    if (!allowedExts.includes(ext)) {
      toast.error("Unsupported format. Use WAV, MP3, or FLAC.");
      return;
    }

    const contentType = f.type || (ext === ".wav" ? "audio/wav" : ext === ".mp3" ? "audio/mpeg" : "audio/flac");
    if (f.size > 500 * 1024 * 1024) {
      toast.error("File too large (max 500MB)");
      return;
    }

    setRefFile(f);
    setRefUploading(true);

    try {
      const { data: initData } = await uploadApi.init(f.name, f.size, contentType);
      await axios.put(initData.uploadUrl, f, {
        headers: { "Content-Type": contentType },
      });
      await uploadApi.complete(initData.fileId);
      setRefFileId(initData.fileId);
      toast.success("Reference track uploaded!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Reference upload failed");
      setRefFile(null);
    } finally {
      setRefUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!fileId) return;
    setAnalyzing(true);
    try {
      const { data } = await recommendApi.mastering(fileId);
      setRecommendation(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyRecommendation = () => {
    if (!recommendation) return;
    const allP = [...STANDARD_PRESETS, ...GENRE_PRESETS];
    const match = allP.find((p) => p.id.toLowerCase() === recommendation.recommendedPreset.toLowerCase());
    if (match) {
      setPreset(match.id);
      setPresetTab(STANDARD_PRESETS.includes(match) ? "standard" : "genre");
    }
    if (recommendation.recommendedLoudnessTarget) {
      setLoudnessTarget(recommendation.recommendedLoudnessTarget);
    }
    if (recommendation.lowEq !== 0) setLowEq(recommendation.lowEq);
    if (recommendation.midEq !== 0) setMidEq(recommendation.midEq);
    if (recommendation.highEq !== 0) setHighEq(recommendation.highEq);
    setDeBreath(recommendation.deBreath);
    setDeNoise(recommendation.deNoise);
    setDeEss(recommendation.deEss);
    toast.success("Recommendations applied!");
  };

  const handleCreateJob = async () => {
    if (!fileId) return;
    setCreating(true);
    try {
      const payload: Record<string, any> = { fileId, preset, quality };

      if (loudnessTarget) {
        payload.loudnessTarget = loudnessTarget;
        if (loudnessTarget === "custom") payload.customLufs = customLufs;
      }
      if (lowEq !== 0) payload.lowEq = lowEq;
      if (midEq !== 0) payload.midEq = midEq;
      if (highEq !== 0) payload.highEq = highEq;
      if (deBreath) payload.deBreath = true;
      if (deNoise) payload.deNoise = true;
      if (deEss) payload.deEss = true;

      const { data: job } = await jobsApi.create(payload);
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

  const activePresets = presetTab === "standard" ? STANDARD_PRESETS : GENRE_PRESETS;

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
              accept=".wav,.mp3,.flac,.m4a,.aac,.ogg,audio/*"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFile(selected);
                e.target.value = ""; // Reset so same file can be re-selected
              }}
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


          {/* Analyze & Recommend */}
          {!recommendation && (
            <div className="mb-8">
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-3 rounded-xl font-medium text-[14px] border border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {analyzing ? "Analyzing audio..." : "Analyze & Recommend"}
              </button>
              <p className="text-[11px] text-zinc-600 text-center">
                AI analyzes your track and suggests optimal mastering settings
              </p>
            </div>
          )}

          {recommendation && (
            <div className="mb-8 bg-zinc-900/50 border border-violet-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-violet-300">AI Recommendation</p>
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                  {recommendation.confidence}% confident
                </span>
              </div>

              <p className="text-[12px] text-zinc-400 mb-4 leading-relaxed">{recommendation.summary}</p>

              {/* Characteristics */}
              {recommendation.characteristics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {recommendation.characteristics.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-[11px] font-medium text-zinc-300 border border-zinc-700/50">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Frequency Balance */}
              <div className="mb-4 space-y-1.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">Frequency Balance</p>
                <FrequencyBalanceBar label="Low" value={recommendation.frequencyBalance.low} color="#10b981" />
                <FrequencyBalanceBar label="Mid" value={recommendation.frequencyBalance.mid} color="#f59e0b" />
                <FrequencyBalanceBar label="High" value={recommendation.frequencyBalance.high} color="#3b82f6" />
              </div>

              {/* Audio Info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[11px] text-zinc-500">
                <span>Duration: <span className="text-zinc-300 font-mono">{Math.floor(recommendation.duration / 60)}:{String(Math.floor(recommendation.duration % 60)).padStart(2, "0")}</span></span>
                <span>Sample Rate: <span className="text-zinc-300 font-mono">{(recommendation.sampleRate / 1000).toFixed(1)}kHz</span></span>
                <span>Codec: <span className="text-zinc-300 font-mono uppercase">{recommendation.codec}</span></span>
                <span>Channels: <span className="text-zinc-300 font-mono">{recommendation.channels}</span></span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={applyRecommendation}
                  className="flex-1 py-2.5 rounded-lg font-medium text-[13px] text-zinc-950 transition-all"
                  style={{ background: "linear-gradient(135deg, #c4b5fd, #a78bfa)" }}
                >
                  Apply Recommendations
                </button>
                <button
                  onClick={() => setRecommendation(null)}
                  className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-2.5"
                >
                  Ignore
                </button>
              </div>
            </div>
          )}

          {/* Preset tabs */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Preset</p>
          <div className="flex items-center gap-1 mb-4 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-1 w-fit">
            <button
              onClick={() => setPresetTab("standard")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                presetTab === "standard"
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setPresetTab("genre")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                presetTab === "genre"
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Genre
            </button>
          </div>

          {/* Preset cards */}
          <div className={`grid gap-3 mb-4 ${presetTab === "genre" ? "grid-cols-3" : "grid-cols-2"}`}>
            {activePresets.map((p) => {
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

          {/* EQ Curve Visualization */}
          <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-3 mb-4">
            <p className="text-[11px] font-medium text-zinc-500 mb-1 text-center">
              EQ Curve &middot; {selectedPreset.label}
            </p>
            <EqVisualization eq={selectedPreset.eq} />
          </div>

          {/* Mastering Preview Card */}
          <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-4 mb-8">
            <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Processing Chain
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {PROCESSING_CHAIN.map((stage, i) => (
                <span key={stage.order} className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-800/80 text-[11px] font-medium text-zinc-300">
                    {stage.name}
                  </span>
                  {i < PROCESSING_CHAIN.length - 1 && (
                    <span className="text-zinc-700 text-[10px]">&rarr;</span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500">
              Target: <span className="text-zinc-300 font-mono">{selectedPreset.targetLufs} LUFS</span>
              <span className="mx-1.5">&middot;</span>
              LRA: <span className="text-zinc-300 font-mono">{selectedPreset.lra}</span>
              <span className="mx-1.5">&middot;</span>
              Stereo: <span className="text-zinc-300 font-mono">{selectedPreset.stereo}x</span>
            </p>
          </div>

          {/* Quality */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Quality</p>
          <div className="space-y-2 mb-8">
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

          {/* Loudness Target */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Loudness Target</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {LOUDNESS_TARGETS.map((t) => {
              const isSelected = loudnessTarget === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setLoudnessTarget(isSelected ? null : t.id)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                    isSelected
                      ? "border-white/80 bg-white/[0.06] text-white"
                      : "border-zinc-800/40 text-zinc-500 hover:border-zinc-700/60 hover:text-zinc-300"
                  }`}
                >
                  {t.label}
                  {t.lufs !== null && (
                    <span className="ml-1 text-zinc-600">{t.lufs}</span>
                  )}
                </button>
              );
            })}
          </div>
          {loudnessTarget === "custom" && (
            <div className="mb-6 bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-zinc-500">Custom LUFS</span>
                <span className="text-[13px] font-mono text-white">{customLufs} LUFS</span>
              </div>
              <input
                type="range"
                min={-20}
                max={-6}
                step={0.5}
                value={customLufs}
                onChange={(e) => setCustomLufs(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-zinc-600">-20</span>
                <span className="text-[10px] text-zinc-600">-6</span>
              </div>
            </div>
          )}
          {loudnessTarget !== "custom" && <div className="mb-8" />}
          {loudnessTarget === "custom" && <div className="mb-2" />}

          {/* Fine-tune EQ (collapsible) */}
          <button
            onClick={() => setEqExpanded(!eqExpanded)}
            className="flex items-center gap-2 mb-3 group"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${
                eqExpanded ? "rotate-0" : "-rotate-90"
              }`}
            />
            <span className="text-[13px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">
              Fine-tune EQ
            </span>
            {(lowEq !== 0 || midEq !== 0 || highEq !== 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
            )}
          </button>
          {eqExpanded && (
            <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-lg p-4 mb-8">
              <div className="space-y-4">
                {/* Low EQ */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-zinc-500">Low (200 Hz)</span>
                    <span className="text-[12px] font-mono text-zinc-300 w-14 text-right">
                      {lowEq > 0 ? "+" : ""}{lowEq} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={lowEq}
                    onChange={(e) => setLowEq(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                  />
                </div>
                {/* Mid EQ */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-zinc-500">Mid (2 kHz)</span>
                    <span className="text-[12px] font-mono text-zinc-300 w-14 text-right">
                      {midEq > 0 ? "+" : ""}{midEq} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={midEq}
                    onChange={(e) => setMidEq(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                  />
                </div>
                {/* High EQ */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-zinc-500">High (10 kHz)</span>
                    <span className="text-[12px] font-mono text-zinc-300 w-14 text-right">
                      {highEq > 0 ? "+" : ""}{highEq} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={highEq}
                    onChange={(e) => setHighEq(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
                  />
                </div>
              </div>
              {/* Reset button */}
              {(lowEq !== 0 || midEq !== 0 || highEq !== 0) && (
                <button
                  onClick={() => { setLowEq(0); setMidEq(0); setHighEq(0); }}
                  className="flex items-center gap-1.5 mt-3 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>
          )}
          {!eqExpanded && <div className="mb-6" />}

          {/* Vocal Processing */}
          <p className="text-[13px] font-medium text-zinc-400 mb-3">Vocal Processing</p>
          <div className="flex flex-wrap gap-3 mb-8">
            {[
              { id: "deBreath", label: "De-Breath", desc: "Remove breath sounds", state: deBreath, set: setDeBreath },
              { id: "deNoise", label: "De-Noise", desc: "Remove background noise", state: deNoise, set: setDeNoise },
              { id: "deEss", label: "De-Ess", desc: "Reduce sibilance (S sounds)", state: deEss, set: setDeEss },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => opt.set(!opt.state)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm transition ${
                  opt.state
                    ? "border-violet-500/50 bg-violet-500/10 text-white"
                    : "border-zinc-800/40 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  opt.state ? "border-violet-500 bg-violet-500" : "border-zinc-600"
                }`}>
                  {opt.state && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-zinc-600 ml-1.5 text-xs hidden sm:inline">— {opt.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Reference Track */}
          <p className="text-[13px] font-medium text-zinc-400 mb-2">Reference Track</p>
          <p className="text-[12px] text-zinc-600 mb-3">
            Optional: upload a reference track for AI-powered tonal matching
          </p>
          {refFile ? (
            <div className="flex items-center gap-3 mb-10 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-4 py-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[13px] text-zinc-300 truncate flex-1">
                {refFile.name}
              </span>
              <button
                onClick={() => {
                  setRefFile(null);
                  setRefFileId(null);
                }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() =>
                !refUploading &&
                document.getElementById("ref-file-input")?.click()
              }
              className="rounded-lg border border-dashed border-zinc-800 hover:border-zinc-700 p-6 text-center cursor-pointer transition-colors mb-10"
            >
              <input
                id="ref-file-input"
                type="file"
                accept=".wav,.mp3,.flac"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleRefFile(f);
                  if (e.target) e.target.value = "";
                }}
              />
              {refUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                  <span className="text-[12px] text-zinc-500">Uploading...</span>
                </div>
              ) : (
                <p className="text-[12px] text-zinc-600">
                  Drop or click to upload reference
                </p>
              )}
            </div>
          )}

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
