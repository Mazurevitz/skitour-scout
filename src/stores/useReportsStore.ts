/**
 * Community Reports Store
 *
 * Manages community-submitted condition reports using IndexedDB for persistence
 * with Supabase sync for authenticated users.
 *
 * @module stores/useReportsStore
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured, getEdgeFunctionUrl, getAuthHeaders, Report, AdminReport, ReportInsert } from '../lib/supabase';
import { queueOperation, getPendingCount } from '../services/retryQueue';
import type { WeatherSnapshot, RelevanceFactors, ElevationWeather } from '../types';
import {
  calculateRelevanceScore,
  calculateBaseRelevanceScore,
  calculateReportWeight,
  isReportArchived,
} from '../utils/relevanceScore';

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
  /** Weather conditions at time of report submission */
  weatherSnapshot?: WeatherSnapshot;
  /** Calculated relevance score (0-100) */
  relevanceScore?: number;
  /** Breakdown of relevance factors */
  relevanceFactors?: RelevanceFactors;

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
  /** Average relevance score of reports at this location */
  averageRelevance: number;
  /** The most relevant report at this location */
  mostRelevantReport?: CommunityReport;
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
  /** Weather snapshot at time of submission */
  weatherSnapshot?: WeatherSnapshot;
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
  /** Number of operations pending retry */
  pendingOperations: number;

  // Actions
  initialize: () => Promise<void>;
  addReport: (report: NewReportInput) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  syncWithSupabase: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  calculateAllRelevance: (currentWeather: ElevationWeather | undefined) => void;
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

// ============================================================
// DEV MOCK DATA - Remove this entire section before committing
// ============================================================
const DEV_MOCK_ENABLED = true; // Set to false to disable mocks

function createMockReports(): CommunityReport[] {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  return [
    // Fresh report (2 hours ago) - full weight
    {
      id: 'mock-1',
      type: 'descent',
      location: 'Skrzyczne',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.6847, lng: 19.0306 },
      timestamp: new Date(now - 2 * HOUR).toISOString(),
      descent: { snowCondition: 'puch', qualityRating: 5 },
      notes: 'Świeży puch po nocnych opadach, świetne warunki!',
      isOwn: false,
      relevanceScore: 95,
    },
    // Recent report (1 day ago) - high weight
    {
      id: 'mock-2',
      type: 'ascent',
      location: 'Skrzyczne',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.7181, lng: 19.0339 },
      timestamp: new Date(now - 1 * DAY).toISOString(),
      ascent: { trackStatus: 'przetarte', gearNeeded: ['foki'] },
      notes: 'Trasa przetarta do szczytu',
      isOwn: false,
      relevanceScore: 82,
    },
    // 3 days ago - medium weight
    {
      id: 'mock-3',
      type: 'descent',
      location: 'Pilsko',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.5456, lng: 19.3297 },
      timestamp: new Date(now - 3 * DAY).toISOString(),
      descent: { snowCondition: 'firn', qualityRating: 4 },
      notes: 'Firn od rana, potem mięknie',
      isOwn: false,
      relevanceScore: 68,
    },
    // 5 days ago - lower weight
    {
      id: 'mock-4',
      type: 'ascent',
      location: 'Pilsko',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.5617, lng: 19.3417 },
      timestamp: new Date(now - 5 * DAY).toISOString(),
      ascent: { trackStatus: 'zasypane', gearNeeded: ['foki', 'harszle'] },
      notes: 'Trasa zasypana, trzeba tropić',
      isOwn: false,
      relevanceScore: 55,
    },
    // 8 days ago - minimum weight
    {
      id: 'mock-5',
      type: 'descent',
      location: 'Babia Góra',
      region: 'Beskid Żywiecki',
      coordinates: { lat: 49.5731, lng: 19.5294 },
      timestamp: new Date(now - 8 * DAY).toISOString(),
      descent: { snowCondition: 'szren', qualityRating: 3 },
      notes: 'Szreń na eksponowanych miejscach',
      isOwn: false,
      relevanceScore: 42,
    },
    // 10 days ago - minimum weight
    {
      id: 'mock-6',
      type: 'descent',
      location: 'Kasprowy Wierch',
      region: 'Tatry',
      coordinates: { lat: 49.2317, lng: 19.9817 },
      timestamp: new Date(now - 10 * DAY).toISOString(),
      descent: { snowCondition: 'puch', qualityRating: 5 },
      notes: 'Goryczkowa w świetnej formie',
      isOwn: false,
      relevanceScore: 35,
    },
    // 15 days ago - ARCHIVED (older than 2 weeks)
    {
      id: 'mock-7',
      type: 'descent',
      location: 'Skrzyczne',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.6847, lng: 19.0306 },
      timestamp: new Date(now - 15 * DAY).toISOString(),
      descent: { snowCondition: 'beton', qualityRating: 2 },
      notes: 'Stary raport - beton po odwilży',
      isOwn: false,
      relevanceScore: 15,
    },
    // 18 days ago - ARCHIVED
    {
      id: 'mock-8',
      type: 'ascent',
      location: 'Rysy',
      region: 'Tatry',
      coordinates: { lat: 49.1794, lng: 20.0881 },
      timestamp: new Date(now - 18 * DAY).toISOString(),
      ascent: { trackStatus: 'lod', gearNeeded: ['raki', 'harszle'] },
      notes: 'Archiwalny raport - lód na grani',
      isOwn: false,
      relevanceScore: 10,
    },
    // 20 days ago - ARCHIVED (same location as fresh one - test clustering)
    {
      id: 'mock-9',
      type: 'descent',
      location: 'Skrzyczne',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.6850, lng: 19.0310 }, // Slightly offset for clustering test
      timestamp: new Date(now - 20 * DAY).toISOString(),
      descent: { snowCondition: 'kamienie', qualityRating: 1 },
      notes: 'Bardzo stary raport - kamienie',
      isOwn: false,
      relevanceScore: 5,
    },
    // CLUSTERING TEST: Multiple reports at exact same location
    {
      id: 'mock-cluster-1',
      type: 'descent',
      location: 'Pilsko - Szczyt',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.5456, lng: 19.3297 }, // Same as mock-3
      timestamp: new Date(now - 4 * HOUR).toISOString(),
      descent: { snowCondition: 'puch', qualityRating: 4 },
      notes: 'Test klastrowania - raport 1',
      isOwn: false,
    },
    {
      id: 'mock-cluster-2',
      type: 'ascent',
      location: 'Pilsko - Szczyt',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.5458, lng: 19.3295 }, // Very close
      timestamp: new Date(now - 6 * HOUR).toISOString(),
      ascent: { trackStatus: 'przetarte', gearNeeded: ['foki'] },
      notes: 'Test klastrowania - raport 2',
      isOwn: false,
    },
    {
      id: 'mock-cluster-3',
      type: 'descent',
      location: 'Pilsko - Szczyt',
      region: 'Beskid Śląski',
      coordinates: { lat: 49.5454, lng: 19.3299 }, // Very close
      timestamp: new Date(now - 8 * HOUR).toISOString(),
      descent: { snowCondition: 'firn', qualityRating: 5 },
      notes: 'Test klastrowania - raport 3',
      isOwn: false,
    },
  ];
}
// ============================================================
// END DEV MOCK DATA
// ============================================================

export const useReportsStore = create<ReportsState>((set, get) => ({
  reports: [],
  adminReports: [],
  isLoading: false,
  lastSync: null,
  error: null,
  pendingOperations: 0,

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

      let localReports = rawReports
        .map(migrateReport)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      db.close();

      // DEV MOCK: Inject mock reports in development
      if (DEV_MOCK_ENABLED && import.meta.env.DEV) {
        console.log('📊 DEV: Injecting mock reports for testing');
        const mockReports = createMockReports();
        // Prepend mocks to any existing reports (mocks have 'mock-' prefix IDs)
        localReports = [...mockReports, ...localReports.filter(r => !r.id.startsWith('mock-'))];
      }

      set({ reports: localReports });

      // Sync with Supabase if configured
      if (isSupabaseConfigured()) {
        await get().syncWithSupabase();
      }

      // Refresh pending operations count
      await get().refreshPendingCount();

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
        const { reports: localReports } = get();

        // === TWO-WAY SYNC WITH CONFLICT RESOLUTION ===

        // 1. Build maps for efficient lookup
        const serverReportMap = new Map(serverReports.map(r => [r.id, r]));
        const localReportMap = new Map(localReports.map(r => [r.id, r]));

        // 2. Find local unsynced reports to push to server
        const localUnsyncedReports = localReports.filter(r => !r.synced && user);

        // 3. Push unsynced local reports to Supabase
        for (const localReport of localUnsyncedReports) {
          try {
            // Build the report data for Supabase insert
            const insertData: ReportInsert = {
              user_id: user!.id,
              type: localReport.type,
              location: localReport.location,
              region: localReport.region,
              coordinates: localReport.coordinates,
              notes: localReport.notes,
            };

            // Add type-specific fields
            if (localReport.type === 'ascent' && localReport.ascent) {
              insertData.track_status = localReport.ascent.trackStatus;
              insertData.gear_needed = localReport.ascent.gearNeeded;
            } else if (localReport.type === 'descent' && localReport.descent) {
              insertData.snow_condition = localReport.descent.snowCondition;
              insertData.quality_rating = localReport.descent.qualityRating;
            }

            // Insert to Supabase (type assertion needed due to generated types)
            const { data: insertedReport, error: insertError } = await supabase
              .from('reports')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .insert(insertData as any)
              .select()
              .single();

            if (!insertError && insertedReport) {
              // Update local report with server ID and mark as synced
              const syncedReport = { ...localReport };
              syncedReport.id = (insertedReport as Report).id;
              syncedReport.synced = true;
              syncedReport.userId = user!.id;
              serverReportMap.set(syncedReport.id, syncedReport);
              // Update in local map too
              localReportMap.set(syncedReport.id, syncedReport);
              // Remove old local ID
              localReportMap.delete(localReport.id);
            }
          } catch (err) {
            console.warn('Failed to sync local report to server:', err);
            // Keep as unsynced for next attempt
          }
        }

        // 4. Merge with conflict resolution (last-write-wins)
        const mergedReports: CommunityReport[] = [];
        const seenIds = new Set<string>();

        // Process all unique IDs from both sources
        const allIds = new Set([...serverReportMap.keys(), ...localReportMap.keys()]);

        for (const id of allIds) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const serverReport = serverReportMap.get(id);
          const localReport = localReportMap.get(id);

          if (serverReport && localReport) {
            // Conflict: both exist - use last-write-wins based on timestamp
            const serverTime = new Date(serverReport.timestamp).getTime();
            const localTime = new Date(localReport.timestamp).getTime();

            if (localTime > serverTime && !localReport.synced) {
              // Local is newer and unsynced - keep local (will sync next time)
              mergedReports.push(localReport);
            } else {
              // Server is newer or same - use server version
              mergedReports.push(serverReport);
            }
          } else if (serverReport) {
            mergedReports.push(serverReport);
          } else if (localReport) {
            mergedReports.push(localReport);
          }
        }

        // Sort by timestamp descending
        const allReports = mergedReports.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Update IndexedDB with merged reports
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

  refreshPendingCount: async () => {
    try {
      const count = await getPendingCount();
      set({ pendingOperations: count });
    } catch (error) {
      console.error('Failed to get pending count:', error);
    }
  },

  calculateAllRelevance: (currentWeather: ElevationWeather | undefined) => {
    const { reports } = get();

    // Group reports by location for consistency calculation
    const byLocation = new Map<string, CommunityReport[]>();
    for (const report of reports) {
      const existing = byLocation.get(report.location) || [];
      existing.push(report);
      byLocation.set(report.location, existing);
    }

    // Calculate relevance for each report
    const updatedReports = reports.map((report) => {
      const locationReports = byLocation.get(report.location) || [];
      // Count similar reports in last 24h
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const similarReportCount = locationReports.filter(
        (r) => new Date(r.timestamp).getTime() > cutoff24h
      ).length;

      let relevanceFactors: RelevanceFactors;

      if (report.weatherSnapshot) {
        // Full calculation with weather snapshot
        relevanceFactors = calculateRelevanceScore(
          report.timestamp,
          report.weatherSnapshot,
          currentWeather,
          similarReportCount
        );
      } else {
        // Base calculation for reports without weather data
        relevanceFactors = calculateBaseRelevanceScore(report.timestamp);
      }

      return {
        ...report,
        relevanceScore: relevanceFactors.finalScore,
        relevanceFactors,
      };
    });

    set({ reports: updatedReports });
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

        // Check if it's a network error - queue for retry
        const isNetworkError = !navigator.onLine ||
          (error instanceof Error && (
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('Failed to fetch')
          ));

        if (isNetworkError) {
          // Queue for retry when back online
          await queueOperation('add_report', reportInput);
          await get().refreshPendingCount();
        }

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
    // Return all reports for "Wszystkie" (All)
    if (region === 'Wszystkie') {
      return reports;
    }
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
      // Filter out archived reports for aggregation (older than 2 weeks)
      // They will still be shown for reference but not counted in stats
      const activeReports = reports.filter((r) => !isReportArchived(r.timestamp));

      // If all reports are archived, skip this location in aggregation
      if (activeReports.length === 0) {
        continue;
      }

      const ascentReports = activeReports.filter((r) => r.type === 'ascent');
      const descentReports = activeReports.filter((r) => r.type === 'descent');

      // Use weighted counts for condition aggregation
      const conditionWeights = new Map<string, number>();
      for (const r of descentReports) {
        const cond = r.descent?.snowCondition || r.condition || 'unknown';
        const weight = calculateReportWeight(r.timestamp);
        conditionWeights.set(cond, (conditionWeights.get(cond) || 0) + weight);
      }
      const primaryCondition = [...conditionWeights.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

      // Calculate weighted average rating
      let weightedRatingSum = 0;
      let totalRatingWeight = 0;
      for (const r of descentReports) {
        const rating = r.descent?.qualityRating || r.rating || 0;
        if (rating > 0) {
          const weight = calculateReportWeight(r.timestamp);
          weightedRatingSum += rating * weight;
          totalRatingWeight += weight;
        }
      }
      const avgRating = totalRatingWeight > 0
        ? weightedRatingSum / totalRatingWeight
        : 0;

      // Use weighted counts for track status
      const trackWeights = new Map<TrackStatus, number>();
      for (const r of ascentReports) {
        if (r.ascent?.trackStatus) {
          const weight = calculateReportWeight(r.timestamp);
          trackWeights.set(r.ascent.trackStatus, (trackWeights.get(r.ascent.trackStatus) || 0) + weight);
        }
      }
      const trackStatus = [...trackWeights.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      // Use weighted counts for gear
      const gearWeights = new Map<AscentGear, number>();
      let totalAscentWeight = 0;
      for (const r of ascentReports) {
        const weight = calculateReportWeight(r.timestamp);
        totalAscentWeight += weight;
        for (const gear of r.ascent?.gearNeeded || []) {
          gearWeights.set(gear, (gearWeights.get(gear) || 0) + weight);
        }
      }
      const commonGear = [...gearWeights.entries()]
        .filter(([, weight]) => totalAscentWeight > 0 && weight >= totalAscentWeight * 0.3)
        .map(([gear]) => gear);

      // Only consider hazards from active (non-archived) reports
      const hazards: string[] = [];
      const hazardKeywords = ['lawina', 'lód', 'mgła', 'wiatr', 'kamienie', 'niebezp'];
      for (const r of activeReports) {
        if (r.notes) {
          for (const kw of hazardKeywords) {
            if (r.notes.toLowerCase().includes(kw) && !hazards.includes(kw)) {
              hazards.push(kw);
            }
          }
        }
      }

      // Calculate weighted average relevance from active reports
      let weightedRelevanceSum = 0;
      let totalRelevanceWeight = 0;
      for (const r of activeReports) {
        if (r.relevanceScore !== undefined) {
          const weight = calculateReportWeight(r.timestamp);
          weightedRelevanceSum += r.relevanceScore * weight;
          totalRelevanceWeight += weight;
        }
      }
      const averageRelevance = totalRelevanceWeight > 0
        ? Math.round(weightedRelevanceSum / totalRelevanceWeight)
        : 0;

      const mostRelevantReport = [...activeReports]
        .filter((r) => r.relevanceScore !== undefined)
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))[0];

      aggregated.push({
        location,
        region: reports[0].region,
        primaryCondition,
        averageRating: Math.round(avgRating * 10) / 10,
        reportCount: activeReports.length,
        ascentCount: ascentReports.length,
        descentCount: descentReports.length,
        lastReport: activeReports[0].timestamp,
        trackStatus,
        commonGear,
        hazards,
        averageRelevance,
        mostRelevantReport,
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
    // Return all reports for "Wszystkie" (All)
    if (region === 'Wszystkie') {
      return adminReports;
    }
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
