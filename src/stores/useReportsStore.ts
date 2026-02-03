/**
 * Community Reports Store
 *
 * Manages community-submitted condition reports using IndexedDB for persistence.
 * Supports dual reporting: Ascent (Podejście) and Descent (Zjazd).
 *
 * @module stores/useReportsStore
 */

import { create } from 'zustand';

/**
 * Report type: Ascent or Descent
 */
export type ReportType = 'ascent' | 'descent';

/**
 * Track status for ascent reports
 */
export type TrackStatus = 'przetarte' | 'zasypane' | 'lod';

/**
 * Gear needed for ascent
 */
export type AscentGear = 'foki' | 'harszle' | 'raki';

/**
 * Snow condition types for descent
 */
export type SnowCondition = 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie';

/**
 * Ascent-specific data
 */
export interface AscentData {
  trackStatus: TrackStatus;
  gearNeeded: AscentGear[];
}

/**
 * Descent-specific data
 */
export interface DescentData {
  snowCondition: SnowCondition;
  qualityRating: number; // 1-5
}

/**
 * Community report submitted by users
 */
export interface CommunityReport {
  id: string;
  /** Report type: ascent or descent */
  type: ReportType;
  /** Location name */
  location: string;
  /** Region */
  region: string;
  /** Ascent-specific data (if type === 'ascent') */
  ascent?: AscentData;
  /** Descent-specific data (if type === 'descent') */
  descent?: DescentData;
  /** Optional notes */
  notes?: string;
  /** GPS coordinates if available */
  coordinates?: { lat: number; lng: number };
  /** Submission timestamp */
  timestamp: string;
  /** Is this user's own report */
  isOwn: boolean;

  // Legacy fields for backwards compatibility
  /** @deprecated Use descent.snowCondition instead */
  condition?: string;
  /** @deprecated Use descent.qualityRating instead */
  rating?: number;
}

/**
 * Aggregated conditions for a location
 */
export interface LocationConditions {
  location: string;
  region: string;
  /** Most common snow condition (from descent reports) */
  primaryCondition: string;
  /** Average quality rating */
  averageRating: number;
  /** Number of reports */
  reportCount: number;
  /** Number of ascent reports */
  ascentCount: number;
  /** Number of descent reports */
  descentCount: number;
  /** Most recent report timestamp */
  lastReport: string;
  /** Most common track status (from ascent reports) */
  trackStatus?: TrackStatus;
  /** Commonly needed gear */
  commonGear: AscentGear[];
  /** Reported hazards */
  hazards: string[];
}

/**
 * Input for adding a new report
 */
export type NewReportInput = {
  type: ReportType;
  location: string;
  region: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
} & (
  | { type: 'ascent'; ascent: AscentData }
  | { type: 'descent'; descent: DescentData }
);

interface ReportsState {
  reports: CommunityReport[];
  isLoading: boolean;
  lastSync: string | null;

  // Actions
  initialize: () => Promise<void>;
  addReport: (report: NewReportInput) => Promise<void>;
  getReportsForRegion: (region: string) => CommunityReport[];
  getReportsForLocation: (location: string) => CommunityReport[];
  getReportsWithCoordinates: () => CommunityReport[];
  getAggregatedConditions: (region: string) => LocationConditions[];
  getRecentReports: (hours?: number) => CommunityReport[];
  clearOldReports: (daysOld?: number) => Promise<void>;
}

const DB_NAME = 'skitour-scout-reports';
const DB_VERSION = 2; // Incremented for schema change
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
        store.createIndex('type', 'type', { unique: false });
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

/**
 * Migrate legacy report to new format
 */
function migrateReport(report: CommunityReport): CommunityReport {
  // If report already has new format, return as-is
  if (report.type) return report;

  // Migrate legacy report to descent type
  return {
    ...report,
    type: 'descent',
    descent: {
      snowCondition: (report.condition as SnowCondition) || 'puch',
      qualityRating: report.rating || 3,
    },
  };
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

      const rawReports: CommunityReport[] = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Migrate and sort reports
      const reports = rawReports
        .map(migrateReport)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

  addReport: async (reportInput) => {
    const report: CommunityReport = {
      ...reportInput,
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

  getReportsWithCoordinates: () => {
    const { reports } = get();
    return reports.filter((r) => r.coordinates);
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
      const ascentReports = reports.filter((r) => r.type === 'ascent');
      const descentReports = reports.filter((r) => r.type === 'descent');

      // Get most common snow condition from descent reports
      const conditionCounts = new Map<string, number>();
      for (const r of descentReports) {
        const cond = r.descent?.snowCondition || r.condition || 'unknown';
        conditionCounts.set(cond, (conditionCounts.get(cond) || 0) + 1);
      }
      const primaryCondition = [...conditionCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

      // Average rating from descent reports
      const ratings = descentReports
        .map((r) => r.descent?.qualityRating || r.rating || 0)
        .filter((r) => r > 0);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      // Most common track status from ascent reports
      const trackCounts = new Map<TrackStatus, number>();
      for (const r of ascentReports) {
        if (r.ascent?.trackStatus) {
          trackCounts.set(r.ascent.trackStatus, (trackCounts.get(r.ascent.trackStatus) || 0) + 1);
        }
      }
      const trackStatus = [...trackCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      // Commonly needed gear
      const gearCounts = new Map<AscentGear, number>();
      for (const r of ascentReports) {
        for (const gear of r.ascent?.gearNeeded || []) {
          gearCounts.set(gear, (gearCounts.get(gear) || 0) + 1);
        }
      }
      const commonGear = [...gearCounts.entries()]
        .filter(([, count]) => count >= ascentReports.length * 0.3) // At least 30% mention it
        .map(([gear]) => gear);

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
        ascentCount: ascentReports.length,
        descentCount: descentReports.length,
        lastReport: reports[0].timestamp,
        trackStatus,
        commonGear,
        hazards,
      });
    }

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

      for (const id of keysToDelete) {
        store.delete(id);
      }

      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });

      db.close();

      set((state) => ({
        reports: state.reports.filter((r) => new Date(r.timestamp).getTime() >= cutoff),
      }));
    } catch (error) {
      console.error('Failed to clear old reports:', error);
    }
  },
}));
