"use client";

import Link from "next/link";
import Logo from "@/components/ui/Logo";

/* ───────────────────────────────────────────────
   Inline SVG helpers — no extra deps needed
   ─────────────────────────────────────────────── */
function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

/* ───────────────────────────────────────────────
   Data
   ─────────────────────────────────────────────── */
const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["2 masters per month", "MP3 export only", "Basic presets", "Preview before export"],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "per month",
    features: ["25 masters per month", "WAV & FLAC export", "All presets", "A/B comparison", "Priority processing"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Studio",
    price: "$29",
    period: "per month",
    features: ["Unlimited masters", "All export formats", "Custom presets", "Stem mastering", "API access", "Priority support"],
    cta: "Go Studio",
    highlight: false,
  },
];

/* ───────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 glass-strong backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/">
            <Logo variant="navbar" />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/auth/login" className="text-zinc-400 hover:text-white transition text-sm font-medium">
              Login
            </Link>
            <Link
              href="/auth/register"
              className="relative inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.25)]"
            >
              Get Started
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Radial gradient */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/[0.07] rounded-full blur-[120px]" />
          {/* Orbit ring */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-zinc-800/40" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-zinc-800/20" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-32 pb-28 flex flex-col items-center text-center">
          <h1 className="animate-fade-in-up text-6xl md:text-8xl font-extrabold tracking-tight leading-[0.95]">
            <span className="block">Your music.</span>
            <span className="block gradient-text mt-2">Perfected.</span>
          </h1>

          <p className="animate-fade-in-up delay-200 text-zinc-400 text-lg md:text-xl max-w-lg mt-8 leading-relaxed">
            Studio-quality mastering in seconds. Upload, choose a preset, release.
          </p>

          <div className="animate-fade-in-up delay-300 mt-10">
            <Link
              href="/auth/register"
              className="relative inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all duration-300 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.4)]"
            >
              Start Mastering
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>

          <p className="animate-fade-in-up delay-400 text-zinc-500 text-sm mt-5">
            No credit card required &middot; Free to start
          </p>
        </div>
      </section>

      {/* ─── Social Proof ─── */}
      <section className="border-y border-zinc-800/50 bg-zinc-900/20">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col items-center gap-6">
          <p className="text-zinc-500 text-sm font-medium tracking-wide uppercase">
            Trusted by artists worldwide
          </p>
          <div className="flex items-center gap-10 opacity-40">
            {["SoundWave", "ToneForge", "AudioNest", "BeatGrid", "WarpSync"].map((name) => (
              <span key={name} className="text-zinc-400 text-lg font-semibold tracking-wide select-none">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bento Grid Features ─── */}
      <section className="py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-5xl font-bold tracking-tight">
              Everything you need
            </h2>
            <p className="animate-fade-in-up delay-100 text-zinc-400 mt-4 text-lg max-w-lg mx-auto">
              Professional mastering tools, beautifully simple.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Large card 1: 4 Mastering Presets */}
            <div className="animate-fade-in-up md:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8 hover:border-zinc-700 transition-colors duration-300 group">
              <p className="text-sm text-zinc-500 font-medium mb-4">Presets</p>
              <h3 className="text-xl font-semibold mb-6">4 Mastering Presets</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Warm", color: "bg-amber-500" },
                  { label: "Bright", color: "bg-sky-400" },
                  { label: "Loud", color: "bg-rose-500" },
                  { label: "Balanced", color: "bg-emerald-400" },
                ].map((preset) => (
                  <div key={preset.label} className="flex items-center gap-2 bg-zinc-800/60 rounded-full px-4 py-2">
                    <div className={`w-3 h-3 rounded-full ${preset.color}`} />
                    <span className="text-sm text-zinc-300">{preset.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Large card 2: Before & After waveform */}
            <div className="animate-fade-in-up delay-100 md:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-8 hover:border-zinc-700 transition-colors duration-300 group">
              <p className="text-sm text-zinc-500 font-medium mb-4">Compare</p>
              <h3 className="text-xl font-semibold mb-6">Before &amp; After</h3>
              {/* Fake waveform visualization */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 mb-2">Original</p>
                  <div className="flex items-center gap-[2px] h-10">
                    {[3, 5, 8, 4, 6, 9, 5, 3, 7, 10, 6, 4, 8, 5, 3, 6, 9, 7, 4, 5, 8, 3, 6, 4].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-zinc-600 rounded-full"
                          style={{ height: `${h * 4}px` }}
                        />
                      )
                    )}
                  </div>
                </div>
                <div className="w-px bg-zinc-800" />
                <div className="flex-1">
                  <p className="text-xs text-violet-400 mb-2">Mastered</p>
                  <div className="flex items-center gap-[2px] h-10">
                    {[6, 8, 10, 7, 9, 10, 8, 6, 9, 10, 9, 7, 10, 8, 6, 9, 10, 9, 7, 8, 10, 6, 9, 7].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-violet-500 rounded-full"
                          style={{ height: `${h * 4}px` }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Small card 1 */}
            <div className="animate-fade-in-up delay-200 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700 transition-colors duration-300 md:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">Instant Preview</h3>
              <p className="text-sm text-zinc-500">Hear results before you commit.</p>
            </div>

            {/* Small card 2 */}
            <div className="animate-fade-in-up delay-300 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700 transition-colors duration-300 md:col-span-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">LUFS Normalized</h3>
              <p className="text-sm text-zinc-500">Hit every streaming platform target automatically.</p>
            </div>

            {/* Small card 3 */}
            <div className="animate-fade-in-up delay-400 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-zinc-700 transition-colors duration-300 md:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">Release Ready</h3>
              <p className="text-sm text-zinc-500">Peak-limited and distribution-ready.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-28 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-5xl font-bold tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {[
              { num: "01", title: "Upload your track", desc: "Drag and drop any WAV, MP3, or FLAC file." },
              { num: "02", title: "Choose a preset", desc: "Pick from four studio presets tailored for your sound." },
              { num: "03", title: "Download your master", desc: "Get release-ready audio in seconds, not hours." },
            ].map((step, i) => (
              <div key={step.num} className={`animate-fade-in-up ${i === 1 ? "delay-200" : i === 2 ? "delay-400" : ""}`}>
                <span className="text-5xl font-extrabold text-zinc-800 block mb-4 font-mono">
                  {step.num}
                </span>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="py-28 border-t border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="animate-fade-in-up text-3xl md:text-5xl font-bold tracking-tight">
              Simple pricing
            </h2>
            <p className="animate-fade-in-up delay-100 text-zinc-400 mt-4 text-lg">
              Start free. Upgrade when you are ready.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-7 flex flex-col transition-all duration-300 hover:translate-y-[-2px] ${
                  plan.highlight
                    ? "bg-zinc-900/80 border-2 border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.12)]"
                    : "bg-zinc-900/40 border border-zinc-800/60"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full tracking-wider">
                    POPULAR
                  </div>
                )}
                <h3 className="text-lg font-semibold text-zinc-200">{plan.name}</h3>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="text-zinc-500 text-sm ml-1.5">/ {plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                      <CheckIcon className="w-4 h-4 mt-0.5 text-violet-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    plan.highlight
                      ? "bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]"
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

      {/* ─── Final CTA ─── */}
      <section className="py-28 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="animate-fade-in-up text-3xl md:text-5xl font-bold tracking-tight">
            Ready to release?
          </h2>
          <div className="animate-fade-in-up delay-200 mt-8">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all duration-300 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.4)]"
            >
              Get Started Free
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-zinc-800/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo variant="compact" />
            <span className="text-zinc-600 text-sm ml-1">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/pricing" className="hover:text-zinc-300 transition">
              Pricing
            </Link>
            <Link href="/auth/login" className="hover:text-zinc-300 transition">
              Login
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
