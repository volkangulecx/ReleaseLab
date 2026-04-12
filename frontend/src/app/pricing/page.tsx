"use client";

import Link from "next/link";
import Logo from "@/components/ui/Logo";

/* ───────────────────────────────────────────────
   Inline SVG helpers
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

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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
    desc: "Try it out, no strings attached.",
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
    desc: "For serious artists ready to level up.",
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
    desc: "Unlimited power for labels and teams.",
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
];

const faqs = [
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes. You can cancel or downgrade at any time from your account settings. Your plan stays active until the end of your billing period.",
  },
  {
    q: "What audio formats do you support?",
    a: "You can upload WAV, MP3, and FLAC files. Export formats depend on your plan \u2014 Free supports MP3 only, Pro adds WAV and FLAC, and Studio supports all formats.",
  },
  {
    q: "How does the free preview work?",
    a: "Every plan includes free previews. You can listen to how your mastered track will sound before using a credit to export the final file.",
  },
  {
    q: "What happens if I run out of credits?",
    a: "You can wait for your monthly credits to reset, or upgrade to a higher plan for more capacity. Studio plan users get unlimited masters.",
  },
];

/* ───────────────────────────────────────────────
   Page
   ─────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.25)]"
            >
              Get Started
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Header ─── */}
      <section className="relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-500/[0.05] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-16 text-center">
          <h1 className="animate-fade-in-up text-4xl md:text-6xl font-extrabold tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="animate-fade-in-up delay-200 text-zinc-400 text-lg mt-5 max-w-md mx-auto">
            Start free. Upgrade when you need more power.
          </p>
        </div>
      </section>

      {/* ─── Plan Cards ─── */}
      <section className="pb-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan, i) => (
              <div
                key={plan.name}
                className={`animate-fade-in-up ${i === 1 ? "delay-100" : i === 2 ? "delay-200" : ""} relative rounded-2xl p-7 flex flex-col transition-all duration-300 hover:translate-y-[-2px] ${
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

                <h2 className="text-lg font-semibold text-zinc-200">{plan.name}</h2>
                <p className="text-sm text-zinc-500 mt-1">{plan.desc}</p>

                <div className="mt-5 mb-6">
                  <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
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
                  className={`block text-center py-3 rounded-lg text-sm font-semibold transition-all duration-300 ${
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

          <p className="text-center mt-8 text-zinc-600 text-sm">
            All plans include free previews. No hidden fees.
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="pb-28 border-t border-zinc-800/50 pt-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="animate-fade-in-up text-2xl md:text-3xl font-bold tracking-tight text-center mb-12">
            Frequently asked questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group bg-zinc-900/40 border border-zinc-800/60 rounded-xl transition-colors hover:border-zinc-700"
              >
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium text-zinc-200 list-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronIcon className="w-4 h-4 text-zinc-500 shrink-0 ml-4 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-4 text-sm text-zinc-400 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
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
            <Link href="/" className="hover:text-zinc-300 transition">
              Home
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
