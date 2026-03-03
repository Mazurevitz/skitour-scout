/**
 * Map View Component
 *
 * Interactive map using Leaflet with OpenTopoMap base layer
 * and Waymarked Trails Winter overlay for ski routes.
 * Uses react-leaflet-cluster for dynamic zoom-based marker clustering.
 */

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Crosshair, Loader2 } from 'lucide-react';
import type { EvaluatedRoute } from '@/types';
import type { CommunityReport, VerifiedReport } from '@/stores/useReportsStore';
import { WeatherAgent } from '@/agents';
import { REGION_COORDS, ALL_REGIONS } from '@/constants';
import { getScoreHexColor } from '@/utils/scoreUtils';
import { isReportArchived } from '@/utils/relevanceScore';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet default marker icon (use CDN URLs instead of imports)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapViewProps {
  region: string;
  routes?: EvaluatedRoute[];
  reports?: CommunityReport[];
  verifiedReports?: VerifiedReport[];
  onRouteSelect?: (routeId: string) => void;
  selectedRouteId?: string | null;
  className?: string;
}

// Geocode location name to coordinates using known locations
function geocodeLocation(locationName: string, region: string): { lat: number; lng: number } | null {
  // If "Wszystkie" selected, search all regions
  const regionsToSearch = region === 'Wszystkie'
    ? [...ALL_REGIONS]
    : [region, ...ALL_REGIONS.filter(x => x !== region)];

  for (const r of regionsToSearch) {
    const locations = WeatherAgent.getLocationsByRegion(r);

    // Try exact match first
    for (const [name, coords] of Object.entries(locations)) {
      if (name.toLowerCase() === locationName.toLowerCase()) {
        return { lat: coords.latitude, lng: coords.longitude };
      }
    }

    // Try partial match
    for (const [name, coords] of Object.entries(locations)) {
      if (locationName.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(locationName.toLowerCase())) {
        return { lat: coords.latitude, lng: coords.longitude };
      }
    }
  }

  return null;
}

// Custom marker icons
function createScoreIcon(score: number, isSelected: boolean): L.DivIcon {
  const color = getScoreHexColor(score);
  const size = isSelected ? 44 : 36;
  const border = isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.5)';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isSelected ? '14px' : '12px'};
        border: ${border};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">${score}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createReportIcon(type: 'ascent' | 'descent', isArchived: boolean = false): L.DivIcon {
  // Archived reports are faded/grayed out
  const baseColor = type === 'ascent' ? '#22c55e' : '#3b82f6';
  const color = isArchived ? '#6b7280' : baseColor; // gray-500 for archived
  const arrow = type === 'ascent' ? '↑' : '↓';
  const opacity = isArchived ? '0.6' : '1';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 16px;
        border: 2px solid rgba(255,255,255,${isArchived ? '0.4' : '0.7'});
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        opacity: ${opacity};
      ">${arrow}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createVerifiedReportIcon(safetyRating: number): L.DivIcon {
  // Color based on safety rating (1=red, 5=green)
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  const color = colors[Math.min(Math.max((safetyRating || 3) - 1, 0), 4)];

  // Person icon SVG
  const personSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><circle cx="12" cy="7" r="4"/><path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/></svg>`;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255,255,255,0.9);
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">${personSvg}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Custom cluster icon for react-leaflet-cluster (community reports)
function createReportClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 44 : count < 50 ? 50 : 56;

  return L.divIcon({
    className: 'custom-cluster',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, #22c55e 0%, #22c55e 50%, #3b82f6 50%, #3b82f6 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 800;
        font-size: ${size > 48 ? '18px' : '16px'};
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,0,0,0.2);
        position: relative;
      ">
        <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${count}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Custom cluster icon for verified reports
function createVerifiedClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 46 : count < 50 ? 52 : 58;

  return L.divIcon({
    className: 'custom-cluster',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 800;
        font-size: ${size > 50 ? '18px' : '16px'};
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 0 2px rgba(22,163,74,0.3);
      ">
        <span style="text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${count}</span>
        <span style="
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: #16a34a;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">✓</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Component to handle map updates when region or markers change
function MapController({
  region,
  routes,
  reports,
}: {
  region: string;
  routes: EvaluatedRoute[];
  reports: CommunityReport[];
}) {
  const map = useMap();

  useEffect(() => {
    // Collect all points with coordinates
    const points: [number, number][] = [];

    // Add route summit coordinates
    routes.forEach((route) => {
      if (route.summit?.lat && route.summit?.lng) {
        points.push([route.summit.lat, route.summit.lng]);
      }
    });

    // Add report coordinates
    reports.forEach((report) => {
      if (report.coordinates?.lat && report.coordinates?.lng) {
        points.push([report.coordinates.lat, report.coordinates.lng]);
      }
    });

    if (points.length > 0) {
      // Create bounds from all points
      const bounds = L.latLngBounds(points);

      // Fit bounds with padding
      // Bottom padding is larger to account for the bottom sheet (50% of screen)
      // Top padding adds some space for the layer control
      map.fitBounds(bounds, {
        padding: [40, 40], // [top/bottom, left/right]
        paddingBottomRight: [40, 40],
        paddingTopLeft: [60, 40],
        maxZoom: 13, // Don't zoom in too much
        animate: true,
      });
    } else {
      // No points - fall back to region center
      const config = REGION_COORDS[region] || REGION_COORDS['Beskid Śląski'];
      map.setView(config.center, config.zoom, { animate: true });
    }
  }, [region, routes, reports, map]);

  return null;
}

// Center on user button component
function CenterOnUserButton() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleCenterOnUser = () => {
    if (!navigator.geolocation) {
      alert('Geolokalizacja nie jest obsługiwana');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.setView(
          [position.coords.latitude, position.coords.longitude],
          14,
          { animate: true }
        );
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        alert('Nie udało się pobrać lokalizacji');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <button
      onClick={handleCenterOnUser}
      disabled={isLocating}
      className="absolute top-4 right-4 z-[1000] w-10 h-10 bg-gray-900/90 hover:bg-gray-800 rounded-lg flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
      title="Centruj na mojej lokalizacji"
    >
      {isLocating ? (
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      ) : (
        <Crosshair className="w-5 h-5 text-white" />
      )}
    </button>
  );
}

export function MapView({
  region,
  routes = [],
  reports = [],
  verifiedReports = [],
  onRouteSelect,
  selectedRouteId,
  className = '',
}: MapViewProps) {
  const config = REGION_COORDS[region] || REGION_COORDS['Beskid Śląski'];

  // Filter reports with coordinates
  const reportsWithCoords = useMemo(() => {
    return reports.filter((r) => r.coordinates);
  }, [reports]);

  // Geocode verified reports
  const verifiedWithCoords = useMemo(() =>
    verifiedReports
      .map(r => {
        const coords = geocodeLocation(r.location, region);
        return coords ? { report: r, coords } : null;
      })
      .filter((r): r is { report: VerifiedReport; coords: { lat: number; lng: number } } => r !== null),
    [verifiedReports, region]
  );

  return (
    <div className={`absolute inset-0 z-0 ${className}`}>
      <MapContainer
        center={config.center}
        zoom={config.zoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        {/* Map controller for region changes and auto-fit bounds */}
        <MapController region={region} routes={routes} reports={reportsWithCoords} />

        {/* Center on user button */}
        <CenterOnUserButton />

        {/* Layer control */}
        <LayersControl position="topleft">
          {/* Base layers */}
          <LayersControl.BaseLayer checked name="OpenTopoMap">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
          </LayersControl.BaseLayer>

          {/* Overlay layers */}
          <LayersControl.Overlay checked name="Ski Routes">
            <TileLayer
              url="https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png"
              maxZoom={18}
              opacity={0.7}
              attribution='&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Route markers - use summit coordinates */}
        {routes.map((route) => (
          <Marker
            key={route.id}
            position={[route.summit.lat, route.summit.lng]}
            icon={createScoreIcon(route.conditionScore, selectedRouteId === route.id)}
            eventHandlers={{
              click: () => onRouteSelect?.(route.id),
            }}
          >
            <Popup className="route-popup" offset={[0, -20]}>
              <div className="p-1">
                <h3 className="font-bold text-sm">{route.name}</h3>
                <p className="text-xs text-gray-600">
                  {route.summit.altitude}m • +{route.elevation}m
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      route.conditionScore >= 70
                        ? 'bg-green-500'
                        : route.conditionScore >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  >
                    Ocena: {route.conditionScore}
                  </span>
                  <span className="text-xs text-gray-500">{route.difficulty}</span>
                </div>
                {route.recommendation && (
                  <p className="mt-1 text-xs text-gray-700">{route.recommendation}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Community report markers with dynamic zoom-based clustering */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createReportClusterIcon}
          maxClusterRadius={80}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          disableClusteringAtZoom={16}
        >
          {reportsWithCoords.map((report) => {
            const reportIsArchived = isReportArchived(report.timestamp);
            return (
              <Marker
                key={report.id}
                position={[report.coordinates!.lat, report.coordinates!.lng]}
                icon={createReportIcon(report.type || 'descent', reportIsArchived)}
              >
                <Popup offset={[0, -16]} maxHeight={300} minWidth={220}>
                  <div className="p-1">
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                          reportIsArchived
                            ? 'bg-gray-500'
                            : report.type === 'ascent' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                      >
                        {report.type === 'ascent' ? '↑ Podejście' : '↓ Zjazd'}
                      </span>
                      {reportIsArchived && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600">
                          Archiwum
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm">{report.location}</h3>
                    {report.type === 'ascent' && report.ascent && (
                      <p className="text-xs text-gray-600">
                        Trasa: {report.ascent.trackStatus}
                        {report.ascent.gearNeeded.length > 0 && (
                          <> • Sprzęt: {report.ascent.gearNeeded.join(', ')}</>
                        )}
                      </p>
                    )}
                    {report.type === 'descent' && report.descent && (
                      <p className="text-xs text-gray-600">
                        Śnieg: {report.descent.snowCondition} • {'★'.repeat(report.descent.qualityRating)}
                      </p>
                    )}
                    {report.notes && (
                      <p className="mt-1 text-xs text-gray-700 italic">"{report.notes}"</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(report.timestamp).toLocaleDateString('pl-PL')}
                    </p>
                    {reportIsArchived && (
                      <p className="mt-1 text-xs text-orange-600 italic">
                        ⚠ Raport starszy niż 2 tygodnie - tylko do wglądu
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* Verified FB report markers with dynamic clustering */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createVerifiedClusterIcon}
          maxClusterRadius={80}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          disableClusteringAtZoom={16}
        >
          {verifiedWithCoords.map(({ report, coords }) => (
            <Marker
              key={report.id}
              position={[coords.lat, coords.lng]}
              icon={createVerifiedReportIcon(report.safetyRating)}
            >
              <Popup offset={[0, -17]} maxHeight={300} minWidth={240}>
                <div className="p-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="px-2 py-0.5 rounded text-xs font-medium text-white bg-green-600">
                      ✓ Zweryfikowane
                    </span>
                    {report.sourceGroup && (
                      <span className="text-xs text-gray-500">{report.sourceGroup}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm">{report.location}</h3>
                  {report.snowConditions && (
                    <p className="text-xs text-gray-600 mt-1">{report.snowConditions}</p>
                  )}
                  {report.hazards.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ {report.hazards.join(', ')}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {new Date(report.reportDate).toLocaleDateString('pl-PL')}
                    </span>
                    <span className={`text-xs font-medium ${
                      report.safetyRating >= 4 ? 'text-green-600' :
                      report.safetyRating >= 3 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      Bezpieczeństwo: {report.safetyRating}/5
                    </span>
                  </div>
                  {report.authorName && (
                    <p className="text-xs text-gray-400 mt-1">— {report.authorName}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Attribution */}
        <div className="absolute bottom-2 left-2 z-[1000] text-[10px] text-gray-600 bg-white/80 px-1 rounded">
          © OpenTopoMap, Waymarked Trails
        </div>
      </MapContainer>

      {/* Custom styles for Leaflet */}
      <style>{`
        .leaflet-container {
          background: #1f2937;
          font-family: inherit;
        }
        .leaflet-control-layers {
          background: rgba(17, 24, 39, 0.95) !important;
          border: 1px solid #374151 !important;
          border-radius: 8px !important;
          color: white !important;
        }
        .leaflet-control-layers-toggle {
          background-color: rgba(17, 24, 39, 0.95) !important;
          border: 1px solid #374151 !important;
          width: 36px !important;
          height: 36px !important;
        }
        .leaflet-control-layers-list {
          padding: 8px !important;
        }
        .leaflet-control-layers label {
          color: #d1d5db !important;
          font-size: 12px !important;
        }
        .leaflet-control-layers-selector {
          margin-right: 6px !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          max-height: 320px;
        }
        .leaflet-popup-content::-webkit-scrollbar {
          width: 4px;
        }
        .leaflet-popup-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 2px;
        }
        .leaflet-popup-content::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
