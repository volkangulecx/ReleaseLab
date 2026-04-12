"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Disc3, Loader2, X } from "lucide-react";
import { releaseApi } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700/40 text-zinc-300",
  scheduled: "bg-blue-500/20 text-blue-400",
  submitted: "bg-amber-500/20 text-amber-400",
  live: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
};

export default function ReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "" });

  const fetchReleases = async () => {
    try {
      const { data } = await releaseApi.list();
      setReleases(Array.isArray(data) ? data : data.releases || data.items || []);
    } catch {
      toast.error("Failed to load releases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.artist.trim()) {
      toast.error("Title and artist are required");
      return;
    }
    setCreating(true);
    try {
      const { data } = await releaseApi.create({
        title: form.title.trim(),
        artist: form.artist.trim(),
      });
      toast.success("Release created");
      setShowModal(false);
      setForm({ title: "", artist: "" });
      const id = data.id || data.releaseId;
      if (id) {
        router.push(`/dashboard/releases/${id}`);
      } else {
        fetchReleases();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create release");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-lg font-semibold text-white">Releases</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-zinc-950 transition-all"
          style={{ background: "linear-gradient(135deg, #e4e4e7, #ffffff)" }}
        >
          <Plus className="w-4 h-4" />
          New Release
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-20">
          <Disc3 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium mb-1">No releases yet</p>
          <p className="text-zinc-600 text-sm">
            Create your first release to get started with distribution.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {releases.map((r: any) => {
            const status = (r.status || "draft").toLowerCase();
            return (
              <button
                key={r.id}
                onClick={() => router.push(`/dashboard/releases/${r.id}`)}
                className="flex items-center gap-4 w-full text-left bg-zinc-900/50 border border-zinc-800/40 rounded-xl px-5 py-4 hover:border-zinc-700/60 transition-colors group"
              >
                {r.artworkUrl ? (
                  <img
                    src={r.artworkUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-800/60 flex items-center justify-center shrink-0">
                    <Disc3 className="w-5 h-5 text-zinc-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                    {r.title}
                  </p>
                  <p className="text-[12px] text-zinc-500 truncate">
                    {r.artist}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider shrink-0 ${
                    STATUS_COLORS[status] || STATUS_COLORS.draft
                  }`}
                >
                  {status}
                </span>
                {r.createdAt && (
                  <span className="text-[11px] text-zinc-600 shrink-0 hidden sm:block">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-semibold text-white">
                New Release
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-zinc-400 mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Track or release title"
                  className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-zinc-400 mb-1.5">
                  Artist *
                </label>
                <input
                  type="text"
                  value={form.artist}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, artist: e.target.value }))
                  }
                  placeholder="Artist or band name"
                  className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-zinc-400 bg-zinc-800/50 border border-zinc-700/40 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-zinc-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #e4e4e7, #ffffff)",
                }}
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
