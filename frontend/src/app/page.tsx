"use client";

import Link from "next/link";
import {
  Zap,
  Shield,
  ArrowRight,
  Headphones,
  Waves,
  BarChart3,
  Play,
  Star,
  Upload,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ────────── Navbar ────────── */}
      <nav className="glass-strong sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo variant="navbar" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-zinc-400 hover:text-white transition text-sm font-medium"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ────────── Hero ────────── */}
      <section className="relative overflow-hidden bg-grid">
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[128px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-24 flex flex-col items-center text-center">
          {/* Badge */}
          <div className="animate-fade-in-up inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-sm mb-8">
            <Zap className="w-4 h-4" />
            Studio-quality results without a studio
          </div>

          {/* Heading */}
          <h1 className="animate-fade-in-up delay-100 text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight max-w-4xl">
            Master your music{" "}
            <span className="gradient-text">in seconds</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up delay-200 text-zinc-400 text-lg md:text-xl max-w-2xl mt-6 leading-relaxed">
            Upload your track, choose a preset, and get a professionally mastered
            version. No plugins, no learning curve, no waiting.
          </p>

          {/* CTA buttons */}
          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row gap-4 mt-10">
            <Link
              href="/auth/register"
              className="bg-violet-600 hover:bg-violet-500 glow-violet text-white px-8 py-3.5 rounded-lg text-lg font-semibold transition flex items-center justify-center gap-2"
            >
              Start Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-8 py-3.5 rounded-lg text-lg transition flex items-center justify-center gap-2">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* ────────── Social Proof Bar ────────── */}
      <section className="border-y border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          {/* Fake avatar stack */}
          <div className="flex -space-x-3">
            {["bg-violet-500", "bg-pink-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500"].map(
              (bg, i) => (
                <div
                  key={i}
                  className={`w-9 h-9 rounded-full ${bg} border-2 border-zinc-950 flex items-center justify-center text-xs font-bold text-white`}
                >
                  {String.fromCharCode(65 + i)}
                </div>
              )
            )}
          </div>
          <div className="flex flex-col items-center sm:items-start gap-1">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-zinc-400 text-sm ml-1">4.9/5</span>
            </div>
            <p className="text-zinc-400 text-sm">
              Trusted by <span className="text-zinc-100 font-semibold">2,000+</span> independent artists
            </p>
          </div>
        </div>
      </section>

      {/* ────────── How it Works ────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-4xl font-bold">
              How it works
            </h2>
            <p className="animate-fade-in-up delay-100 text-zinc-400 mt-4 max-w-xl mx-auto">
              Three simple steps to professionally mastered audio.
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Dashed connector line (desktop only) */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] border-t-2 border-dashed border-zinc-800 pointer-events-none" />

            {[
              {
                step: 1,
                icon: <Upload className="w-7 h-7 text-violet-400" />,
                title: "Upload your track",
                desc: "Drag and drop your WAV, MP3, or FLAC file. We support all major audio formats.",
                delay: "",
              },
              {
                step: 2,
                icon: <SlidersHorizontal className="w-7 h-7 text-amber-400" />,
                title: "Choose a preset",
                desc: "Pick from Warm, Bright, Loud, or Balanced presets tailored for your genre.",
                delay: "delay-200",
              },
              {
                step: 3,
                icon: <Download className="w-7 h-7 text-emerald-400" />,
                title: "Download master",
                desc: "Get your release-ready master in seconds. Stream-optimized and peak-limited.",
                delay: "delay-400",
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`animate-fade-in-up ${item.delay} relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center`}
              >
                {/* Number badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-violet-600 text-white text-sm font-bold flex items-center justify-center ring-4 ring-zinc-950">
                  {item.step}
                </div>
                <div className="mt-4 mb-4 flex justify-center">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── Features Grid ────────── */}
      <section className="py-24 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-4xl font-bold">
              Everything you need
            </h2>
            <p className="animate-fade-in-up delay-100 text-zinc-400 mt-4 max-w-xl mx-auto">
              Professional mastering tools built for speed and simplicity.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Zap className="w-6 h-6 text-violet-400" />,
                title: "AI-Powered Presets",
                desc: "Intelligent presets that analyze your track and adapt processing automatically.",
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-amber-400" />,
                title: "LUFS Normalization",
                desc: "Hit the perfect loudness target for Spotify, Apple Music, YouTube, and more.",
              },
              {
                icon: <Waves className="w-6 h-6 text-sky-400" />,
                title: "Stereo Enhancement",
                desc: "Widen your mix with transparent stereo imaging that keeps mono compatibility.",
              },
              {
                icon: <Headphones className="w-6 h-6 text-pink-400" />,
                title: "A/B Comparison",
                desc: "Instantly toggle between your original and mastered track to hear the difference.",
              },
              {
                icon: <Play className="w-6 h-6 text-emerald-400" />,
                title: "Instant Preview",
                desc: "Get a free preview of your mastered track in seconds before committing.",
              },
              {
                icon: <Shield className="w-6 h-6 text-orange-400" />,
                title: "Release-Ready",
                desc: "Peak-limited, dithered, and format-optimized audio ready for distribution.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:scale-[1.02] hover:border-zinc-700 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-zinc-800/80 flex items-center justify-center mb-4 group-hover:bg-zinc-800 transition">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── Pricing Preview ────────── */}
      <section className="py-24 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-4xl font-bold">
              Simple, transparent pricing
            </h2>
            <p className="animate-fade-in-up delay-100 text-zinc-400 mt-4 max-w-xl mx-auto">
              Start free and upgrade when you are ready.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                features: [
                  "2 masters per month",
                  "MP3 export only",
                  "Basic presets",
                  "Preview before export",
                ],
                cta: "Get Started",
                highlight: false,
              },
              {
                name: "Pro",
                price: "$9",
                period: "per month",
                features: [
                  "25 masters per month",
                  "WAV & FLAC export",
                  "All presets",
                  "A/B comparison",
                  "Priority processing",
                ],
                cta: "Upgrade to Pro",
                highlight: true,
              },
              {
                name: "Studio",
                price: "$29",
                period: "per month",
                features: [
                  "Unlimited masters",
                  "All export formats",
                  "Custom presets",
                  "Stem mastering",
                  "API access",
                  "Priority support",
                ],
                cta: "Go Studio",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-zinc-900/50 border rounded-2xl p-8 flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                  plan.highlight
                    ? "border-violet-500/60 glow-violet-sm"
                    : "border-zinc-800"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                    POPULAR
                  </div>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-zinc-400 text-sm ml-1">/ {plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <svg
                        className="w-4 h-4 mt-0.5 text-violet-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-2.5 rounded-lg text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── Final CTA ────────── */}
      <section className="py-24 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-zinc-900 to-zinc-950 border border-zinc-800 p-12 md:p-16 text-center">
            {/* Subtle glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to sound professional?
              </h2>
              <p className="text-zinc-400 max-w-md mx-auto mb-8">
                Join thousands of artists who trust ReleaseLab for release-ready masters.
              </p>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 glow-violet text-white px-8 py-3.5 rounded-lg text-lg font-semibold transition"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-zinc-500 text-sm mt-4">No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── Footer ────────── */}
      <footer className="border-t border-zinc-800/60 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo variant="compact" />
            <span className="text-zinc-500 text-sm ml-1">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="#" className="hover:text-zinc-300 transition">
              Pricing
            </Link>
            <Link href="/auth/login" className="hover:text-zinc-300 transition">
              Login
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
