import Image from "next/image";

interface LogoProps {
  variant?: "navbar" | "page" | "compact";
  className?: string;
}

export default function Logo({ variant = "navbar", className = "" }: LogoProps) {
  const config = {
    navbar:  { width: 140, height: 44 },   // sidebar & navbar — fits 260px sidebar
    page:    { width: 400, height: 125 },  // auth pages — large & prominent
    compact: { width: 120, height: 38 },   // footer
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
