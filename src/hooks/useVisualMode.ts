import { useState, useEffect, useMemo } from 'react';

export function useVisualMode() {
  const VALID_VISUAL_MODES = ['melt', 'fluid', 'gradient'] as const;
  type VisualMode = typeof VALID_VISUAL_MODES[number];

  const getCurrentVisualMode = (): VisualMode => {
    if (typeof window === 'undefined') return 'gradient';
    const stored = localStorage.getItem('lumison-visual-mode');
    if (VALID_VISUAL_MODES.includes(stored as VisualMode)) return stored as VisualMode;
    return 'gradient';
  };
  
  const [visualModeRefresh, setVisualModeRefresh] = useState(0);
  const currentVisualMode = useMemo(() => getCurrentVisualMode(), [visualModeRefresh]);

  useEffect(() => {
    const handleVisualModeChange = () => setVisualModeRefresh(n => n + 1);
    window.addEventListener('visual-mode-changed', handleVisualModeChange);
    return () => window.removeEventListener('visual-mode-changed', handleVisualModeChange);
  }, []);

  return currentVisualMode;
}
