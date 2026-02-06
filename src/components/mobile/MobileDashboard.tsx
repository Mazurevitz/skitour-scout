/**
 * Mobile Dashboard Component
 *
 * Mobile-first interface with map hero and bottom sheet navigation.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Settings as SettingsIcon,
  Plus,
  Mountain,
  Route,
  Radio,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useAppStore, useReportsStore, type NewReportInput } from '@/stores';
import { useAuthStore } from '@/stores/useAuthStore';
import { WeatherAgent } from '@/agents';
import { BottomSheet } from './BottomSheet';
import { MapView } from './MapView';
import { QuickReport } from './QuickReport';
import { CommunityIntel } from './CommunityIntel';
import { IntelSummary } from './IntelSummary';
import { AvalancheIndicator } from '../AvalancheIndicator';
import { RouteCard } from '../RouteCard';
import { IntelFeed } from '../IntelFeed';
import { Settings } from '../Settings';
import { UserDashboard } from '../UserDashboard';
import { AdminSettings } from '../admin/AdminSettings';
import { LoginButton } from '../auth/LoginButton';
import { ResortConditions } from '../ResortConditions';
import { ElevationWeatherCard } from '../ElevationWeatherCard';
import { t } from '@/lib/translations';

type ViewType = 'overview' | 'routes' | 'reports';

export function MobileDashboard() {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);
  const [showUserDashboard, setShowUserDashboard] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState(1);

  const {
    avalancheReport,
    routes,
    webReports,
    searchingWeb,
    searchStatus,
    loading,
    lastRefresh,
    initialized,
    config,
    elevationWeather,
    error,
    initialize,
    refreshAll,
    searchWeb,
    updateConfig,
    clearError,
  } = useAppStore();

  const {
    initialize: initReports,
    addReport,
    getRecentReports,
    getAdminReportsForRegion,
  } = useReportsStore();

  const { initialize: initAuth, cleanup: cleanupAuth } = useAuthStore();

  // Memoize expensive computations
  const regionLocations = useMemo(
    () => WeatherAgent.getLocationsByRegion(config.region),
    [config.region]
  );
  const locationNames = useMemo(() => Object.keys(regionLocations), [regionLocations]);

  const verifiedReports = useMemo(
    () => getAdminReportsForRegion(config.region),
    [getAdminReportsForRegion, config.region]
  );

  // Initialize stores
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
    initReports();
    initAuth();

    // Cleanup auth subscription on unmount
    return () => {
      cleanupAuth();
    };
  }, [initialized, initialize, initReports, initAuth, cleanupAuth]);

  // Handle navigation from LoginButton menu
  const handleNavigate = (view: 'dashboard' | 'settings' | 'admin') => {
    if (view === 'dashboard') {
      setShowUserDashboard(true);
    } else if (view === 'settings') {
      setShowSettings(true);
    } else if (view === 'admin') {
      setShowAdminSettings(true);
    }
  };

  const isLoading = loading.weather || loading.avalanche || loading.routes;

  // Memoize sorted routes to prevent re-sorting on every render
  const sortedRoutes = useMemo(
    () => [...routes].sort((a, b) => b.conditionScore - a.conditionScore),
    [routes]
  );

  const isTatry = useMemo(
    () => config.region.toLowerCase().includes('tatry'),
    [config.region]
  );

  // Get recent community reports for current region - memoized
  const recentReports = useMemo(() => {
    const regionLower = config.region.toLowerCase();
    return getRecentReports(48).filter(
      (r) => r.region.toLowerCase().includes(regionLower) ||
        regionLower.includes(r.region.toLowerCase())
    );
  }, [getRecentReports, config.region]);

  const recentReportsCount = recentReports.length;

  const handleReportSubmit = useCallback(async (report: NewReportInput) => {
    await addReport(report);
  }, [addReport]);

  const handleRouteSelect = useCallback((routeId: string) => {
    setSelectedRouteId(routeId);
    setActiveView('routes');
    setSheetSnap(2); // Expand sheet
  }, []);

  // Bottom sheet header with region picker and nav
  const sheetHeader = (
    <div className="space-y-3">
      {/* Region and controls */}
      <div className="flex items-center justify-between">
        <select
          value={config.region}
          onChange={(e) => {
            updateConfig({ region: e.target.value });
            setSelectedRouteId(null); // Clear selected route when region changes
            refreshAll();
          }}
          className="bg-gray-800 text-white text-sm font-medium rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 min-h-[44px]"
        >
          <optgroup label={t.regions.beskidy}>
            <option value="Beskid Śląski">{t.regions.beskidSlaski}</option>
            <option value="Beskid Żywiecki">{t.regions.beskidZywiecki}</option>
          </optgroup>
          <optgroup label={t.regions.tatry}>
            <option value="Tatry">{t.regions.tatry}</option>
          </optgroup>
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => refreshAll()}
            disabled={isLoading}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-800 transition-colors"
          >
            <RefreshCw
              className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-800 transition-colors"
          >
            <SettingsIcon className="w-5 h-5 text-gray-400" />
          </button>
          <LoginButton onNavigate={handleNavigate} />
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-gray-800/50 rounded-xl p-1">
        {[
          { id: 'overview', label: t.nav.overview, icon: Mountain, badge: 0 },
          { id: 'routes', label: t.nav.routes, icon: Route, badge: 0 },
          { id: 'reports', label: t.nav.reports, icon: Radio, badge: recentReportsCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as ViewType)}
            className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              activeView === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full bg-gray-900 relative">
      {/* Error Banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-red-900/95 border-b border-red-700 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 text-red-100">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error.message}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1.5 hover:bg-red-800 rounded-lg transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4 text-red-200" />
          </button>
        </div>
      )}

      {/* Map background */}
      <MapView
        region={config.region}
        routes={sortedRoutes}
        reports={recentReports}
        verifiedReports={verifiedReports}
        onRouteSelect={handleRouteSelect}
        selectedRouteId={selectedRouteId}
      />

      {/* Quick Report FAB */}
      <button
        onClick={() => setShowQuickReport(true)}
        className="fixed right-4 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        style={{ bottom: `calc(${[15, 50, 90][sheetSnap]}dvh + 16px)` }}
      >
        <Plus className="w-7 h-7 text-white" />
      </button>

      {/* Bottom Sheet */}
      <BottomSheet
        snapPoints={[15, 50, 90]}
        initialSnap={1}
        header={sheetHeader}
        onSnapChange={setSheetSnap}
      >
        <div className="p-4">
          {/* Overview View */}
          {activeView === 'overview' && (
            <div className="space-y-4">
              {/* Avalanche indicator - only for Tatry */}
              {isTatry && (
                <AvalancheIndicator
                  report={avalancheReport}
                  loading={loading.avalanche}
                  region={config.region}
                />
              )}

              {/* Multi-elevation Weather */}
              <ElevationWeatherCard
                data={elevationWeather}
                loading={loading.weather}
              />

              {/* Resort Conditions - snow depth reference & descent alternatives */}
              <ResortConditions region={config.region} />

              {/* Top Routes Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-white">{t.routes.topRoutes}</h2>
                  <button
                    onClick={() => setActiveView('routes')}
                    className="text-sm text-blue-400 hover:underline min-h-[44px] px-2 flex items-center"
                  >
                    {t.routes.viewAll}
                  </button>
                </div>
                <div className="space-y-2">
                  {loading.routes ? (
                    <div className="animate-pulse space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-gray-800 rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    sortedRoutes.slice(0, 3).map((route) => (
                      <div key={route.id} onClick={() => handleRouteSelect(route.id)}>
                        <RouteCard route={route} compact />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Last refresh */}
              {lastRefresh && (
                <div className="text-center text-xs text-gray-500 pt-2">
                  {t.weather.updated} {new Date(lastRefresh).toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          )}

          {/* Routes View */}
          {activeView === 'routes' && (
            <div className="space-y-3">
              {selectedRouteId && sortedRoutes.find((r) => r.id === selectedRouteId) ? (
                <>
                  <button
                    onClick={() => setSelectedRouteId(null)}
                    className="text-sm text-blue-400 hover:underline min-h-[44px] flex items-center"
                  >
                    ← Wszystkie trasy
                  </button>
                  <RouteCard
                    route={sortedRoutes.find((r) => r.id === selectedRouteId)!}
                  />
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">{routes.length} tras ocenionych</p>
                  {sortedRoutes.map((route) => (
                    <div key={route.id} onClick={() => setSelectedRouteId(route.id)}>
                      <RouteCard route={route} compact />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Reports View */}
          {activeView === 'reports' && (
            <div className="space-y-6">
              {/* AI Aggregated Summary */}
              <IntelSummary region={config.region} />

              {/* Community Reports Section */}
              <CommunityIntel region={config.region} />

              {/* Divider */}
              <div className="border-t border-gray-800 pt-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                  <Radio className="w-4 h-4 text-green-400" />
                  Źródła internetowe
                </h3>
                <IntelFeed
                  webReports={webReports}
                  verifiedReports={verifiedReports}
                  locations={locationNames}
                  searchingWeb={searchingWeb}
                  searchStatus={searchStatus}
                  onSearchWeb={searchWeb}
                />
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Modals */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showUserDashboard && <UserDashboard onClose={() => setShowUserDashboard(false)} />}
      {showAdminSettings && <AdminSettings onClose={() => setShowAdminSettings(false)} />}
      <QuickReport
        isOpen={showQuickReport}
        onClose={() => setShowQuickReport(false)}
        onSubmit={handleReportSubmit}
        currentRegion={config.region}
      />
    </div>
  );
}
