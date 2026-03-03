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
  Cloud,
} from 'lucide-react';
import type { ElevationWeather } from '@/types';
import { WEATHER_ICONS, getWeatherLabel } from '@/constants';

interface ElevationWeatherCardProps {
  data: ElevationWeather[];
  loading?: boolean;
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
 * Expandable row for elevation weather
 */
function ElevationRow({ data, showForecast }: { data: ElevationWeather; showForecast?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const forecast = data.tomorrow;
  const ValleyIcon = WEATHER_ICONS[showForecast && forecast ? forecast.valley.condition : data.valley.condition];
  const SummitIcon = WEATHER_ICONS[showForecast && forecast ? forecast.summit.condition : data.summit.condition];
  const peakName = data.summit.name.replace(' (szczyt)', '').split(' → ').pop() || data.summit.name;

  // Show forecast view
  if (showForecast && forecast) {
    return (
      <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-amber-700/20">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Mountain className="w-4 h-4 text-amber-500" />
            <div>
              <div className="text-sm font-medium text-white">{peakName}</div>
              <div className="text-xs text-gray-400">
                {data.valley.altitude}m → {data.summit.altitude}m
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className={`text-sm ${getTempColor(forecast.valley.tempMax)}`}>
                {forecast.valley.tempMax}°
              </span>
              <span className="text-gray-600">→</span>
              <span className={`text-sm font-bold ${getTempColor(forecast.summit.tempMax)}`}>
                {forecast.summit.tempMax}°
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
              {/* Valley forecast */}
              <div className="bg-green-900/20 rounded-lg p-2 border border-green-800/30">
                <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
                  <span className="text-green-500">▼</span>
                  <span>Start ({data.valley.altitude}m)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-lg font-bold ${getTempColor(forecast.valley.tempMax)}`}>
                      {forecast.valley.tempMax}°
                    </span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className={`text-sm ${getTempColor(forecast.valley.tempMin)}`}>
                      {forecast.valley.tempMin}°
                    </span>
                  </div>
                  <ValleyIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Wind className="w-3 h-3" />
                  <span>max {forecast.valley.windSpeed} km/h</span>
                </div>
                {forecast.valley.snowfall > 0 && (
                  <div className="flex items-center gap-1 text-xs text-blue-400 mt-1">
                    <Snowflake className="w-3 h-3" />
                    <span>+{forecast.valley.snowfall}cm</span>
                  </div>
                )}
              </div>

              {/* Summit forecast */}
              <div className="bg-blue-900/20 rounded-lg p-2 border border-blue-800/30">
                <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
                  <span className="text-blue-500">▲</span>
                  <span>Szczyt ({data.summit.altitude}m)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-lg font-bold ${getTempColor(forecast.summit.tempMax)}`}>
                      {forecast.summit.tempMax}°
                    </span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className={`text-sm ${getTempColor(forecast.summit.tempMin)}`}>
                      {forecast.summit.tempMin}°
                    </span>
                  </div>
                  <SummitIcon className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Wind className="w-3 h-3" />
                  <span>max {forecast.summit.windSpeed} km/h</span>
                </div>
                {forecast.summit.snowfall > 0 && (
                  <div className="flex items-center gap-1 text-xs text-blue-400 mt-1">
                    <Snowflake className="w-3 h-3" />
                    <span>+{forecast.summit.snowfall}cm</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1">
                <Thermometer className="w-3 h-3" />
                <span>0°C na ~{forecast.freezingLevel}m</span>
              </div>
              <div className="flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                <span>{getWeatherLabel(forecast.summit.condition)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Current weather view (original)
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
              <span>{getWeatherLabel(data.summit.condition)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ElevationWeatherCard({ data, loading }: ElevationWeatherCardProps) {
  const [showForecast, setShowForecast] = useState(false);
  const hasForecast = data?.some((d) => d.tomorrow);

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

  // Get tomorrow's date for display
  const tomorrowDate = data[0]?.tomorrow?.date
    ? new Date(data[0].tomorrow.date).toLocaleDateString('pl-PL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : 'Jutro';

  return (
    <div className="bg-mountain-dark rounded-lg p-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Pogoda wg wysokości</h3>
        </div>

        {/* Day toggle */}
        {hasForecast && (
          <div className="flex bg-gray-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setShowForecast(false)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                !showForecast
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Dziś
            </button>
            <button
              onClick={() => setShowForecast(true)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                showForecast
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tomorrowDate}
            </button>
          </div>
        )}
      </div>

      {/* Expandable list - always column layout (works best in 400px sidebar) */}
      <div className="space-y-2">
        {data.map((elevation, index) => (
          <ElevationRow key={index} data={elevation} showForecast={showForecast} />
        ))}
      </div>

      {/* Source - compact */}
      {data[0] && (
        <div className="mt-2 text-[10px] text-gray-600 text-right">
          {data[0].source} • {showForecast ? 'Prognoza' : new Date(data[0].timestamp).toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}
