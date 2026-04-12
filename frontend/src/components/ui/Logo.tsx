import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { width: 160, height: 48 },
  md: { width: 200, height: 60 },
  lg: { width: 260, height: 78 },
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
