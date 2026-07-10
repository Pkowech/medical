import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to track unsaved changes in a form by comparing the current state
 * against a "saved" snapshot.
 *
 * @param currentState - the current form state object
 * @param enabled - whether tracking should be active (e.g., after initial load)
 */
export function useUnsavedChanges<T>(currentState: T, enabled: boolean = true) {
  const savedSnapshot = useRef<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Capture initial snapshot once enabled
  useEffect(() => {
    if (enabled && !savedSnapshot.current) {
      savedSnapshot.current = JSON.stringify(currentState);
    }
  }, [enabled, currentState]);

  // Diff on every state change
  useEffect(() => {
    if (!enabled || !savedSnapshot.current) return;
    const current = JSON.stringify(currentState);
    setHasUnsavedChanges(current !== savedSnapshot.current);
  }, [currentState, enabled]);

  // Warn on tab close when dirty
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  /** Call after a successful save to update the saved snapshot */
  const markAsSaved = useCallback(() => {
    savedSnapshot.current = JSON.stringify(currentState);
    setHasUnsavedChanges(false);
  }, [currentState]);

  /** Reset the snapshot to the current state (discard changes tracking) */
  const reset = useCallback(() => {
    savedSnapshot.current = '';
    setHasUnsavedChanges(false);
  }, []);

  return { hasUnsavedChanges, markAsSaved, reset };
}
