/**
 * Main Dashboard Component
 *
 * The primary view of SkitourScout showing all data in a scannable format.
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Settings as SettingsIcon, Mountain, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/stores';
import { WeatherAgent } from '@/agents';
import { AvalancheIndicator } from './AvalancheIndicator';
import { WeatherCard } from './WeatherCard';
import { RouteCard } from './RouteCard';
import { IntelFeed } from './IntelFeed';
import { Settings } from './Settings';

type TabType = 'overview' | 'routes' | 'intel';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const {
    weather,
    avalancheReport,
    routes,
    webReports,
    searchingWeb,
    searchStatus,
    loading,
    lastRefresh,
    initialized,
    config,
    initialize,
    refreshAll,
    searchWeb,
    updateConfig,
  } = useAppStore();

  // Get available locations for current region
  const regionLocations = WeatherAgent.getLocationsByRegion(config.region);
  const locationNames = Object.keys(regionLocations);

  // Initialize on mount
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  const isLoading = loading.weather || loading.avalanche || loading.routes;

  const selectedRoute = selectedRouteId
    ? routes.find((r) => r.id === selectedRouteId)
    : null;

  // Sort routes by condition score
  const sortedRoutes = [...routes].sort((a, b) => b.conditionScore - a.conditionScore);
  const topRoutes = sortedRoutes.slice(0, 3);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
        <div className="relative">
          <button
            onClick={() => setShowRegionPicker(!showRegionPicker)}
            className="flex items-center gap-2 hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors"
          >
            <Mountain size={18} className="text-blue-400" />
            <span className="font-medium text-sm">{config.region}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* Region picker dropdown */}
          {showRegionPicker && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px]">
              <div className="p-1">
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">Beskidy</div>
                {['Beskid Śląski', 'Beskid Żywiecki'].map((region) => (
                  <button
                    key={region}
                    onClick={() => {
                      updateConfig({ region });
                      setShowRegionPicker(false);
                      refreshAll();
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      config.region === region
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {region}
                  </button>
                ))}
                <div className="px-2 py-1 text-xs text-gray-500 font-medium mt-1">Tatry</div>
                <button
                  onClick={() => {
                    updateConfig({ region: 'Tatry' });
                    setShowRegionPicker(false);
                    refreshAll();
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    config.region === 'Tatry'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Tatry
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshAll()}
            disabled={isLoading}
            className={`p-2 rounded-lg hover:bg-gray-800 transition-colors ${
              isLoading ? 'opacity-50' : ''
            }`}
            title="Refresh data"
          >
            <RefreshCw
              size={18}
              className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Settings"
          >
            <SettingsIcon size={18} className="text-gray-400" />
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex border-b border-gray-800">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'routes', label: 'Routes' },
          { id: 'intel', label: 'Intel' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Avalanche indicator - only for Tatry (TOPR coverage) */}
            {config.region.toLowerCase().includes('tatry') && (
              <AvalancheIndicator
                report={avalancheReport}
                loading={loading.avalanche}
                region={config.region}
              />
            )}

            {/* Weather */}
            <WeatherCard
              weather={weather}
              loading={loading.weather}
              locationName={locationNames[0]}
            />

            {/* Top routes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-gray-400">
                  Top Routes Today
                </h2>
                <button
                  onClick={() => setActiveTab('routes')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {loading.routes ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-800 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  topRoutes.map((route) => (
                    <RouteCard
                      key={route.id}
                      route={route}
                      compact
                    />
                  ))
                )}
              </div>
            </div>

            {/* Last refresh */}
            {lastRefresh && (
              <div className="text-center text-xs text-gray-500 pt-2">
                Last updated:{' '}
                {new Date(lastRefresh).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="p-4">
            {selectedRoute ? (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedRouteId(null)}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:underline"
                >
                  <ChevronDown size={16} className="rotate-90" />
                  Back to list
                </button>
                <RouteCard route={selectedRoute} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-400 mb-2">
                  {routes.length} routes evaluated
                </div>
                {sortedRoutes.map((route) => (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRouteId(route.id)}
                  >
                    <RouteCard route={route} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'intel' && (
          <div className="p-4">
            <IntelFeed
              webReports={webReports}
              locations={locationNames}
              searchingWeb={searchingWeb}
              searchStatus={searchStatus}
              onSearchWeb={searchWeb}
            />
          </div>
        )}
      </main>

      {/* Settings modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
