import Image from "next/image";

interface LogoProps {
  variant?: "navbar" | "page" | "compact";
  className?: string;
}

export default function Logo({ variant = "navbar", className = "" }: LogoProps) {
  const config = {
    navbar:  { width: 180, height: 56 },
    page:    { width: 300, height: 94 },
    compact: { width: 120, height: 38 },
  }[variant];

  return (
    <Image
      src="/logo.png"
      alt="ReleaseLab"
      width={config.width}
      height={config.height}
      className={`object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.3)] ${className}`}
      priority
    />
  );
}
