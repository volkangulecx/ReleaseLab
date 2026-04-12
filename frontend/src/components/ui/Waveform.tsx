"use client";

interface WaveformProps {
  data: number[];
  color?: string;
  height?: number;
  progress?: number; // 0-1
}

export default function Waveform({ data, color = "#8b5cf6", height = 64, progress = 0 }: WaveformProps) {
  const barWidth = 2;
  const gap = 1;
  const width = data.length * (barWidth + gap);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((value, i) => {
        const barHeight = Math.max(2, value * height * 0.9);
        const y = (height - barHeight) / 2;
        const isPlayed = i / data.length <= progress;

        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={1}
            fill={isPlayed ? color : `${color}40`}
          />
        );
      })}
    </svg>
  );
}
