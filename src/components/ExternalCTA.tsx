import { useRef } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

interface ExternalCTAProps {
  href: string;
  label: string;
  onClick?: () => void;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-7 px-4 py-1 text-[11px]",
  md: "h-9 px-6 py-2 text-xs",
  lg: "h-11 px-8 py-2.5 text-sm",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

export default function ExternalCTA({
  href,
  label,
  onClick,
  showIcon = true,
  size = "sm",
  fullWidth = false,
  disabled = false,
  className = "",
}: ExternalCTAProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;

    // Light-leak cursor tracking
    const lightLeak = el.querySelector<HTMLDivElement>("[data-cta-light-leak]");
    if (lightLeak) {
      lightLeak.style.background = `radial-gradient(circle 50px at ${e.clientX - rect.left}px ${e.clientY - rect.top}px, rgba(217,115,43,0.45) 0%, transparent 100%)`;
    }
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0px, 0px)";
    const lightLeak = el.querySelector<HTMLDivElement>("[data-cta-light-leak]");
    if (lightLeak) lightLeak.style.background = "transparent";
  };

  const shimmerGradient =
    "linear-gradient(120deg, transparent 0%, transparent 25%, rgba(217,115,43,0.35) 45%, rgba(242,161,84,0.3) 55%, transparent 75%, transparent 100%)";

  return (
    <div
      ref={ref}
      className={`inline-block transition-transform duration-300 ease-out ${fullWidth ? "w-full" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        className={`mood-tag-pulse relative overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-full uppercase font-medium tracking-[0.12em] whitespace-nowrap cursor-pointer ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
        style={{
          background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
          color: "#FFFFFF",
          border: "1.5px solid rgba(217, 115, 43, 0.5)",
        }}
        initial={{
          boxShadow: "0 0 0 rgba(0,0,0,0)",
        }}
        whileHover={{
          boxShadow: "0 0 20px rgba(217, 115, 43, 0.3)",
          border: "1.5px solid #D9732B",
          textShadow: "0 2px 8px rgba(255,255,255,0.3)",
        }}
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <span className="relative z-10 flex items-center gap-1.5">
          {label}
          {showIcon && <ExternalLink className={iconSizes[size]} aria-hidden="true" />}
        </span>

        {/* Light-leak layer */}
        <div
          data-cta-light-leak
          className="pointer-events-none absolute inset-0 rounded-full transition-none"
        />

        {/* Shimmer sweep */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: shimmerGradient,
            x: "-100%",
          }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </motion.a>
    </div>
  );
}
