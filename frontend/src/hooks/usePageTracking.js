import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Hook pro automatické logování návštěv stránek.
 * Zavolá backend endpoint při každé změně cesty.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Loguj návštěvu při změně cesty
    const logVisit = async () => {
      try {
        await fetch(`${API_BASE}/visitor-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: location.pathname
          })
        });
      } catch (error) {
        // Tichý fail - logování nesmí pokazit UX
        console.debug('Failed to log visit:', error);
      }
    };

    logVisit();
  }, [location.pathname]); // Spustí se při každé změně cesty
}
