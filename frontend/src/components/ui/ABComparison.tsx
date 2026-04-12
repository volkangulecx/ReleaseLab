"use client";

import { useState } from "react";
import AudioPlayer from "./AudioPlayer";

interface AnalysisData {
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  peakDb: number;
  loudnessLufs: number;
  waveform: number[];
}

interface ABComparisonProps {
  inputUrl: string;
  outputUrl: string;
  inputAnalysis?: AnalysisData | null;
  outputAnalysis?: AnalysisData | null;
}

export default function ABComparison({ inputUrl, outputUrl, inputAnalysis, outputAnalysis }: ABComparisonProps) {
  const [tab, setTab] = useState<"ab" | "stats">("ab");

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 bg-zinc-800 rounded-lg p-1 mb-4">
        <button
          onClick={() => setTab("ab")}
          className={`flex-1 py-2 text-sm rounded-md transition ${
            tab === "ab" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          A/B Compare
        </button>
        <button
          onClick={() => setTab("stats")}
          className={`flex-1 py-2 text-sm rounded-md transition ${
            tab === "stats" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          Stats
        </button>
      </div>

      {tab === "ab" && (
        <div className="space-y-3">
          <AudioPlayer
            src={inputUrl}
            label="Original"
            color="#71717a"
            waveformData={inputAnalysis?.waveform}
          />
          <AudioPlayer
            src={outputUrl}
            label="Mastered"
            color="#8b5cf6"
            waveformData={outputAnalysis?.waveform}
          />
        </div>
      )}

      {tab === "stats" && inputAnalysis && outputAnalysis && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Metric</th>
                <th className="text-right px-4 py-3 text-zinc-400 font-medium">Original</th>
                <th className="text-right px-4 py-3 text-violet-400 font-medium">Mastered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              <StatRow label="Loudness" original={`${inputAnalysis.loudnessLufs} LUFS`} mastered={`${outputAnalysis.loudnessLufs} LUFS`} />
              <StatRow label="Peak" original={`${inputAnalysis.peakDb} dB`} mastered={`${outputAnalysis.peakDb} dB`} />
              <StatRow label="Duration" original={`${inputAnalysis.duration}s`} mastered={`${outputAnalysis.duration}s`} />
              <StatRow label="Sample Rate" original={`${inputAnalysis.sampleRate} Hz`} mastered={`${outputAnalysis.sampleRate} Hz`} />
              <StatRow label="Channels" original={`${inputAnalysis.channels}`} mastered={`${outputAnalysis.channels}`} />
              <StatRow label="Codec" original={inputAnalysis.codec} mastered={outputAnalysis.codec} />
            </tbody>
          </table>
        </div>
      )}

      {tab === "stats" && (!inputAnalysis || !outputAnalysis) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          Analysis data not available yet
        </div>
      )}
    </div>
  );
}

function StatRow({ label, original, mastered }: { label: string; original: string; mastered: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-zinc-300">{label}</td>
      <td className="px-4 py-2.5 text-right text-zinc-400">{original}</td>
      <td className="px-4 py-2.5 text-right text-violet-300 font-medium">{mastered}</td>
    </tr>
  );
}
