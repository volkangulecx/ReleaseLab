"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Upload, Loader2, Check, X, Mic, Drum, Guitar, Music } from "lucide-react";
import { uploadApi } from "@/lib/api";
import axios from "axios";

const STEM_CARDS = [
  { key: "vocals", label: "Vocals", icon: Mic, color: "violet" },
  { key: "drums", label: "Drums", icon: Drum, color: "amber" },
  { key: "bass", label: "Bass", icon: Guitar, color: "emerald" },
  { key: "other", label: "Other", icon: Music, color: "sky" },
] as const;

export default function StemsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleFile = async (f: File) => {
    const allowedExts = [".wav", ".mp3", ".flac"];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    if (!allowedExts.includes(ext)) {
      toast.error("Unsupported format. Use WAV, MP3, or FLAC.");
      return;
    }

    const contentType =
      f.type ||
      (ext === ".wav"
        ? "audio/wav"
        : ext === ".mp3"
        ? "audio/mpeg"
        : "audio/flac");

    if (f.size > 500 * 1024 * 1024) {
      toast.error("File too large (max 500MB)");
      return;
    }

    setFile(f);
    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: initData } = await uploadApi.init(f.name, f.size, contentType);

      await axios.put(initData.uploadUrl, f, {
        headers: { "Content-Type": contentType },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      await uploadApi.complete(initData.fileId);
      setFileId(initData.fileId);
      toast.success("File uploaded!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Upload failed");
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSeparate = () => {
    setProcessing(true);
    // This would call the AI worker queue. For now just show UI state.
    toast("Processing would be queued to AI Worker (GPU required)", {
      icon: "\u2139\ufe0f",
      duration: 4000,
    });
    // Simulate a brief delay then show the result cards
    setTimeout(() => setProcessing(false), 2000);
  };

  const colorMap: Record<string, string> = {
    violet: "border-violet-500/30 bg-violet-500/5 text-violet-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-400",
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold text-white mb-8">Stem Separation</h1>

      {/* Upload area */}
      {!fileId ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() =>
            !uploading && document.getElementById("stem-file-input")?.click()
          }
          className="relative rounded-xl border border-dashed border-zinc-700/60 hover:border-zinc-600 p-16 text-center cursor-pointer transition-colors"
        >
          <input
            id="stem-file-input"
            type="file"
            accept=".wav,.mp3,.flac"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              if (e.target) e.target.value = "";
            }}
          />

          {uploading ? (
            <div>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800 rounded-t-xl overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-white font-medium mb-1">
                Uploading... {uploadProgress}%
              </p>
              <p className="text-zinc-500 text-sm truncate max-w-xs mx-auto">
                {file?.name}
              </p>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-300 font-medium mb-1">
                Drop audio file or click to browse
              </p>
              <p className="text-zinc-600 text-sm">
                WAV, MP3, or FLAC up to 500 MB
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Uploaded file */}
          <div className="flex items-center gap-3 mb-6 bg-zinc-900/50 border border-zinc-800/40 rounded-xl px-4 py-3">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[13px] text-zinc-300 truncate flex-1">
              {file?.name}
            </span>
            <button
              onClick={() => {
                setFile(null);
                setFileId(null);
              }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Separate button */}
          <button
            onClick={handleSeparate}
            disabled={processing}
            className="w-full py-3.5 rounded-xl font-medium text-[14px] text-zinc-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-8"
            style={{
              background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
            }}
          >
            {processing && <Loader2 className="w-4 h-4 animate-spin" />}
            {processing ? "Processing..." : "Separate Stems"}
          </button>

          {/* Result cards */}
          <p className="text-[13px] font-medium text-zinc-400 mb-4">
            Output Stems
          </p>
          <div className="grid grid-cols-2 gap-3">
            {STEM_CARDS.map((stem) => {
              const Icon = stem.icon;
              return (
                <div
                  key={stem.key}
                  className={`rounded-xl border p-5 ${colorMap[stem.color]}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon className="w-5 h-5" />
                    <span className="text-[14px] font-semibold">
                      {stem.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-500 mb-4">
                    Coming soon — requires AI Worker
                  </p>
                  <button
                    disabled
                    className="w-full py-2 rounded-lg text-[12px] font-medium bg-zinc-800/60 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                  >
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
