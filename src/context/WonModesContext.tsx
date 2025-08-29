import React, { createContext, useContext, useState, useCallback } from 'react';

export type WonModesContextType = {
  wonModes: string[];
  setWonModes: (modes: string[]) => void;
  refreshWonModes: () => Promise<void>;
};

const WonModesContext = createContext<WonModesContextType | undefined>(undefined);

export const useWonModes = () => {
  const ctx = useContext(WonModesContext);
  if (!ctx) throw new Error('useWonModes must be used within a WonModesProvider');
  return ctx;
};

import modes from '../data/modes.json';
import { loadGame as apiLoadGame } from '../api/api';

export const WonModesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wonModes, setWonModes] = useState<string[]>([]);

  const refreshWonModes = useCallback(async () => {
    const userId = localStorage.getItem('valojundle-userid');
    if (userId) {
      // On ne comptabilise pas le mode "hardcore" dans wonModes
      const winnableModes = modes.filter(m => m.key !== 'hardcore');
      const allModes = await Promise.all(
        winnableModes.map(async m => {
          const g = await apiLoadGame(m.key);
          return g.hasWon ? m.key : null;
        })
      );
      setWonModes(allModes.filter(Boolean) as string[]);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    refreshWonModes();
  }, [refreshWonModes]);

  return (
    <WonModesContext.Provider value={{ wonModes, setWonModes, refreshWonModes }}>
      {children}
    </WonModesContext.Provider>
  );
};
