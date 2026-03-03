/**
 * Weather Constants
 *
 * Centralized weather condition labels and icons.
 */

import {
  Sun,
  Cloud,
  CloudSnow,
  CloudRain,
  CloudFog,
  Wind,
} from 'lucide-react';
import type { WeatherCondition } from '@/types';
import { t } from '@/lib/translations';

/**
 * Weather condition icon mapping
 */
export const WEATHER_ICONS: Record<WeatherCondition, typeof Sun> = {
  clear: Sun,
  partly_cloudy: Cloud,
  cloudy: Cloud,
  snow: CloudSnow,
  heavy_snow: CloudSnow,
  rain: CloudRain,
  fog: CloudFog,
  wind: Wind,
};

/**
 * Weather condition labels (Polish)
 */
export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: t.weather.conditions.clear,
  partly_cloudy: t.weather.conditions.partlyCloudy,
  cloudy: t.weather.conditions.cloudy,
  snow: t.weather.conditions.snow,
  heavy_snow: t.weather.conditions.heavySnow,
  rain: t.weather.conditions.rain,
  fog: t.weather.conditions.fog,
  wind: t.weather.conditions.windy,
};

/**
 * Get weather condition label
 */
export function getWeatherLabel(condition: WeatherCondition): string {
  return WEATHER_LABELS[condition] || condition;
}

/**
 * Get weather condition icon component
 */
export function getWeatherIcon(condition: WeatherCondition) {
  return WEATHER_ICONS[condition] || Cloud;
}
