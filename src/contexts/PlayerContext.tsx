import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface FocusSession {
  isActive: boolean;
  remainingTime: number;
  isPaused: boolean;
}

interface PlayerContextValue {
  focusSession: FocusSession | null;
  setFocusSession: (session: FocusSession | null) => void;
  completeFocusSession: (shouldPause?: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export const usePlayerContext = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayerContext must be used within PlayerProvider');
  }
  return context;
};

interface PlayerProviderProps {
  children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);

  const completeFocusSession = useCallback((shouldPause?: boolean) => {
    setFocusSession(null);
    // shouldPause is handled by FocusSessionModal directly via onSessionComplete
  }, []);

  return (
    <PlayerContext.Provider value={{ focusSession, setFocusSession, completeFocusSession }}>
      {children}
    </PlayerContext.Provider>
  );
};
