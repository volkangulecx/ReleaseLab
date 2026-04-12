"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import Waveform from "./Waveform";

interface AudioPlayerProps {
  src: string;
  label: string;
  color?: string;
  waveformData?: number[];
}

export default function AudioPlayer({ src, label, color = "#8b5cf6", waveformData }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setProgress(audio.currentTime / (audio.duration || 1));
      setDuration(audio.duration || 0);
    };
    const onEnd = () => setPlaying(false);
    const onLoaded = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("loadedmetadata", onLoaded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <audio ref={audioRef} src={src} muted={muted} preload="metadata" />

      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={toggle}
          className="w-10 h-10 rounded-full flex items-center justify-center transition"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-zinc-500">
            {formatTime(progress * duration)} / {formatTime(duration)}
          </p>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          className="ml-auto text-zinc-400 hover:text-zinc-200 transition"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Waveform or progress bar */}
      <div className="cursor-pointer" onClick={seek}>
        {waveformData && waveformData.length > 0 ? (
          <Waveform data={waveformData} color={color} height={48} progress={progress} />
        ) : (
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, backgroundColor: color }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
