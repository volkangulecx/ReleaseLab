"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Zap, Shield, Sparkles, BarChart3 } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import Logo from "@/components/ui/Logo";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, displayName || undefined);
      toast.success("Account created!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Zap, text: "AI-powered mastering in under 60 seconds" },
    { icon: Shield, text: "Lossless quality with WAV & FLAC support" },
    { icon: Sparkles, text: "Multiple genre-tuned presets" },
    { icon: BarChart3, text: "Detailed loudness & dynamic reports" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-violet-950 via-zinc-900 to-zinc-950 items-center justify-center p-12">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid opacity-40" />
        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/3 w-56 h-56 bg-fuchsia-600/10 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-lg animate-fade-in">
          <div className="mb-8">
            <Logo size="lg" />
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            <span className="gradient-text">Join 2,000+</span>
            <br />
            <span className="text-white/90">artists already mastering.</span>
          </h1>

          <p className="text-zinc-400 text-lg leading-relaxed mb-10">
            Professional mastering at a fraction of the cost. Get started for free with 3 credits.
          </p>

          <div className="space-y-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-fade-in-up"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-zinc-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - register form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-zinc-950">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 md:hidden">
            <Logo size="lg" />
          </div>

          <div className="glass rounded-2xl p-8 glow-violet-sm">
            <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
            <p className="text-zinc-500 text-sm mb-8">Start mastering in minutes</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-white placeholder-zinc-600"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-white placeholder-zinc-600"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/70 border border-zinc-700/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-white placeholder-zinc-600"
                  placeholder="Min 6 characters"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>
          </div>

          <p className="text-center text-zinc-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-violet-400 hover:text-violet-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
