import React from "react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "primary";
}

const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  icon,
  variant = "default",
  className = "",
  ...props
}) => {
  const baseClasses =
    "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 backdrop-blur-sm border";

  const variantClasses =
    variant === "primary"
      ? "bg-white/20 hover:bg-white/30 text-white border-white/20 hover:scale-[1.02] active:scale-[0.98]"
      : "bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border-white/10 hover:scale-[1.02] active:scale-[0.98]";

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export default GlassButton;
