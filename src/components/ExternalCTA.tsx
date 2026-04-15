import { useRef } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

interface BaseProps {
  label: string;
  onClick?: () => void;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface LinkProps extends BaseProps {
  href: string;
  as?: "link";
}

interface ButtonProps extends BaseProps {
  href?: never;
  as: "button";
}

type ExternalCTAProps = LinkProps | ButtonProps;

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

export default function ExternalCTA(props: ExternalCTAProps) {
  const {
    label,
    onClick,
    showIcon = true,
    size = "sm",
    fullWidth = false,
    disabled = false,
    className = "",
    children,
  } = props;

  const isButton = props.as === "button";
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;

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

  const sharedClassName = `mood-tag-pulse relative overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-full uppercase font-medium tracking-[0.12em] whitespace-nowrap cursor-pointer ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`;

  const sharedStyle = {
    background: "linear-gradient(135deg, #121212 0%, #3F3F46 100%)",
    color: "#FFFFFF",
    border: "1.5px solid rgba(217, 115, 43, 0.5)",
  };

  const motionProps = {
    initial: { boxShadow: "0 0 0 rgba(0,0,0,0)" },
    whileHover: {
      boxShadow: "0 0 20px rgba(217, 115, 43, 0.3)",
      border: "1.5px solid #D9732B",
      textShadow: "0 2px 8px rgba(255,255,255,0.3)",
    },
    whileTap: { scale: 0.96 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  };

  const inner = (
    <>
      <span className="relative z-10 flex items-center gap-1.5">
        {children || label}
        {showIcon && !isButton && <ExternalLink className={iconSizes[size]} aria-hidden="true" />}
      </span>
      <div data-cta-light-leak className="pointer-events-none absolute inset-0 rounded-full transition-none" />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: shimmerGradient, x: "-100%" }}
        whileHover={{ x: "100%" }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />
    </>
  );

  return (
    <div
      ref={ref}
      className={`inline-block transition-transform duration-300 ease-out ${fullWidth ? "w-full" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {isButton ? (
        <motion.button
          type="button"
          onClick={() => { if (!disabled) onClick?.(); }}
          disabled={disabled}
          className={sharedClassName}
          style={sharedStyle}
          {...motionProps}
        >
          {inner}
        </motion.button>
      ) : (
        <motion.a
          href={(props as LinkProps).href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (disabled) { e.preventDefault(); return; }
            onClick?.();
          }}
          className={sharedClassName}
          style={sharedStyle}
          {...motionProps}
        >
          {inner}
        </motion.a>
      )}
    </div>
  );
}
