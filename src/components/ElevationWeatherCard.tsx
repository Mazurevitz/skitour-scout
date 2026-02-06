/**
 * Elevation Weather Card Component
 *
 * Shows weather comparison between valley and summit.
 * Desktop: Visual mountain cards with temp at top and bottom
 * Mobile: Compact expandable list
 */

import { useState } from 'react';
import {
  Mountain,
  Thermometer,
  Wind,
  ChevronDown,
  ChevronUp,
  Snowflake,
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

/**
 * Visual mountain card for desktop - shows temps vertically
 */
function VisualMountainCard({ data }: { data: ElevationWeather }) {
  const SummitIcon = conditionIcons[data.summit.condition];
  const peakName = data.summit.name.replace(' (szczyt)', '').split(' → ').pop() || data.summit.name;

  return (
    <div className="flex-1 bg-gray-800/70 border border-gray-700/50 rounded-xl p-4 flex flex-col items-center">
      {/* Summit temp */}
      <div className={`text-2xl font-bold ${getTempColor(data.summit.temperature)}`}>
        {data.summit.temperature}°
      </div>
      <div className="text-xs text-gray-500">{data.summit.altitude}m</div>

      {/* Mountain visual */}
      <div className="relative my-2">
        <Mountain className="w-12 h-12 text-blue-500" />
        <SummitIcon className="w-4 h-4 text-gray-400 absolute -top-1 -right-1" />
      </div>

      {/* Valley temp */}
      <div className="text-xs text-gray-500">{data.valley.altitude}m</div>
      <div className={`text-lg font-medium ${getTempColor(data.valley.temperature)}`}>
        {data.valley.temperature}°
      </div>

      {/* Peak name */}
      <div className="text-sm text-white font-medium mt-2 text-center leading-tight">
        {peakName}
      </div>

      {/* Wind at summit */}
      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
        <Wind className="w-3 h-3" />
        <span>{data.summit.windSpeed} km/h</span>
      </div>
    </div>
  );
}

/**
 * Mobile expandable row
 */
function MobileElevationRow({ data }: { data: ElevationWeather }) {
  const [expanded, setExpanded] = useState(false);
  const ValleyIcon = conditionIcons[data.valley.condition];
  const SummitIcon = conditionIcons[data.summit.condition];
  const peakName = data.summit.name.replace(' (szczyt)', '').split(' → ').pop() || data.summit.name;

  return (
    <div className="bg-gray-800/50 rounded-lg overflow-hidden">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className={`text-sm ${getTempColor(data.valley.temperature)}`}>
              {data.valley.temperature}°
            </span>
            <span className="text-gray-600">→</span>
            <span className={`text-sm font-bold ${getTempColor(data.summit.temperature)}`}>
              {data.summit.temperature}°
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3">
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
    <div className="bg-mountain-dark rounded-lg p-4 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <Thermometer className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-white">Pogoda wg wysokości</h3>
      </div>

      {/* Desktop: Visual mountain cards in a row */}
      <div className="hidden md:flex md:gap-4">
        {data.map((elevation, index) => (
          <VisualMountainCard key={index} data={elevation} />
        ))}
      </div>

      {/* Mobile: Expandable list */}
      <div className="md:hidden space-y-2">
        {data.map((elevation, index) => (
          <MobileElevationRow key={index} data={elevation} />
        ))}
      </div>

      {/* Source - compact */}
      {data[0] && (
        <div className="mt-2 text-[10px] text-gray-600 text-right">
          {data[0].source} • {new Date(data[0].timestamp).toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}
