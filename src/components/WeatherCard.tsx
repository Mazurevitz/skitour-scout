/**
 * Weather Card Component
 *
 * Displays current weather conditions optimized for ski touring.
 */

import {
  Sun,
  Cloud,
  CloudSnow,
  CloudRain,
  CloudFog,
  Wind,
  Eye,
  Droplets,
  Mountain,
} from 'lucide-react';
import type { WeatherData, WeatherCondition } from '@/types';
import { t } from '@/lib/translations';

interface WeatherCardProps {
  weather: WeatherData | null;
  loading?: boolean;
  locationName?: string;
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

const conditionLabels: Record<WeatherCondition, string> = {
  clear: t.weather.conditions.clear,
  partly_cloudy: t.weather.conditions.partlyCloudy,
  cloudy: t.weather.conditions.cloudy,
  snow: t.weather.conditions.snow,
  heavy_snow: t.weather.conditions.heavySnow,
  rain: t.weather.conditions.rain,
  fog: t.weather.conditions.fog,
  wind: t.weather.conditions.windy,
};

export function WeatherCard({ weather, loading, locationName }: WeatherCardProps) {
  if (loading) {
    return (
      <div className="bg-mountain-dark rounded-lg p-4 animate-pulse">
        <div className="h-24 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-mountain-dark rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Cloud size={20} />
          <span>{t.weather.noData}</span>
        </div>
      </div>
    );
  }

  const ConditionIcon = conditionIcons[weather.condition];

  return (
    <div className="bg-mountain-dark rounded-lg p-4">
      {/* Location header */}
      {locationName && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <Mountain size={12} />
          <span>{locationName}</span>
        </div>
      )}

      {/* Main temperature display */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ConditionIcon size={24} className="text-blue-400" />
            <span className="text-gray-300">
              {conditionLabels[weather.condition]}
            </span>
          </div>
          <div className="text-4xl font-bold text-white mt-1">
            {weather.temperature}°C
          </div>
          <div className="text-sm text-gray-400">
            {t.weather.feelsLike} {weather.feelsLike}°C
          </div>
        </div>

        {/* Fresh snow highlight */}
        {weather.freshSnow24h > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">
              +{weather.freshSnow24h}cm
            </div>
            <div className="text-xs text-gray-400">{t.weather.freshSnow}</div>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Wind size={16} className="text-gray-400" />
          <span className="text-gray-300">
            {weather.windSpeed} km/h {weather.windDirection}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Eye size={16} className="text-gray-400" />
          <span className="text-gray-300">{weather.visibility} km</span>
        </div>

        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-gray-400" />
          <span className="text-gray-300">{weather.humidity}%</span>
        </div>

        <div className="flex items-center gap-2">
          <Mountain size={16} className="text-gray-400" />
          <span className="text-gray-300">{weather.freezingLevel}m 0°</span>
        </div>
      </div>

      {/* Snow base */}
      {weather.snowBase > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Pokrywa śnieżna</span>
            <span className="text-white font-medium">{weather.snowBase} cm</span>
          </div>
        </div>
      )}

      {/* Source and timestamp */}
      <div className="mt-3 text-xs text-gray-500 flex justify-between">
        <span>{weather.source}</span>
        <span>
          {t.weather.updated} {new Date(weather.timestamp).toLocaleTimeString('pl-PL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
