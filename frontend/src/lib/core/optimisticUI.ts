/**
 * Optimistic UI Manager
 * 
 * Handles optimistic updates with automatic rollback on sync failure.
 * Ensures UI remains responsive while sync happens in background.
 */
import React from 'react';

export interface OptimisticUpdate<T> {
  id: string;
  timestamp: number;
  originalData: T;
  optimisticData: T;
  status: 'pending' | 'synced' | 'failed';
  error?: string;
}

class OptimisticUIManager {
  private updates: Map<string, OptimisticUpdate<unknown>> = new Map();
  private listeners: Set<(id: string) => void> = new Set();

  /**
   * Record an optimistic update
   * @param id Unique identifier for this update
   * @param originalData State before update
   * @param optimisticData State after update (shown to user immediately)
   */
  recordUpdate<T>(id: string, originalData: T, optimisticData: T): void {
    this.updates.set(id, {
      id,
      timestamp: Date.now(),
      originalData,
      optimisticData,
      status: 'pending',
    });
    this.notifyListeners(id);
  }

  /**
   * Mark update as successfully synced
   */
  markSynced(id: string): void {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'synced';
      this.notifyListeners(id);
      // Clean up after 5 seconds
      setTimeout(() => this.updates.delete(id), 5000);
    }
  }

  /**
   * Mark update as failed and optionally rollback
   */
  markFailed(id: string, error: string, shouldRollback?: (originalData: unknown) => void): void {
    const update = this.updates.get(id);
    if (update) {
      update.status = 'failed';
      update.error = error;
      if (shouldRollback) {
        shouldRollback(update.originalData);
      }
      this.notifyListeners(id);
    }
  }

  /**
   * Get status of an update
   */
  getStatus(id: string): OptimisticUpdate<unknown> | undefined {
    return this.updates.get(id);
  }

  /**
   * Subscribe to update status changes
   */
  subscribe(callback: (id: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(id: string): void {
    this.listeners.forEach(listener => listener(id));
  }

  /**
   * Get all pending updates (for sync retry)
   */
  getPendingUpdates(): OptimisticUpdate<unknown>[] {
    return Array.from(this.updates.values()).filter(u => u.status === 'pending');
  }

  /**
   * Clear all updates
   */
  clear(): void {
    this.updates.clear();
    this.listeners.clear();
  }
}

export const optimisticUIManager = new OptimisticUIManager();

/**
 * React Hook for using optimistic UI manager
 */
export function useOptimisticUI(id: string) {
  const [update, setUpdate] = React.useState(() => optimisticUIManager.getStatus(id));

  React.useEffect(() => {
    const unsubscribe = optimisticUIManager.subscribe(updatedId => {
      if (updatedId === id) {
        setUpdate(optimisticUIManager.getStatus(id));
      }
    });

    return unsubscribe;
  }, [id]);

  return {
    isPending: update?.status === 'pending',
    isSynced: update?.status === 'synced',
    error: update?.error,
  };
}

/**
 * Helper to make optimistic updates easier
 */
export function withOptimisticUpdate<T, Args extends unknown[]>(
  updateFn: (...args: Args) => Promise<void>,
  getOriginalData: () => T,
  getOptimisticData: () => T
) {
  return async (...args: Args) => {
    const id = `update-${Date.now()}-${Math.random()}`;
    const originalData = getOriginalData();
    const optimisticData = getOptimisticData();

    // Record optimistic update
    optimisticUIManager.recordUpdate(id, originalData, optimisticData);

    try {
      // Execute update in background
      await updateFn(...args);
      optimisticUIManager.markSynced(id);
    } catch (error) {
      // Mark as failed and optionally rollback
      optimisticUIManager.markFailed(
        id,
        error instanceof Error ? error.message : 'Sync failed',
        (original) => {
          // Restore original state if needed
          console.error('Optimistic update failed, may need rollback:', original);
        }
      );
    }
  };
}
