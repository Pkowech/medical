const STORAGE_STATUS_KEY = 'medtrack-persistent-storage';

export type PersistentStorageStatus = {
  supported: boolean;
  persisted: boolean;
  checkedAt: number;
};

function writeStatus(status: PersistentStorageStatus): PersistentStorageStatus {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(status));
  }
  return status;
}

export function readPersistentStorageStatus(): PersistentStorageStatus | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_STATUS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PersistentStorageStatus>;
    if (typeof parsed.supported !== 'boolean' || typeof parsed.persisted !== 'boolean') {
      return undefined;
    }
    return {
      supported: parsed.supported,
      persisted: parsed.persisted,
      checkedAt: typeof parsed.checkedAt === 'number' ? parsed.checkedAt : Date.now(),
    };
  } catch {
    return undefined;
  }
}

export async function inspectPersistentStorage(): Promise<PersistentStorageStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return writeStatus({ supported: false, persisted: false, checkedAt: Date.now() });
  }
  try {
    const persisted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : false;
    return writeStatus({
      supported: Boolean(navigator.storage.persist),
      persisted,
      checkedAt: Date.now(),
    });
  } catch (error) {
    console.warn('[PWA] Could not inspect persistent storage:', error);
    return writeStatus({
      supported: Boolean(navigator.storage.persist),
      persisted: false,
      checkedAt: Date.now(),
    });
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    writeStatus({ supported: false, persisted: false, checkedAt: Date.now() });
    return false;
  }
  try {
    const persisted = await navigator.storage.persist();
    writeStatus({
      supported: true,
      persisted,
      checkedAt: Date.now(),
    });
    return persisted;
  } catch (error) {
    console.warn('[PWA] Persistent storage request failed:', error);
    writeStatus({ supported: true, persisted: false, checkedAt: Date.now() });
    return false;
  }
}
