"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { mixApi, uploadApi } from "@/lib/api";
import axios from "axios";

/* ── Types ─────────────────────────────────────── */

interface MixFile {
  id: string;
  s3Key: string;
  format: string;
  durationSec: number;
}

interface Track {
  id: string;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
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

/* ── Track Row ─────────────────────────────────── */

function TrackRow({
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
  const nameTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (nameTimeout.current) clearTimeout(nameTimeout.current);
    nameTimeout.current = setTimeout(() => {
      onUpdate(track.id, { name: val });
    }, 600);
  };

  const volumePercent = Math.round((track.volume ?? 1) * 100);

  return (
    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-4">
      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-1.5 text-[13px] text-zinc-200 w-36 shrink-0 focus:outline-none focus:border-zinc-600 transition-colors"
      />

      {/* Volume */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[11px] text-zinc-500 w-8 shrink-0">Vol</span>
        <input
          type="range"
          min={0}
          max={200}
          value={volumePercent}
          onChange={(e) =>
            onUpdate(track.id, { volume: Number(e.target.value) / 100 })
          }
          className="flex-1 accent-violet-500 h-1.5 cursor-pointer"
        />
        <span className="text-[11px] text-zinc-400 w-10 text-right tabular-nums">
          {volumePercent}%
        </span>
      </div>

      {/* Pan */}
      <div className="flex items-center gap-2 w-44 shrink-0">
        <span className="text-[11px] text-zinc-500 w-5">L</span>
        <input
          type="range"
          min={-100}
          max={100}
          value={Math.round((track.pan ?? 0) * 100)}
          onChange={(e) =>
            onUpdate(track.id, { pan: Number(e.target.value) / 100 })
          }
          className="flex-1 accent-violet-500 h-1.5 cursor-pointer"
        />
        <span className="text-[11px] text-zinc-500 w-5 text-right">R</span>
        <span className="text-[11px] text-zinc-400 w-8 text-right tabular-nums">
          {Math.round((track.pan ?? 0) * 100)}
        </span>
      </div>

      {/* Mute */}
      <button
        onClick={() => onUpdate(track.id, { muted: !track.muted })}
        className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-colors shrink-0 ${
          track.muted
            ? "bg-red-500/20 text-red-400 border border-red-500/40"
            : "bg-zinc-800/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300"
        }`}
      >
        M
      </button>

      {/* Solo */}
      <button
        onClick={() => onUpdate(track.id, { solo: !track.solo })}
        className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-colors shrink-0 ${
          track.solo
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : "bg-zinc-800/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300"
        }`}
      >
        S
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(track.id)}
        className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/40 transition-colors shrink-0 flex items-center justify-center"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────── */

export default function MixingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProject, setLoadingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);

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

      // Refresh project
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
  const handleUpdateTrack = async (
    trackId: string,
    data: Partial<Track>
  ) => {
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
  };

  /* ── Delete track ── */
  const handleDeleteTrack = async (trackId: string) => {
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
  };

  /* ── Mixer View ── */
  if (selectedProject) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => {
              setSelectedProject(null);
              fetchProjects();
            }}
            className="w-8 h-8 rounded-lg bg-zinc-900/50 border border-zinc-800/40 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold text-white truncate">
            {selectedProject.name}
          </h1>
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
            {selectedProject.status}
          </span>
        </div>

        {/* Add Track */}
        <div className="mb-6">
          <button
            onClick={() =>
              !uploadingTrack &&
              document.getElementById("track-file-input")?.click()
            }
            disabled={uploadingTrack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-zinc-700/60 hover:border-zinc-600 text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {uploadingTrack ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploadingTrack ? "Uploading..." : "Add Track"}
          </button>
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
        </div>

        {/* Tracks */}
        {loadingProject ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : selectedProject.tracks && selectedProject.tracks.length > 0 ? (
          <div className="space-y-2">
            {selectedProject.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                projectId={selectedProject.id}
                onUpdate={handleUpdateTrack}
                onDelete={handleDeleteTrack}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-[13px]">
              No tracks yet. Add an audio file to get started.
            </p>
          </div>
        )}

        {/* Export button */}
        <div className="mt-8">
          <button
            onClick={() => toast("Coming soon", { icon: "🔜" })}
            className="w-full py-3.5 rounded-xl font-medium text-[14px] bg-zinc-800/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Export Mixdown
          </button>
        </div>
      </div>
    );
  }

  /* ── Project List View ── */
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold text-white">Mixing Projects</h1>
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
        <div className="flex items-center gap-3 mb-6">
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
            className="px-4 py-2.5 rounded-lg text-[13px] font-medium text-zinc-950 disabled:opacity-50 transition-all"
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
            className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
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
          <p className="text-zinc-500 text-[13px]">
            No mixing projects yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => openProject(project.id)}
              className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5 text-left hover:border-zinc-700/60 hover:bg-white/[0.02] transition-colors"
            >
              <p className="text-[14px] font-medium text-zinc-200 mb-1 truncate">
                {project.name}
              </p>
              <div className="flex items-center gap-3 text-[12px] text-zinc-500">
                <span>
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
                    <span>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
