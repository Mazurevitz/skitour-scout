/**
 * Retry Queue Service
 *
 * Queues failed operations for retry when connection is restored.
 * Uses IndexedDB for persistence across sessions.
 */

const DB_NAME = 'skitour-retry-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_operations';

export type OperationType = 'add_report' | 'delete_report' | 'sync_reports';

export interface PendingOperation {
  id: string;
  type: OperationType;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastAttempt?: string;
  error?: string;
}

/**
 * Open IndexedDB for retry queue
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Add operation to retry queue
 */
export async function queueOperation(
  type: OperationType,
  payload: unknown
): Promise<string> {
  const db = await openDB();
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const operation: PendingOperation = {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(operation);

    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all pending operations
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Get count of pending operations
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Update operation after attempt
 */
export async function updateOperation(
  id: string,
  updates: Partial<Pick<PendingOperation, 'attempts' | 'lastAttempt' | 'error'>>
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const operation = getRequest.result;
      if (operation) {
        const updated = { ...operation, ...updates };
        store.put(updated);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

/**
 * Remove operation from queue (after success)
 */
export async function removeOperation(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Clear all pending operations
 */
export async function clearQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
  });
}

/**
 * Process retry queue with provided handlers
 */
export async function processQueue(
  handlers: Record<OperationType, (payload: unknown) => Promise<void>>,
  options: { maxAttempts?: number; onProgress?: (completed: number, total: number) => void } = {}
): Promise<{ success: number; failed: number }> {
  const { maxAttempts = 3, onProgress } = options;
  const operations = await getPendingOperations();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    // Skip if max attempts exceeded
    if (op.attempts >= maxAttempts) {
      failed++;
      continue;
    }

    const handler = handlers[op.type];
    if (!handler) {
      console.warn(`No handler for operation type: ${op.type}`);
      failed++;
      continue;
    }

    try {
      await handler(op.payload);
      await removeOperation(op.id);
      success++;
    } catch (error) {
      await updateOperation(op.id, {
        attempts: op.attempts + 1,
        lastAttempt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      failed++;
    }

    onProgress?.(i + 1, operations.length);
  }

  return { success, failed };
}

/**
 * Hook into online event to process queue automatically
 */
let isProcessing = false;

export function setupAutoRetry(
  handlers: Record<OperationType, (payload: unknown) => Promise<void>>
): () => void {
  const handleOnline = async () => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const count = await getPendingCount();
      if (count > 0) {
        console.log(`Processing ${count} pending operations...`);
        const result = await processQueue(handlers);
        console.log(`Retry queue processed: ${result.success} success, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('Failed to process retry queue:', error);
    } finally {
      isProcessing = false;
    }
  };

  window.addEventListener('online', handleOnline);

  // Also process on initial load if online
  if (navigator.onLine) {
    handleOnline();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
