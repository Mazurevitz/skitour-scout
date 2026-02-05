/**
 * Map View Component
 *
 * Interactive map using Leaflet with OpenTopoMap base layer
 * and Waymarked Trails Winter overlay for ski routes.
 */

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, Loader2 } from 'lucide-react';
import type { EvaluatedRoute } from '@/types';
import type { CommunityReport } from '@/stores/useReportsStore';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

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
  onRouteSelect?: (routeId: string) => void;
  selectedRouteId?: string | null;
}

// Region center coordinates
const REGION_CONFIG: Record<string, { center: [number, number]; zoom: number }> = {
  'Beskid Śląski': { center: [49.68, 19.0], zoom: 11 },
  'Beskid Żywiecki': { center: [49.57, 19.35], zoom: 11 },
  'Tatry': { center: [49.23, 20.0], zoom: 11 },
};

// Custom marker icons
function createScoreIcon(score: number, isSelected: boolean): L.DivIcon {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
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
        transform: translate(-50%, -50%);
      ">${score}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createReportIcon(type: 'ascent' | 'descent'): L.DivIcon {
  const color = type === 'ascent' ? '#22c55e' : '#3b82f6';
  const arrow = type === 'ascent' ? '↑' : '↓';

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
        border: 2px solid rgba(255,255,255,0.7);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      ">${arrow}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
      const config = REGION_CONFIG[region] || REGION_CONFIG['Beskid Śląski'];
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
  onRouteSelect,
  selectedRouteId,
}: MapViewProps) {
  const config = REGION_CONFIG[region] || REGION_CONFIG['Beskid Śląski'];

  // Filter reports with coordinates
  const reportsWithCoords = reports.filter((r) => r.coordinates);

  return (
    <div className="absolute inset-0 z-0">
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
            <Popup className="route-popup">
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

        {/* Community report markers */}
        {reportsWithCoords.map((report) => (
          <Marker
            key={report.id}
            position={[report.coordinates!.lat, report.coordinates!.lng]}
            icon={createReportIcon(report.type || 'descent')}
          >
            <Popup>
              <div className="p-1">
                <div className="flex items-center gap-1 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                      report.type === 'ascent' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  >
                    {report.type === 'ascent' ? '↑ Podejście' : '↓ Zjazd'}
                  </span>
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
                  {new Date(report.timestamp).toLocaleDateString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

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
      `}</style>
    </div>
  );
}
