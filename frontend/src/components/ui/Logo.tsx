import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { width: 280, height: 84 },
  md: { width: 360, height: 108 },
  lg: { width: 440, height: 132 },
};

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const s = sizes[size];

  return (
    <Image
      src="/logo.png"
      alt="ReleaseLab"
      width={s.width}
      height={s.height}
      className={`object-contain ${className}`}
      priority
    />
  );
}
