/**
 * Map View Component
 *
 * Background map showing mountain regions and routes.
 * Currently a styled placeholder - can integrate Leaflet/Mapbox later.
 */

import { Mountain, Navigation } from 'lucide-react';
import type { EvaluatedRoute } from '@/types';

interface MapViewProps {
  region: string;
  routes?: EvaluatedRoute[];
  onRouteSelect?: (routeId: string) => void;
  selectedRouteId?: string | null;
}

// Region center coordinates and zoom
const REGION_CONFIG: Record<string, { lat: number; lng: number; peaks: { name: string; lat: number; lng: number }[] }> = {
  'Beskid Śląski': {
    lat: 49.68,
    lng: 18.95,
    peaks: [
      { name: 'Skrzyczne', lat: 49.6847, lng: 19.0311 },
      { name: 'Barania Góra', lat: 49.5783, lng: 19.0253 },
      { name: 'Klimczok', lat: 49.7367, lng: 18.9567 },
    ],
  },
  'Beskid Żywiecki': {
    lat: 49.57,
    lng: 19.20,
    peaks: [
      { name: 'Babia Góra', lat: 49.5731, lng: 19.5294 },
      { name: 'Pilsko', lat: 49.5456, lng: 19.3344 },
      { name: 'Romanka', lat: 49.5833, lng: 19.2167 },
    ],
  },
  'Tatry': {
    lat: 49.23,
    lng: 20.00,
    peaks: [
      { name: 'Kasprowy', lat: 49.2317, lng: 19.9817 },
      { name: 'Rysy', lat: 49.1794, lng: 20.0881 },
      { name: 'Świnica', lat: 49.2194, lng: 20.0039 },
    ],
  },
};

export function MapView({ region, routes = [], onRouteSelect, selectedRouteId }: MapViewProps) {
  const config = REGION_CONFIG[region] || REGION_CONFIG['Beskid Śląski'];

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-700 to-slate-900 overflow-hidden">
      {/* Topographic pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q25 30 50 50 T100 50' fill='none' stroke='%23fff' stroke-width='0.5'/%3E%3Cpath d='M0 70 Q25 50 50 70 T100 70' fill='none' stroke='%23fff' stroke-width='0.5'/%3E%3Cpath d='M0 30 Q25 10 50 30 T100 30' fill='none' stroke='%23fff' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Mountain silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 h-1/2 opacity-20"
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
      >
        <polygon
          points="0,50 10,35 25,45 35,25 50,40 60,20 75,35 85,28 100,50"
          fill="currentColor"
          className="text-white"
        />
      </svg>

      {/* Peak markers */}
      {config.peaks.map((peak, index) => (
        <div
          key={peak.name}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${20 + index * 30}%`,
            top: `${25 + (index % 2) * 15}%`,
          }}
        >
          <div className="flex flex-col items-center">
            <Mountain className="w-6 h-6 text-white/60" />
            <span className="text-xs text-white/50 mt-1 whitespace-nowrap">{peak.name}</span>
          </div>
        </div>
      ))}

      {/* Route markers */}
      {routes.slice(0, 5).map((route, index) => (
        <button
          key={route.id}
          onClick={() => onRouteSelect?.(route.id)}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
            selectedRouteId === route.id ? 'scale-125 z-10' : 'hover:scale-110'
          }`}
          style={{
            left: `${15 + index * 18}%`,
            top: `${40 + (index % 3) * 10}%`,
          }}
        >
          <div className="relative">
            <div className={`w-10 h-10 rounded-full ${getScoreColor(route.conditionScore)} flex items-center justify-center shadow-lg border-2 border-white/30`}>
              <span className="text-white text-sm font-bold">{route.conditionScore}</span>
            </div>
            {selectedRouteId === route.id && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/90 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
                {route.name}
              </div>
            )}
          </div>
        </button>
      ))}

      {/* Region label */}
      <div className="absolute top-4 left-4 right-4">
        <div className="flex items-center gap-2 text-white/70">
          <Navigation className="w-4 h-4" />
          <span className="text-sm font-medium">{region}</span>
        </div>
      </div>

      {/* Compass */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-900/50 flex items-center justify-center">
        <span className="text-white/70 text-xs font-bold">N</span>
      </div>

      {/* Coordinates display */}
      <div className="absolute bottom-4 left-4 text-white/40 text-xs font-mono">
        {config.lat.toFixed(2)}°N {config.lng.toFixed(2)}°E
      </div>
    </div>
  );
}
