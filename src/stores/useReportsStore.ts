/**
 * Community Reports Store
 *
 * Manages community-submitted condition reports using IndexedDB for persistence.
 * Used especially for Beskidy region where no official avalanche data exists.
 *
 * @module stores/useReportsStore
 */

import { create } from 'zustand';

/**
 * Community report submitted by users
 */
export interface CommunityReport {
  id: string;
  /** Snow condition type */
  condition: 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie' | string;
  /** Rating 1-5 */
  rating: number;
  /** Location name */
  location: string;
  /** Region */
  region: string;
  /** Optional notes */
  notes?: string;
  /** GPS coordinates if available */
  coordinates?: { lat: number; lng: number };
  /** Submission timestamp */
  timestamp: string;
  /** Is this user's own report */
  isOwn: boolean;
}

/**
 * Aggregated conditions for a location
 */
export interface LocationConditions {
  location: string;
  region: string;
  /** Most common condition */
  primaryCondition: string;
  /** Average rating */
  averageRating: number;
  /** Number of reports */
  reportCount: number;
  /** Most recent report timestamp */
  lastReport: string;
  /** Reported hazards */
  hazards: string[];
}

interface ReportsState {
  reports: CommunityReport[];
  isLoading: boolean;
  lastSync: string | null;

  // Actions
  initialize: () => Promise<void>;
  addReport: (report: Omit<CommunityReport, 'id' | 'timestamp' | 'isOwn'>) => Promise<void>;
  getReportsForRegion: (region: string) => CommunityReport[];
  getReportsForLocation: (location: string) => CommunityReport[];
  getAggregatedConditions: (region: string) => LocationConditions[];
  getRecentReports: (hours?: number) => CommunityReport[];
  clearOldReports: (daysOld?: number) => Promise<void>;
}

const DB_NAME = 'skitour-scout-reports';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

/**
 * Open IndexedDB connection
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
        store.createIndex('region', 'region', { unique: false });
        store.createIndex('location', 'location', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  isLoading: false,
  lastSync: null,

  initialize: async () => {
    set({ isLoading: true });

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const reports: CommunityReport[] = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Sort by timestamp descending
      reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      set({
        reports,
        isLoading: false,
        lastSync: new Date().toISOString(),
      });

      db.close();
    } catch (error) {
      console.error('Failed to initialize reports store:', error);
      set({ isLoading: false });
    }
  },

  addReport: async (reportData) => {
    const report: CommunityReport = {
      ...reportData,
      id: generateId(),
      timestamp: new Date().toISOString(),
      isOwn: true,
    };

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.add(report);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();

      // Update state
      set((state) => ({
        reports: [report, ...state.reports],
      }));
    } catch (error) {
      console.error('Failed to add report:', error);
      throw error;
    }
  },

  getReportsForRegion: (region: string) => {
    const { reports } = get();
    return reports.filter((r) =>
      r.region.toLowerCase().includes(region.toLowerCase()) ||
      region.toLowerCase().includes(r.region.toLowerCase())
    );
  },

  getReportsForLocation: (location: string) => {
    const { reports } = get();
    return reports.filter((r) =>
      r.location.toLowerCase().includes(location.toLowerCase())
    );
  },

  getAggregatedConditions: (region: string) => {
    const regionReports = get().getReportsForRegion(region);

    // Group by location
    const byLocation = new Map<string, CommunityReport[]>();
    for (const report of regionReports) {
      const existing = byLocation.get(report.location) || [];
      existing.push(report);
      byLocation.set(report.location, existing);
    }

    const aggregated: LocationConditions[] = [];

    for (const [location, reports] of byLocation) {
      // Get most common condition
      const conditionCounts = new Map<string, number>();
      for (const r of reports) {
        conditionCounts.set(r.condition, (conditionCounts.get(r.condition) || 0) + 1);
      }
      const primaryCondition = [...conditionCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

      // Average rating
      const avgRating = reports.reduce((sum, r) => sum + r.rating, 0) / reports.length;

      // Collect hazards from notes
      const hazards: string[] = [];
      const hazardKeywords = ['lawina', 'lód', 'mgła', 'wiatr', 'kamienie', 'niebezp'];
      for (const r of reports) {
        if (r.notes) {
          for (const kw of hazardKeywords) {
            if (r.notes.toLowerCase().includes(kw) && !hazards.includes(kw)) {
              hazards.push(kw);
            }
          }
        }
      }

      aggregated.push({
        location,
        region: reports[0].region,
        primaryCondition,
        averageRating: Math.round(avgRating * 10) / 10,
        reportCount: reports.length,
        lastReport: reports[0].timestamp,
        hazards,
      });
    }

    // Sort by report count
    return aggregated.sort((a, b) => b.reportCount - a.reportCount);
  },

  getRecentReports: (hours = 24) => {
    const { reports } = get();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return reports.filter((r) => new Date(r.timestamp).getTime() > cutoff);
  },

  clearOldReports: async (daysOld = 30) => {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      const keysToDelete: string[] = [];

      await new Promise<void>((resolve, reject) => {
        const request = index.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const report = cursor.value as CommunityReport;
            if (new Date(report.timestamp).getTime() < cutoff) {
              keysToDelete.push(report.id);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });

      // Delete old reports
      for (const id of keysToDelete) {
        store.delete(id);
      }

      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });

      db.close();

      // Update state
      set((state) => ({
        reports: state.reports.filter((r) => new Date(r.timestamp).getTime() >= cutoff),
      }));
    } catch (error) {
      console.error('Failed to clear old reports:', error);
    }
  },
}));
