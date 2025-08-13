import React, { createContext, useContext, useEffect, useState } from 'react';
import type { VJLPerson } from '../types/VJLPerson';
import { fetchVJLData } from '../api/api';

interface VJLDataContextType {
  vjlData: VJLPerson[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const VJLDataContext = createContext<VJLDataContextType | undefined>(undefined);

export const VJLDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vjlData, setVjlData] = useState<VJLPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVJLData();
      setVjlData(data);
    } catch (e: any) {
      setError(e.message || 'Erreur chargement vjl.json');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <VJLDataContext.Provider value={{ vjlData, loading, error, refresh: load }}>
      {children}
    </VJLDataContext.Provider>
  );
};

export function useVJLData() {
  const ctx = useContext(VJLDataContext);
  if (!ctx) throw new Error('useVJLData must be used within a VJLDataProvider');
  return ctx;
}
