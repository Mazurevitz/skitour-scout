/**
 * Resort Conditions Component
 *
 * Shows conditions from nearby ski resorts.
 * Visually distinct from backcountry data - uses blue/cyan theme.
 * Useful for: snow depth reference, temperature, alternative descent options.
 */

import { useState, useEffect } from 'react';
import { Cable, Thermometer, Snowflake, ExternalLink, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { fetchResortConditions, getResortConfigs } from '@/services/resortService';
import type { ResortConditions as ResortConditionsType, ResortConfig } from '@/types/resort';

// Module-level cache to avoid re-fetching on view switches
const conditionsCache: Record<string, { data: ResortConditionsType[]; timestamp: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface ResortConditionsProps {
  region: string;
  /** Compact mode for showing in route cards */
  compact?: boolean;
  /** Filter to show only resorts relevant to this route */
  forRoute?: string;
}

function ResortCard({ resort, compact }: { resort: ResortConditionsType | ResortConfig; compact?: boolean }) {
  const isLoaded = 'snowDepthBase' in resort;
  const conditions = isLoaded ? resort as ResortConditionsType : null;

  if (compact) {
    return (
      <a
        href={(resort as ResortConfig).sourceUrl || (conditions?.sourceUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs hover:bg-cyan-500/20 transition-colors"
      >
        <Cable className="w-3 h-3 text-cyan-400" />
        <span className="text-cyan-300">{resort.name}</span>
        {conditions?.snowDepthSummit && (
          <span className="text-cyan-400 font-medium">{conditions.snowDepthSummit}cm</span>
        )}
        {conditions?.temperature != null && (
          <span className="text-cyan-400">{conditions?.temperature}°</span>
        )}
        <ExternalLink className="w-2.5 h-2.5 text-cyan-500" />
      </a>
    );
  }

  return (
    <a
      href={(resort as ResortConfig).sourceUrl || (conditions?.sourceUrl)}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/15 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-cyan-400" />
          <span className="font-medium text-cyan-200">{resort.name}</span>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-cyan-500" />
      </div>

      <div className="flex items-center gap-4 text-sm">
        {conditions && conditions.snowDepthSummit != null && (
          <div className="flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white font-medium">{conditions.snowDepthSummit}cm</span>
          </div>
        )}
        {conditions && conditions.temperature != null && (
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-white">{conditions.temperature}°C</span>
          </div>
        )}
        {conditions && conditions.isOpen != null && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            conditions.isOpen
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {conditions.isOpen ? 'Otwarte' : 'Zamknięte'}
          </span>
        )}
        {!conditions && (
          <span className="text-cyan-400/60 text-xs">Sprawdź na stronie →</span>
        )}
      </div>

      {conditions?.nearbyRoutes && conditions.nearbyRoutes.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-cyan-400/70">
          <MapPin className="w-3 h-3" />
          <span>Zjazd alternatywny dla: {conditions.nearbyRoutes.join(', ')}</span>
        </div>
      )}
    </a>
  );
}

export function ResortConditions({ region, compact, forRoute }: ResortConditionsProps) {
  const [conditions, setConditions] = useState<ResortConditionsType[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Get resort configs for this region
  const configs = getResortConfigs(region);

  // Filter for specific route if provided
  const relevantConfigs = forRoute
    ? configs.filter(c => c.nearbyRoutes.some(r =>
        forRoute.toLowerCase().includes(r.toLowerCase()) ||
        r.toLowerCase().includes(forRoute.toLowerCase())
      ))
    : configs;

  useEffect(() => {
    if (relevantConfigs.length === 0) return;

    // Check cache first
    const cached = conditionsCache[region];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setConditions(cached.data);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await fetchResortConditions(region);
        // Store in cache
        conditionsCache[region] = { data, timestamp: Date.now() };
        setConditions(data);
      } catch (error) {
        console.warn('Failed to fetch resort conditions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [region]);

  if (relevantConfigs.length === 0) return null;

  // Match fetched conditions with configs
  const resortsToShow = relevantConfigs.map(config => {
    const fetched = conditions.find(c => c.name === config.name);
    return fetched || config;
  });

  // Compact mode for route cards
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {resortsToShow.slice(0, 2).map((resort) => (
          <ResortCard key={resort.name} resort={resort} compact />
        ))}
      </div>
    );
  }

  // Full display for overview
  return (
    <div className="space-y-2">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Cable className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-cyan-300">Warunki na stokach</span>
          <span className="text-xs text-cyan-500">({resortsToShow.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-cyan-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-cyan-500" />
        )}
      </button>

      {/* Collapsed summary */}
      {!expanded && (
        <div className="flex items-center gap-3 text-sm text-cyan-400/80 pl-6">
          {conditions.length > 0 ? (
            <>
              {conditions[0]?.snowDepthSummit && (
                <span>{conditions[0].name}: {conditions[0].snowDepthSummit}cm</span>
              )}
              {conditions[0]?.temperature !== null && (
                <span>{conditions[0].temperature}°C</span>
              )}
            </>
          ) : (
            <span className="text-cyan-500/60">
              {loading ? 'Ładowanie...' : 'Kliknij aby rozwinąć'}
            </span>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="space-y-2 pl-1">
          <p className="text-xs text-cyan-500/70 mb-2">
            Dane ze stoków - przydatne do oceny pokrywy śnieżnej i jako alternatywny zjazd
          </p>
          {resortsToShow.map((resort) => (
            <ResortCard key={resort.name} resort={resort} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline resort badge for route cards
 * Shows nearby resort as descent alternative
 */
export function ResortDescentBadge({ routeName, region }: { routeName: string; region: string }) {
  const configs = getResortConfigs(region);
  const relevant = configs.filter(c => c.nearbyRoutes.some(r =>
    routeName.toLowerCase().includes(r.toLowerCase()) ||
    r.toLowerCase().includes(routeName.toLowerCase())
  ));

  if (relevant.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-cyan-400/80">
      <Cable className="w-3 h-3" />
      <span>Zjazd: {relevant.map(r => r.name).join(', ')}</span>
    </div>
  );
}
