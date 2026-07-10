import { useState, useEffect } from 'react';

/**
 * Hook to detect if the component has mounted on the client.
 * Useful for resolving hydration mismatches by ensuring client-specific
 * code only runs after the initial mount.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
