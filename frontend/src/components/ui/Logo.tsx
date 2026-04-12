import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { img: 28, text: "text-lg" },
  md: { img: 36, text: "text-xl" },
  lg: { img: 48, text: "text-2xl" },
};

export default function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const s = sizes[size];

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="ReleaseLab"
        width={s.img}
        height={s.img}
        className="object-contain"
        priority
      />
      {showText && <span className={`${s.text} font-bold tracking-tight`}>ReleaseLab</span>}
    </span>
  );
}
