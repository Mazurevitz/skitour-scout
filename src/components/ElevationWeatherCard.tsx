/**
 * Elevation Weather Card Component
 *
 * Shows weather comparison between valley and summit.
 * Helps users understand temperature gradient and what to expect
 * at different points of their ski tour.
 */

import { useState } from 'react';
import {
  Mountain,
  Thermometer,
  Wind,
  ChevronDown,
  ChevronUp,
  Snowflake,
  ArrowDown,
  Sun,
  Cloud,
  CloudSnow,
  CloudRain,
  CloudFog,
} from 'lucide-react';
import type { ElevationWeather, WeatherCondition } from '@/types';

interface ElevationWeatherCardProps {
  data: ElevationWeather[];
  loading?: boolean;
}

const conditionIcons: Record<WeatherCondition, typeof Sun> = {
  clear: Sun,
  partly_cloudy: Cloud,
  cloudy: Cloud,
  snow: CloudSnow,
  heavy_snow: CloudSnow,
  rain: CloudRain,
  fog: CloudFog,
  wind: Wind,
};

function getConditionLabel(condition: WeatherCondition): string {
  const labels: Record<WeatherCondition, string> = {
    clear: 'Słonecznie',
    partly_cloudy: 'Częściowe zachmurzenie',
    cloudy: 'Pochmurno',
    snow: 'Śnieg',
    heavy_snow: 'Intensywny śnieg',
    rain: 'Deszcz',
    fog: 'Mgła',
    wind: 'Wietrznie',
  };
  return labels[condition];
}

function getTempColor(temp: number): string {
  if (temp <= -15) return 'text-blue-300';
  if (temp <= -10) return 'text-blue-400';
  if (temp <= -5) return 'text-cyan-400';
  if (temp <= 0) return 'text-cyan-300';
  if (temp <= 5) return 'text-yellow-400';
  return 'text-orange-400';
}

function ElevationRow({ data }: { data: ElevationWeather }) {
  const [expanded, setExpanded] = useState(false);
  const ValleyIcon = conditionIcons[data.valley.condition];
  const SummitIcon = conditionIcons[data.summit.condition];

  // Extract the peak name (before "→" or "(")
  const peakName = data.summit.name.replace(' (szczyt)', '').split(' → ').pop() || data.summit.name;

  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
      {/* Compact view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Mountain className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-sm font-medium text-white">{peakName}</div>
            <div className="text-xs text-gray-400">
              {data.valley.altitude}m → {data.summit.altitude}m
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Temperature gradient visualization */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getTempColor(data.valley.temperature)}`}>
              {data.valley.temperature}°
            </span>
            <ArrowDown className="w-3 h-3 text-gray-500 rotate-90" />
            <span className={`text-sm font-bold ${getTempColor(data.summit.temperature)}`}>
              {data.summit.temperature}°
            </span>
            <span className="text-xs text-gray-500">
              ({data.tempDifference > 0 ? '+' : ''}{data.tempDifference}°)
            </span>
          </div>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3">
          {/* Valley vs Summit comparison */}
          <div className="grid grid-cols-2 gap-3">
            {/* Valley */}
            <div className="bg-green-900/20 rounded-lg p-2 border border-green-800/30">
              <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
                <span className="text-green-500">▼</span>
                <span>Start ({data.valley.altitude}m)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-lg font-bold ${getTempColor(data.valley.temperature)}`}>
                  {data.valley.temperature}°C
                </div>
                <ValleyIcon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Odczuwalna: {data.valley.feelsLike}°C
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Wind className="w-3 h-3" />
                <span>{data.valley.windSpeed} km/h {data.valley.windDirection}</span>
              </div>
            </div>

            {/* Summit */}
            <div className="bg-blue-900/20 rounded-lg p-2 border border-blue-800/30">
              <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
                <span className="text-blue-500">▲</span>
                <span>Szczyt ({data.summit.altitude}m)</span>
              </div>
              <div className="flex items-center justify-between">
                <div className={`text-lg font-bold ${getTempColor(data.summit.temperature)}`}>
                  {data.summit.temperature}°C
                </div>
                <SummitIcon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Odczuwalna: {data.summit.feelsLike}°C
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Wind className="w-3 h-3" />
                <span>{data.summit.windSpeed} km/h {data.summit.windDirection}</span>
              </div>
            </div>
          </div>

          {/* Additional info row */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
            <div className="flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              <span>0°C na {data.freezingLevel}m</span>
            </div>
            {data.freshSnow24h > 0 && (
              <div className="flex items-center gap-1 text-blue-400">
                <Snowflake className="w-3 h-3" />
                <span>+{data.freshSnow24h}cm (24h)</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              <span>{getConditionLabel(data.summit.condition)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ElevationWeatherCard({ data, loading }: ElevationWeatherCardProps) {
  if (loading) {
    return (
      <div className="bg-mountain-dark rounded-lg p-4 animate-pulse">
        <div className="h-32 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-mountain-dark rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-white">Pogoda wg wysokości</h3>
        <span className="text-xs text-gray-500">({data.length} trasy)</span>
      </div>

      <div className="space-y-2">
        {data.map((elevation, index) => (
          <ElevationRow key={index} data={elevation} />
        ))}
      </div>

      {/* Source */}
      {data[0] && (
        <div className="mt-3 text-xs text-gray-500 text-right">
          {data[0].source} • {new Date(data[0].timestamp).toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}
