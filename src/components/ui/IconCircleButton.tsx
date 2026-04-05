import React from "react";

interface IconCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}

const sizeMap = {
  sm: "w-10 h-10",
  md: "w-11 h-11",
  lg: "w-14 h-14",
} as const;

const IconCircleButton: React.FC<IconCircleButtonProps> = ({
  children,
  size = "md",
  active = false,
  className = "",
  ...props
}) => {
  const baseClasses =
    "rounded-full flex items-center justify-center transition-all duration-300 ease-out shadow-sm hover:scale-110 active:scale-95";

  const stateClasses = active
    ? "text-white bg-white/20 scale-110"
    : "text-white/80 bg-white/5 backdrop-blur-xl";

  return (
    <button
      type="button"
      className={`${sizeMap[size]} ${baseClasses} ${stateClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default IconCircleButton;
