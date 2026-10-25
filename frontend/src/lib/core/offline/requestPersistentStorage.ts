export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch (error) {
    console.warn('[PWA] Persistent storage request failed:', error);
    return false;
  }
}
