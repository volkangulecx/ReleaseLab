"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Loader2,
  Save,
  CalendarClock,
  Send,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { releaseApi } from "@/lib/api";
import axios from "axios";

const GENRES = [
  "Hip-Hop",
  "EDM",
  "Jazz",
  "Classical",
  "Pop",
  "Rock",
  "Other",
];
const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Japanese",
  "Korean",
  "Turkish",
  "Other",
];
const DISTRIBUTORS = ["ReleaseLab", "DistroKid", "TuneCore"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

const PLATFORMS = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "youtube", label: "YouTube" },
  { key: "amazonMusic", label: "Amazon Music" },
  { key: "tidal", label: "Tidal" },
  { key: "deezer", label: "Deezer" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700/40 text-zinc-300",
  scheduled: "bg-blue-500/20 text-blue-400",
  submitted: "bg-amber-500/20 text-amber-400",
  live: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
        checked ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function ReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingArt, setUploadingArt] = useState(false);

  const [release, setRelease] = useState<any>(null);
  const [form, setForm] = useState({
    title: "",
    artist: "",
    album: "",
    genre: "",
    year: "",
    language: "",
    isrc: "",
    upc: "",
    copyright: "",
    description: "",
    scheduledReleaseDate: "",
    distributor: "",
    spotify: true,
    appleMusic: true,
    youtube: true,
    amazonMusic: true,
    tidal: true,
    deezer: true,
  });

  const fetchRelease = useCallback(async () => {
    try {
      const { data } = await releaseApi.get(id);
      setRelease(data);
      setForm({
        title: data.title || "",
        artist: data.artist || "",
        album: data.album || "",
        genre: data.genre || "",
        year: data.year ? String(data.year) : "",
        language: data.language || "",
        isrc: data.isrc || "",
        upc: data.upc || "",
        copyright: data.copyright || "",
        description: data.description || "",
        scheduledReleaseDate: data.scheduledReleaseDate
          ? data.scheduledReleaseDate.split("T")[0]
          : "",
        distributor: data.distributor || "",
        spotify: data.spotify ?? true,
        appleMusic: data.appleMusic ?? true,
        youtube: data.youtube ?? true,
        amazonMusic: data.amazonMusic ?? true,
        tidal: data.tidal ?? true,
        deezer: data.deezer ?? true,
      });
    } catch {
      toast.error("Failed to load release");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRelease();
  }, [fetchRelease]);

  const update = (field: string, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.year) payload.year = Number(payload.year);
      else delete payload.year;
      if (!payload.scheduledReleaseDate) delete payload.scheduledReleaseDate;
      if (!payload.distributor) delete payload.distributor;
      await releaseApi.update(id, payload);
      toast.success("Changes saved");
      fetchRelease();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!form.scheduledReleaseDate) {
      toast.error("Set a release date first");
      return;
    }
    setScheduling(true);
    try {
      await releaseApi.schedule(
        id,
        form.scheduledReleaseDate,
        form.distributor || undefined
      );
      toast.success("Release scheduled");
      fetchRelease();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to schedule");
    } finally {
      setScheduling(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      toast.error("Title and artist are required");
      return;
    }
    setSubmitting(true);
    try {
      await releaseApi.submit(id);
      toast.success("Submitted for distribution");
      fetchRelease();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArtworkUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setUploadingArt(true);
    try {
      const { data } = await releaseApi.uploadArtwork(id);
      await axios.put(data.uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });
      await releaseApi.update(id, { artworkS3Key: data.s3Key });
      toast.success("Artwork uploaded");
      fetchRelease();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Artwork upload failed");
    } finally {
      setUploadingArt(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!release) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Release not found</p>
      </div>
    );
  }

  const status = (release.status || "draft").toLowerCase();
  const inputClass =
    "w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors";
  const labelClass = "block text-[12px] font-medium text-zinc-400 mb-1.5";

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push("/dashboard/releases")}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">
            {release.title}
          </h1>
          <p className="text-[12px] text-zinc-500">{release.artist}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider shrink-0 ${
            STATUS_COLORS[status] || STATUS_COLORS.draft
          }`}
        >
          {status}
        </span>
      </div>

      <div className="space-y-6">
        {/* Section 1 -- Track Info */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-zinc-300 mb-4">
            Track Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Artist *</label>
              <input
                type="text"
                value={form.artist}
                onChange={(e) => update("artist", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Album</label>
              <input
                type="text"
                value={form.album}
                onChange={(e) => update("album", e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Genre</label>
              <select
                value={form.genre}
                onChange={(e) => update("genre", e.target.value)}
                className={inputClass}
              >
                <option value="">Select genre</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Year</label>
              <select
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                className={inputClass}
              >
                <option value="">Select year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Language</label>
              <select
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
                className={inputClass}
              >
                <option value="">Select language</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2 -- Metadata */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-zinc-300 mb-4">
            Metadata
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ISRC</label>
              <input
                type="text"
                value={form.isrc}
                onChange={(e) => update("isrc", e.target.value)}
                placeholder="XX-XXX-XX-XXXXX"
                className={inputClass}
              />
              <p className="text-[11px] text-zinc-600 mt-1">
                Format: XX-XXX-XX-XXXXX
              </p>
            </div>
            <div>
              <label className={labelClass}>UPC</label>
              <input
                type="text"
                value={form.upc}
                onChange={(e) => update("upc", e.target.value)}
                placeholder="UPC barcode"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Copyright</label>
              <input
                type="text"
                value={form.copyright}
                onChange={(e) => update("copyright", e.target.value)}
                placeholder="e.g. 2026 Your Label"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={3}
                placeholder="Release notes or description"
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Section 3 -- Artwork */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-zinc-300 mb-4">
            Artwork
          </h2>
          <div className="flex items-start gap-5">
            {release.artworkUrl ? (
              <img
                src={release.artworkUrl}
                alt="Cover art"
                className="w-32 h-32 rounded-xl object-cover shrink-0 border border-zinc-800/40"
              />
            ) : (
              <div className="w-32 h-32 rounded-xl bg-zinc-800/40 border border-zinc-700/40 border-dashed flex items-center justify-center shrink-0">
                <ImageIcon className="w-8 h-8 text-zinc-700" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-[12px] text-zinc-500 mb-3">
                Recommended: 3000 x 3000 px, JPG or PNG
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium bg-zinc-800/50 border border-zinc-700/40 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors cursor-pointer">
                {uploadingArt ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploadingArt ? "Uploading..." : "Upload Artwork"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleArtworkUpload(f);
                    if (e.target) e.target.value = "";
                  }}
                  disabled={uploadingArt}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Section 4 -- Distribution */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-zinc-300 mb-4">
            Distribution
          </h2>

          {/* Platform toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {PLATFORMS.map((p) => (
              <div
                key={p.key}
                className="flex items-center justify-between bg-zinc-800/30 border border-zinc-800/40 rounded-lg px-3 py-2.5"
              >
                <span className="text-[12px] font-medium text-zinc-300">
                  {p.label}
                </span>
                <Toggle
                  checked={form[p.key as keyof typeof form] as boolean}
                  onChange={(v) => update(p.key, v)}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Release Date</label>
              <input
                type="date"
                value={form.scheduledReleaseDate}
                onChange={(e) =>
                  update("scheduledReleaseDate", e.target.value)
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Distributor</label>
              <select
                value={form.distributor}
                onChange={(e) => update("distributor", e.target.value)}
                className={inputClass}
              >
                <option value="">Select distributor</option>
                {DISTRIBUTORS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 5 -- Actions */}
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-5">
          <h2 className="text-[13px] font-semibold text-zinc-300 mb-4">
            Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium text-zinc-950 transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
              }}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Changes
            </button>
            <button
              onClick={handleSchedule}
              disabled={scheduling || !form.scheduledReleaseDate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-40 disabled:hover:bg-blue-500/10"
            >
              {scheduling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CalendarClock className="w-3.5 h-3.5" />
              )}
              Schedule Release
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-500/10"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Submit for Distribution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
