// Hook isolado para evitar quebrar o Fast Refresh do Vite/SWC.
// Mantém um único ponto de consumo do AppContext.
import { useContext } from 'react';
import { AppContext } from '@/context/AppContextValue';

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
