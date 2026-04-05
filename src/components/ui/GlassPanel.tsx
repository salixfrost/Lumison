import React from "react";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-2",
  md: "p-3",
  lg: "p-4",
} as const;

const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = "",
  padding = "md",
}) => {
  const baseClasses =
    "rounded-[20px] bg-black/10 backdrop-blur-optimized saturate-150 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/5";

  return (
    <div className={`${baseClasses} ${paddingMap[padding]} ${className}`}>
      {children}
    </div>
  );
};

export default GlassPanel;
