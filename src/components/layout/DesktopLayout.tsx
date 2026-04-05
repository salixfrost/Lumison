import React from "react";

interface DesktopLayoutProps {
  children: React.ReactNode;
  hasEverPlayed: boolean;
  isFullscreen?: boolean;
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  children,
  hasEverPlayed,
  isFullscreen = false,
}) => {
  const containerClass = hasEverPlayed
    ? "flex flex-row w-full h-full"
    : "flex flex-col items-center justify-center w-full h-full";

  return (
    <div className={containerClass}>
      <div
        className={
          isFullscreen
            ? "w-full h-full transition-transform duration-300"
            : "w-full h-full"
        }
        style={
          isFullscreen
            ? { transform: "scale(1.2)", transformOrigin: "center center" }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};

export default DesktopLayout;