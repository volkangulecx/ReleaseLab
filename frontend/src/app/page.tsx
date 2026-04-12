"use client";

import Link from "next/link";
import { Music, Zap, Shield, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-6 h-6 text-violet-500" />
          <span className="text-xl font-bold">ReleaseLab</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-zinc-400 hover:text-white transition">
            Login
          </Link>
          <Link
            href="/auth/register"
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-sm mb-8">
          <Zap className="w-4 h-4" />
          Studio-quality results without a studio
        </div>
        <h1 className="text-5xl md:text-7xl font-bold max-w-4xl leading-tight">
          Master your music
          <br />
          <span className="text-violet-500">in seconds</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mt-6">
          Upload your track, choose a preset, and get a professionally mastered version.
          No plugins, no learning curve, no waiting.
        </p>
        <div className="flex gap-4 mt-10">
          <Link
            href="/auth/register"
            className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-3 rounded-lg text-lg font-medium transition flex items-center gap-2"
          >
            Start Free <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/auth/login"
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-8 py-3 rounded-lg text-lg transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-800 px-6 py-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Music className="w-8 h-8 text-violet-500" />,
              title: "Upload & Master",
              desc: "Drop your WAV, MP3 or FLAC. Pick a preset — Warm, Bright, Loud, or Balanced.",
            },
            {
              icon: <Zap className="w-8 h-8 text-amber-500" />,
              title: "Instant Preview",
              desc: "Get a free preview in seconds. Love it? Export in full quality with one click.",
            },
            {
              icon: <Shield className="w-8 h-8 text-emerald-500" />,
              title: "Release-Ready",
              desc: "LUFS-normalized, peak-limited, ready for Spotify, Apple Music, and every platform.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              {f.icon}
              <h3 className="text-lg font-semibold mt-4">{f.title}</h3>
              <p className="text-zinc-400 mt-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-zinc-500 text-sm">
        ReleaseLab &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
