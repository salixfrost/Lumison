import React, { useEffect, useState } from "react";
import { useI18n } from "../../contexts/I18nContext";

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const steps = [
      { progress: 20, status: "Checking audio support..." },
      { progress: 50, status: "Loading preferences..." },
      { progress: 80, status: "Preparing interface..." },
      { progress: 100, status: "Ready" },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].progress);
        setStatus(steps[currentStep].status);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 300);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <svg
            className="w-10 h-10 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Lumison
          </h1>
        </div>

        <div className="flex flex-col items-center gap-3 w-64">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/80 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-white/50 text-sm">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
