/**
 * Community Reports Store
 *
 * Manages community-submitted condition reports using IndexedDB for persistence
 * with Supabase sync for authenticated users.
 *
 * @module stores/useReportsStore
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured, getEdgeFunctionUrl, getAuthHeaders, Report, AdminReport } from '../lib/supabase';

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
export type SnowCondition = 'puch' | 'firn' | 'szren' | 'beton' | 'cukier' | 'kamienie' | 'mokry';

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
  /** User ID (for Supabase reports) */
  userId?: string;
  /** Synced to Supabase */
  synced?: boolean;

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
  primaryCondition: string;
  averageRating: number;
  reportCount: number;
  ascentCount: number;
  descentCount: number;
  lastReport: string;
  trackStatus?: TrackStatus;
  commonGear: AscentGear[];
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

/**
 * Rate limit error
 */
export interface RateLimitError {
  type: 'rate_limit';
  minutesRemaining: number;
  message: string;
}

/**
 * Auth required error
 */
export interface AuthRequiredError {
  type: 'auth_required';
  message: string;
}

export type ReportError = RateLimitError | AuthRequiredError | { type: 'error'; message: string };

/**
 * Admin-verified report from Facebook
 */
export interface VerifiedReport {
  id: string;
  reportDate: string;
  location: string;
  region: string;
  snowConditions: string | null;
  hazards: string[];
  safetyRating: number;
  authorName: string | null;
  sourceGroup: string | null;
  createdAt: string;
}

interface ReportsState {
  reports: CommunityReport[];
  adminReports: VerifiedReport[];
  isLoading: boolean;
  lastSync: string | null;
  error: ReportError | null;

  // Actions
  initialize: () => Promise<void>;
  addReport: (report: NewReportInput) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  syncWithSupabase: () => Promise<void>;
  getReportsForRegion: (region: string) => CommunityReport[];
  getReportsForLocation: (location: string) => CommunityReport[];
  getReportsWithCoordinates: () => CommunityReport[];
  getAggregatedConditions: (region: string) => LocationConditions[];
  getRecentReports: (hours?: number) => CommunityReport[];
  getUserReports: (userId: string) => CommunityReport[];
  getAdminReportsForRegion: (region: string) => VerifiedReport[];
  clearOldReports: (daysOld?: number) => Promise<void>;
  clearError: () => void;
}

const DB_NAME = 'skitour-scout-reports';
const DB_VERSION = 3; // Incremented for sync support
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
        store.createIndex('userId', 'userId', { unique: false });
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
 * Convert Supabase report to CommunityReport
 */
function fromSupabaseReport(report: Report, currentUserId?: string): CommunityReport {
  const communityReport: CommunityReport = {
    id: report.id,
    type: report.type,
    location: report.location,
    region: report.region,
    coordinates: report.coordinates || undefined,
    notes: report.notes || undefined,
    timestamp: report.created_at,
    isOwn: report.user_id === currentUserId,
    userId: report.user_id,
    synced: true,
  };

  if (report.type === 'ascent') {
    communityReport.ascent = {
      trackStatus: report.track_status as TrackStatus,
      gearNeeded: (report.gear_needed || []) as AscentGear[],
    };
  } else {
    communityReport.descent = {
      snowCondition: report.snow_condition as SnowCondition,
      qualityRating: report.quality_rating || 3,
    };
  }

  return communityReport;
}

/**
 * Migrate legacy report to new format
 */
function migrateReport(report: CommunityReport): CommunityReport {
  if (report.type) return report;

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
  adminReports: [],
  isLoading: false,
  lastSync: null,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load from IndexedDB first
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const rawReports: CommunityReport[] = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const localReports = rawReports
        .map(migrateReport)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      db.close();

      set({ reports: localReports });

      // Sync with Supabase if configured
      if (isSupabaseConfigured()) {
        await get().syncWithSupabase();
      }

      set({ isLoading: false, lastSync: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to initialize reports store:', error);
      set({ isLoading: false });
    }
  },

  syncWithSupabase: async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch all non-deleted reports from Supabase
      const { data: supabaseReports, error } = await supabase
        .from('reports')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);

      // Fetch admin reports (verified FB reports)
      const { data: adminReportsData, error: adminError } = await supabase
        .from('admin_reports')
        .select('*')
        .is('deleted_at', null)
        .order('report_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase sync error:', error);
        return;
      }

      if (adminError) {
        console.error('Admin reports sync error:', adminError);
      }

      if (supabaseReports) {
        const serverReports = supabaseReports.map((r: Report) => fromSupabaseReport(r, user?.id));

        // Merge with local reports (keep local non-synced ones)
        const { reports: localReports } = get();
        const localOnlyReports = localReports.filter(r => !r.synced);

        // Combine and deduplicate
        const allReports = [...serverReports, ...localOnlyReports]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Update IndexedDB with synced reports
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await store.clear();
        for (const report of allReports) {
          await store.add(report);
        }

        db.close();

        // Convert admin reports to VerifiedReport format
        const verifiedReports: VerifiedReport[] = (adminReportsData || []).map((r: AdminReport) => ({
          id: r.id,
          reportDate: r.report_date,
          location: r.location,
          region: r.region,
          snowConditions: r.snow_conditions,
          hazards: r.hazards || [],
          safetyRating: r.safety_rating,
          authorName: r.author_name,
          sourceGroup: r.source_group,
          createdAt: r.created_at,
        }));

        set({
          reports: allReports,
          adminReports: verifiedReports,
          lastSync: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to sync with Supabase:', error);
    }
  },

  addReport: async (reportInput) => {
    set({ error: null });

    // If Supabase is configured, try to submit via Edge Function
    if (isSupabaseConfigured()) {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        set({
          error: {
            type: 'auth_required',
            message: 'Musisz być zalogowany, aby dodać raport',
          },
        });
        throw new Error('Authentication required');
      }

      try {
        const edgeFunctionUrl = getEdgeFunctionUrl('submit-report');
        const headers = await getAuthHeaders();

        // Build request body
        const body: Record<string, unknown> = {
          type: reportInput.type,
          location: reportInput.location,
          region: reportInput.region,
          coordinates: reportInput.coordinates,
          notes: reportInput.notes,
        };

        if (reportInput.type === 'ascent') {
          body.track_status = reportInput.ascent.trackStatus;
          body.gear_needed = reportInput.ascent.gearNeeded;
        } else {
          body.snow_condition = reportInput.descent.snowCondition;
          body.quality_rating = reportInput.descent.qualityRating;
        }

        const response = await fetch(edgeFunctionUrl!, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            set({
              error: {
                type: 'rate_limit',
                minutesRemaining: data.minutes_remaining || 30,
                message: data.message || 'Limit raportów przekroczony',
              },
            });
            throw new Error(data.message);
          }
          if (response.status === 401) {
            set({
              error: {
                type: 'auth_required',
                message: data.message || 'Musisz być zalogowany',
              },
            });
            throw new Error(data.message);
          }
          throw new Error(data.message || 'Failed to submit report');
        }

        // Add to local state
        const report: CommunityReport = {
          ...reportInput,
          id: data.report.id,
          timestamp: data.report.created_at,
          isOwn: true,
          userId: user.id,
          synced: true,
        };

        // Save to IndexedDB
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.add(report);
        db.close();

        set((state) => ({
          reports: [report, ...state.reports],
        }));

        return;
      } catch (error) {
        // If it's a known error type, rethrow
        if (error instanceof Error && (error.message.includes('Limit') || error.message.includes('zalogowany'))) {
          throw error;
        }
        console.error('Supabase submission failed:', error);
        // Fall through to local-only submission
      }
    }

    // Local-only submission (fallback or when Supabase not configured)
    const report: CommunityReport = {
      ...reportInput,
      id: generateId(),
      timestamp: new Date().toISOString(),
      isOwn: true,
      synced: false,
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

  deleteReport: async (id: string) => {
    set({ error: null });

    const { reports } = get();
    const report = reports.find(r => r.id === id);

    if (!report) {
      throw new Error('Report not found');
    }

    // If synced with Supabase, soft delete there
    if (report.synced && isSupabaseConfigured()) {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        set({
          error: {
            type: 'auth_required',
            message: 'Musisz być zalogowany, aby usunąć raport',
          },
        });
        throw new Error('Authentication required');
      }

      const { error } = await supabase
        .from('reports')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        } as never)
        .eq('id', id);

      if (error) {
        console.error('Failed to delete report from Supabase:', error);
        throw new Error('Failed to delete report');
      }
    }

    // Remove from IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await store.delete(id);
      db.close();
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error);
    }

    // Remove from state
    set((state) => ({
      reports: state.reports.filter(r => r.id !== id),
    }));
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

  getUserReports: (userId: string) => {
    const { reports } = get();
    return reports.filter((r) => r.userId === userId || (r.isOwn && !r.userId));
  },

  getAggregatedConditions: (region: string) => {
    const regionReports = get().getReportsForRegion(region);

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

      const conditionCounts = new Map<string, number>();
      for (const r of descentReports) {
        const cond = r.descent?.snowCondition || r.condition || 'unknown';
        conditionCounts.set(cond, (conditionCounts.get(cond) || 0) + 1);
      }
      const primaryCondition = [...conditionCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

      const ratings = descentReports
        .map((r) => r.descent?.qualityRating || r.rating || 0)
        .filter((r) => r > 0);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      const trackCounts = new Map<TrackStatus, number>();
      for (const r of ascentReports) {
        if (r.ascent?.trackStatus) {
          trackCounts.set(r.ascent.trackStatus, (trackCounts.get(r.ascent.trackStatus) || 0) + 1);
        }
      }
      const trackStatus = [...trackCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      const gearCounts = new Map<AscentGear, number>();
      for (const r of ascentReports) {
        for (const gear of r.ascent?.gearNeeded || []) {
          gearCounts.set(gear, (gearCounts.get(gear) || 0) + 1);
        }
      }
      const commonGear = [...gearCounts.entries()]
        .filter(([, count]) => count >= ascentReports.length * 0.3)
        .map(([gear]) => gear);

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

  getAdminReportsForRegion: (region: string) => {
    const { adminReports } = get();
    return adminReports.filter((r) =>
      r.region.toLowerCase().includes(region.toLowerCase()) ||
      region.toLowerCase().includes(r.region.toLowerCase())
    );
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
            // Only delete non-synced old reports
            if (new Date(report.timestamp).getTime() < cutoff && !report.synced) {
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
        reports: state.reports.filter((r) =>
          new Date(r.timestamp).getTime() >= cutoff || r.synced
        ),
      }));
    } catch (error) {
      console.error('Failed to clear old reports:', error);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
