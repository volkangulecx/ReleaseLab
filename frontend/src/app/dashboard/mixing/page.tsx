"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Wand2,
  Download,
  Copy,
  Music2,
  Calendar,
  Search,
  X as XIcon,
} from "lucide-react";
import { mixApi, uploadApi, recommendApi } from "@/lib/api";
import axios from "axios";

/* ── Types ──────────────────────────────────────────── */

interface MixFile {
  id: string;
  s3Key: string;
  format: string;
  durationSec: number;
}

interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  eqPreset: string;
  lowGain: number;
  midGain: number;
  highGain: number;
  reverbAmount: number;
  compressorThreshold: number;
  file?: MixFile;
}

interface Project {
  id: string;
  name: string;
  status: string;
  trackCount?: number;
  createdAt?: string;
  tracks?: Track[];
}

interface EqPresetOption {
  id: string;
  name: string;
  low: number;
  mid: number;
  high: number;
}

const TRACK_COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

const DEFAULT_EQ_PRESETS: EqPresetOption[] = [
  { id: "", name: "None", low: 0, mid: 0, high: 0 },
  { id: "vocal", name: "Vocal", low: -2, mid: 3, high: 2 },
  { id: "drums", name: "Drums", low: 4, mid: -1, high: 3 },
  { id: "bass", name: "Bass", low: 6, mid: -2, high: -3 },
  { id: "guitar", name: "Guitar", low: -1, mid: 4, high: 1 },
  { id: "keys", name: "Keys", low: -2, mid: 2, high: 4 },
  { id: "bright", name: "Bright", low: -3, mid: 0, high: 6 },
  { id: "warm", name: "Warm", low: 4, mid: 1, high: -4 },
];

/* ── Channel Strip ──────────────────────────────────── */

function ChannelStrip({
  track,
  projectId,
  onUpdate,
  onDelete,
}: {
  track: Track;
  projectId: string;
  onUpdate: (trackId: string, data: Partial<Track>) => void;
  onDelete: (trackId: string) => void;
}) {
  const [name, setName] = useState(track.name);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Sync name from prop when track changes externally (e.g. auto-mix)
  useEffect(() => {
    setName(track.name);
  }, [track.name]);

  const debouncedUpdate = useCallback(
    (field: string, data: Partial<Track>) => {
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      debounceTimers.current[field] = setTimeout(() => {
        onUpdate(track.id, data);
      }, 300);
    },
    [onUpdate, track.id]
  );

  const handleNameChange = (val: string) => {
    setName(val);
    debouncedUpdate("name", { name: val });
  };

  const handleEqPresetChange = (presetId: string) => {
    const preset = DEFAULT_EQ_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onUpdate(track.id, {
        eqPreset: presetId,
        lowGain: preset.low,
        midGain: preset.mid,
        highGain: preset.high,
      });
    } else {
      onUpdate(track.id, { eqPreset: presetId });
    }
  };

  const volumePercent = Math.round((track.volume ?? 1) * 100);
  const panValue = Math.round((track.pan ?? 0) * 100);
  const lowGain = track.lowGain ?? 0;
  const midGain = track.midGain ?? 0;
  const highGain = track.highGain ?? 0;
  const trackColor = track.color || TRACK_COLORS[0];

  const panLabel =
    panValue === 0 ? "C" : panValue < 0 ? `${Math.abs(panValue)}L` : `${panValue}R`;

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/50 rounded-xl p-4 w-[200px] shrink-0 flex flex-col gap-3 relative group">
      {/* Color indicator */}
      <div
        className="absolute top-0 left-3 right-3 h-1 rounded-b-full"
        style={{ backgroundColor: trackColor }}
      />

      {/* Track name */}
      <div className="pt-1">
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-[13px] text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors text-center font-medium"
        />
      </div>

      {/* EQ Preset */}
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1 block">
          EQ Preset
        </label>
        <select
          value={track.eqPreset || ""}
          onChange={(e) => handleEqPresetChange(e.target.value)}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[12px] text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors appearance-none cursor-pointer"
        >
          {DEFAULT_EQ_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3-band EQ */}
      <div className="space-y-2">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block">
          EQ
        </label>

        {/* Low */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 w-4 font-mono">L</span>
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={lowGain}
            onChange={(e) => {
              const val = Number(e.target.value);
              debouncedUpdate("lowGain", { lowGain: val });
            }}
            className="flex-1 accent-emerald-500 h-1 cursor-pointer"
          />
          <span className="text-[10px] text-zinc-400 w-8 text-right tabular-nums font-mono">
            {lowGain > 0 ? "+" : ""}
            {lowGain}
          </span>
        </div>

        {/* Mid */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 w-4 font-mono">M</span>
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={midGain}
            onChange={(e) => {
              const val = Number(e.target.value);
              debouncedUpdate("midGain", { midGain: val });
            }}
            className="flex-1 accent-amber-500 h-1 cursor-pointer"
          />
          <span className="text-[10px] text-zinc-400 w-8 text-right tabular-nums font-mono">
            {midGain > 0 ? "+" : ""}
            {midGain}
          </span>
        </div>

        {/* High */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-500 w-4 font-mono">H</span>
          <input
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={highGain}
            onChange={(e) => {
              const val = Number(e.target.value);
              debouncedUpdate("highGain", { highGain: val });
            }}
            className="flex-1 accent-sky-500 h-1 cursor-pointer"
          />
          <span className="text-[10px] text-zinc-400 w-8 text-right tabular-nums font-mono">
            {highGain > 0 ? "+" : ""}
            {highGain}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/60" />

      {/* Volume */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
            Volume
          </label>
          <span className="text-[11px] text-zinc-300 tabular-nums font-mono font-medium">
            {volumePercent}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          value={volumePercent}
          onChange={(e) => {
            const val = Number(e.target.value) / 100;
            debouncedUpdate("volume", { volume: val });
          }}
          className="w-full accent-violet-500 h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
          <span>0</span>
          <span>100</span>
          <span>200</span>
        </div>
      </div>

      {/* Pan */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
            Pan
          </label>
          <span className="text-[11px] text-zinc-300 tabular-nums font-mono font-medium">
            {panLabel}
          </span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          value={panValue}
          onChange={(e) => {
            const val = Number(e.target.value) / 100;
            debouncedUpdate("pan", { pan: val });
          }}
          className="w-full accent-violet-500 h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
          <span>L</span>
          <span>C</span>
          <span>R</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/60" />

      {/* Mute / Solo */}
      <div className="flex gap-2">
        <button
          onClick={() => onUpdate(track.id, { muted: !track.muted })}
          className={`flex-1 h-9 rounded-lg text-[12px] font-bold transition-all ${
            track.muted
              ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
              : "bg-zinc-800/60 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600"
          }`}
        >
          M
        </button>
        <button
          onClick={() => onUpdate(track.id, { solo: !track.solo })}
          className={`flex-1 h-9 rounded-lg text-[12px] font-bold transition-all ${
            track.solo
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
              : "bg-zinc-800/60 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300 hover:border-zinc-600"
          }`}
        >
          S
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(track.id)}
        className="w-full h-8 rounded-lg bg-zinc-800/40 border border-zinc-800/50 text-zinc-600 hover:text-red-400 hover:border-red-500/30 transition-all flex items-center justify-center gap-1.5 text-[11px]"
      >
        <Trash2 className="w-3 h-3" />
        Remove
      </button>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────── */

interface MixingTrackRecommendation {
  name: string;
  role: string;
  meanLoudness: number;
  recommendedVolume: number;
  recommendedPan: number;
  recommendedEqPreset: string;
  frequencyBalance: { low: number; mid: number; high: number };
}

interface MixingRecommendation {
  tracks: MixingTrackRecommendation[];
  summary: string;
}

export default function MixingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoMixing, setAutoMixing] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [analyzingMix, setAnalyzingMix] = useState(false);
  const [mixRecommendation, setMixRecommendation] = useState<MixingRecommendation | null>(null);
  const [showMixRecommendation, setShowMixRecommendation] = useState(false);

  /* ── Fetch projects ── */
  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await mixApi.listProjects();
      setProjects(data);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /* ── Select project ── */
  const openProject = async (id: string) => {
    setLoadingProject(true);
    try {
      const { data } = await mixApi.getProject(id);
      setSelectedProject(data);
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoadingProject(false);
    }
  };

  /* ── Create project ── */
  const handleCreateProject = async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    setCreatingProject(true);
    try {
      const { data } = await mixApi.createProject(trimmed);
      setNewProjectName("");
      setShowNewInput(false);
      await fetchProjects();
      openProject(data.id);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  /* ── Duplicate project ── */
  const handleDuplicateProject = async (projectId: string) => {
    setDuplicating(projectId);
    try {
      await mixApi.duplicateProject(projectId);
      await fetchProjects();
      toast.success("Project duplicated");
    } catch {
      toast.error("Failed to duplicate project");
    } finally {
      setDuplicating(null);
    }
  };

  /* ── Delete project ── */
  const handleDeleteProject = async (projectId: string) => {
    setDeleting(projectId);
    try {
      await mixApi.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(null);
    }
  };

  /* ── Add track (upload file) ── */
  const handleAddTrack = async (file: File) => {
    if (!selectedProject) return;
    setUploadingTrack(true);

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const contentType =
      file.type ||
      (ext === ".wav"
        ? "audio/wav"
        : ext === ".mp3"
        ? "audio/mpeg"
        : "audio/flac");

    try {
      const { data: initData } = await uploadApi.init(
        file.name,
        file.size,
        contentType
      );

      await axios.put(initData.uploadUrl, file, {
        headers: { "Content-Type": contentType },
      });

      await uploadApi.complete(initData.fileId);
      await mixApi.addTrack(selectedProject.id, initData.fileId, file.name);

      const { data: updated } = await mixApi.getProject(selectedProject.id);
      setSelectedProject(updated);
      toast.success("Track added");
    } catch {
      toast.error("Failed to add track");
    } finally {
      setUploadingTrack(false);
    }
  };

  /* ── Update track ── */
  const handleUpdateTrack = useCallback(
    async (trackId: string, data: Partial<Track>) => {
      if (!selectedProject) return;
      try {
        await mixApi.updateTrack(selectedProject.id, trackId, data);
        setSelectedProject((prev) => {
          if (!prev || !prev.tracks) return prev;
          return {
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.id === trackId ? { ...t, ...data } : t
            ),
          };
        });
      } catch {
        toast.error("Failed to update track");
      }
    },
    [selectedProject]
  );

  /* ── Delete track ── */
  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      if (!selectedProject) return;
      try {
        await mixApi.deleteTrack(selectedProject.id, trackId);
        setSelectedProject((prev) => {
          if (!prev || !prev.tracks) return prev;
          return {
            ...prev,
            tracks: prev.tracks.filter((t) => t.id !== trackId),
          };
        });
        toast.success("Track removed");
      } catch {
        toast.error("Failed to delete track");
      }
    },
    [selectedProject]
  );

  /* ── Export Mixdown ── */
  const handleExport = async () => {
    if (!selectedProject) return;
    setExporting(true);
    try {
      const { data } = await mixApi.exportMixdown(selectedProject.id);
      window.open(data.downloadUrl, "_blank");
      toast.success("Mixdown exported");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  /* ── Auto Mix ── */
  const handleAutoMix = async () => {
    if (!selectedProject) return;
    setAutoMixing(true);
    try {
      const { data } = await mixApi.autoMix(selectedProject.id);
      if (data.tracks && Array.isArray(data.tracks)) {
        setSelectedProject((prev) => {
          if (!prev || !prev.tracks) return prev;
          return {
            ...prev,
            tracks: prev.tracks.map((t) => {
              const updated = data.tracks.find((u: any) => u.id === t.id);
              if (updated) {
                return {
                  ...t,
                  volume: updated.volume ?? t.volume,
                  pan: updated.pan ?? t.pan,
                  lowGain: updated.lowGain ?? t.lowGain,
                  midGain: updated.midGain ?? t.midGain,
                  highGain: updated.highGain ?? t.highGain,
                  eqPreset: updated.eqPreset ?? t.eqPreset,
                };
              }
              return t;
            }),
          };
        });
      }
      toast.success("Auto-mix applied");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Auto-mix failed");
    } finally {
      setAutoMixing(false);
    }
  };

  /* ── Analyze Tracks ── */
  const handleAnalyzeTracks = async () => {
    if (!selectedProject) return;
    setAnalyzingMix(true);
    try {
      const { data } = await recommendApi.mixing(selectedProject.id);
      setMixRecommendation(data);
      setShowMixRecommendation(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Analysis failed");
    } finally {
      setAnalyzingMix(false);
    }
  };

  const applyMixRecommendations = async () => {
    if (!selectedProject || !mixRecommendation) return;
    const tracks = selectedProject.tracks || [];
    try {
      for (const rec of mixRecommendation.tracks) {
        const track = tracks.find((t) => t.name.toLowerCase() === rec.name.toLowerCase());
        if (track) {
          const eqPreset = DEFAULT_EQ_PRESETS.find((p) => p.id === rec.recommendedEqPreset);
          const updateData: Partial<Track> = {
            volume: rec.recommendedVolume,
            pan: rec.recommendedPan,
          };
          if (eqPreset) {
            updateData.eqPreset = eqPreset.id;
            updateData.lowGain = eqPreset.low;
            updateData.midGain = eqPreset.mid;
            updateData.highGain = eqPreset.high;
          }
          await handleUpdateTrack(track.id, updateData);
        }
      }
      setShowMixRecommendation(false);
      toast.success("Mix recommendations applied!");
    } catch {
      toast.error("Failed to apply recommendations");
    }
  };

  /* ════════════════════════════════════════════════════
     VIEW 2: MIXER
     ════════════════════════════════════════════════════ */
  if (selectedProject) {
    const tracks = selectedProject.tracks || [];

    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <button
            onClick={() => {
              setSelectedProject(null);
              fetchProjects();
            }}
            className="w-9 h-9 rounded-lg bg-zinc-900/50 border border-zinc-800/40 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-white truncate">
              {selectedProject.name}
            </h1>
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
              {selectedProject.status}
              {tracks.length > 0 && (
                <span className="ml-2 normal-case tracking-normal">
                  {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAnalyzeTracks}
              disabled={analyzingMix || tracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-zinc-900/50 border border-violet-500/30 text-violet-300 hover:text-violet-200 hover:border-violet-500/50 transition-colors disabled:opacity-40"
            >
              {analyzingMix ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {analyzingMix ? "Analyzing..." : "Analyze Tracks"}
            </button>
            <button
              onClick={handleAutoMix}
              disabled={autoMixing || tracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-zinc-900/50 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-40"
            >
              {autoMixing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {autoMixing ? "Mixing..." : "Auto Mix"}
            </button>

            <button
              onClick={handleExport}
              disabled={exporting || tracks.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-zinc-950 disabled:opacity-40 transition-all"
              style={{
                background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
              }}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {exporting ? "Exporting..." : "Export Mixdown"}
            </button>
          </div>
        </div>

        {/* Mixer console */}
        {loadingProject ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : tracks.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto pb-4">
            <div className="flex gap-3 items-stretch min-w-min">
              {tracks.map((track) => (
                <ChannelStrip
                  key={track.id}
                  track={track}
                  projectId={selectedProject.id}
                  onUpdate={handleUpdateTrack}
                  onDelete={handleDeleteTrack}
                />
              ))}

              {/* Add Track button as last strip */}
              <button
                onClick={() =>
                  !uploadingTrack &&
                  document.getElementById("track-file-input")?.click()
                }
                disabled={uploadingTrack}
                className="w-[200px] shrink-0 rounded-xl border-2 border-dashed border-zinc-800/60 hover:border-zinc-700/80 bg-zinc-900/20 hover:bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:text-zinc-300 transition-all min-h-[400px] disabled:opacity-50"
              >
                {uploadingTrack ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
                <span className="text-[13px] font-medium">
                  {uploadingTrack ? "Uploading..." : "Add Track"}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Music2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-[14px] mb-4">
                No tracks yet. Upload an audio file to get started.
              </p>
              <button
                onClick={() =>
                  !uploadingTrack &&
                  document.getElementById("track-file-input")?.click()
                }
                disabled={uploadingTrack}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-zinc-950 mx-auto transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
                }}
              >
                {uploadingTrack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploadingTrack ? "Uploading..." : "Add Track"}
              </button>
            </div>
          </div>
        )}


        {/* Mix Recommendation Modal */}
        {showMixRecommendation && mixRecommendation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-white">Track Analysis</h3>
                <button
                  onClick={() => setShowMixRecommendation(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[12px] text-zinc-400 mb-5 leading-relaxed">{mixRecommendation.summary}</p>

              <div className="space-y-3 mb-5">
                {mixRecommendation.tracks.map((rec, i) => (
                  <div key={i} className="bg-zinc-900/70 border border-zinc-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-zinc-200">{rec.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium capitalize">{rec.role}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
                      <div>
                        <span className="text-zinc-500">Volume</span>
                        <p className="text-zinc-300 font-mono">{Math.round(rec.recommendedVolume * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">Pan</span>
                        <p className="text-zinc-300 font-mono">{rec.recommendedPan === 0 ? "C" : rec.recommendedPan < 0 ? `${Math.abs(Math.round(rec.recommendedPan * 100))}L` : `${Math.round(rec.recommendedPan * 100)}R`}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500">EQ Preset</span>
                        <p className="text-zinc-300 font-mono capitalize">{rec.recommendedEqPreset || "None"}</p>
                      </div>
                    </div>
                    {/* Freq balance bars */}
                    <div className="space-y-1">
                      {(["low", "mid", "high"] as const).map((band) => {
                        const colors = { low: "#10b981", mid: "#f59e0b", high: "#3b82f6" };
                        const val = rec.frequencyBalance[band];
                        return (
                          <div key={band} className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 w-6 font-mono capitalize">{band[0].toUpperCase()}</span>
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: colors[band] }} />
                            </div>
                            <span className="text-[10px] text-zinc-500 w-6 text-right font-mono">{val}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={applyMixRecommendations}
                  className="flex-1 py-2.5 rounded-lg font-medium text-[13px] text-zinc-950 transition-all"
                  style={{ background: "linear-gradient(135deg, #c4b5fd, #a78bfa)" }}
                >
                  Apply All Recommendations
                </button>
                <button
                  onClick={() => setShowMixRecommendation(false)}
                  className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-2.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          id="track-file-input"
          type="file"
          accept=".wav,.mp3,.flac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAddTrack(f);
            e.target.value = "";
          }}
        />

        {/* Bottom action bar */}
        {tracks.length > 0 && (
          <div className="shrink-0 mt-4 pt-4 border-t border-zinc-800/40 flex items-center justify-between">
            <div className="text-[12px] text-zinc-600">
              {tracks.filter((t) => t.muted).length > 0 && (
                <span className="text-red-400/70 mr-3">
                  {tracks.filter((t) => t.muted).length} muted
                </span>
              )}
              {tracks.filter((t) => t.solo).length > 0 && (
                <span className="text-amber-400/70">
                  {tracks.filter((t) => t.solo).length} solo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoMix}
                disabled={autoMixing || tracks.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-zinc-900/50 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors disabled:opacity-40"
              >
                {autoMixing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Auto Mix
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || tracks.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-zinc-950 disabled:opacity-40 transition-all"
                style={{
                  background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
                }}
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export Mixdown
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════
     VIEW 1: PROJECT LIST
     ════════════════════════════════════════════════════ */
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-white">Mixing Projects</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Create and manage your mix sessions
          </p>
        </div>
        {!showNewInput && (
          <button
            onClick={() => setShowNewInput(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-zinc-950 transition-all"
            style={{
              background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
            }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* New project input */}
      {showNewInput && (
        <div className="flex items-center gap-3 mb-6 bg-zinc-900/30 border border-zinc-800/40 rounded-xl p-4">
          <input
            type="text"
            placeholder="Project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            autoFocus
            className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            onClick={handleCreateProject}
            disabled={creatingProject || !newProjectName.trim()}
            className="px-5 py-2.5 rounded-lg text-[13px] font-medium text-zinc-950 disabled:opacity-50 transition-all"
            style={{
              background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
            }}
          >
            {creatingProject ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Create"
            )}
          </button>
          <button
            onClick={() => {
              setShowNewInput(false);
              setNewProjectName("");
            }}
            className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors px-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Project cards */}
      {loadingList ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <Music2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-[14px] mb-1">
            No mixing projects yet.
          </p>
          <p className="text-zinc-600 text-[13px]">
            Create one to get started with mixing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5 hover:border-zinc-700/60 hover:bg-white/[0.02] transition-colors group"
            >
              <div className="flex items-center gap-4">
                {/* Project info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-zinc-200 mb-1.5 truncate">
                    {project.name}
                  </p>
                  <div className="flex items-center gap-3 text-[12px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Music2 className="w-3 h-3" />
                      {project.trackCount ?? 0}{" "}
                      {(project.trackCount ?? 0) === 1 ? "track" : "tracks"}
                    </span>
                    <span className="text-zinc-700">&middot;</span>
                    <span className="uppercase tracking-wider">
                      {project.status}
                    </span>
                    {project.createdAt && (
                      <>
                        <span className="text-zinc-700">&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openProject(project.id)}
                    className="px-4 py-2 rounded-lg text-[12px] font-medium bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateProject(project.id);
                    }}
                    disabled={duplicating === project.id}
                    className="w-9 h-9 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors flex items-center justify-center disabled:opacity-50"
                    title="Duplicate"
                  >
                    {duplicating === project.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    disabled={deleting === project.id}
                    className="w-9 h-9 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-colors flex items-center justify-center disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === project.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
