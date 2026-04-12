import Image from "next/image";

interface LogoProps {
  variant?: "full" | "icon" | "sidebar";
  className?: string;
}

export default function Logo({ variant = "full", className = "" }: LogoProps) {
  if (variant === "icon") {
    // Just the rocket icon — for small spaces
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Image src="/logo.png" alt="ReleaseLab" width={44} height={44} className="object-contain" priority />
      </div>
    );
  }

  if (variant === "sidebar") {
    // Compact: rocket icon + styled text — for sidebar
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Image src="/logo.png" alt="ReleaseLab" width={40} height={40} className="object-contain" priority />
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight leading-none text-white">Release<span className="text-violet-400">Lab</span></span>
          <span className="text-[10px] text-zinc-500 tracking-widest uppercase">Studio</span>
        </div>
      </div>
    );
  }

  // Full: large logo for auth pages, landing hero
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Image src="/logo.png" alt="ReleaseLab" width={80} height={80} className="object-contain" priority />
      <span className="text-2xl font-bold tracking-tight text-white">Release<span className="text-violet-400">Lab</span></span>
    </div>
  );
}
