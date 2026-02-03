/**
 * Community Intel Component
 *
 * Displays community-submitted condition reports and aggregated data.
 * Supports both Ascent (Podejście) and Descent (Zjazd) reports.
 */

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Users, Star, AlertTriangle, MapPin, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useReportsStore, type CommunityReport, type LocationConditions } from '@/stores';

interface CommunityIntelProps {
  region: string;
}

// Condition display config
const SNOW_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  puch: { label: 'Powder', emoji: '❄️', color: 'text-blue-400' },
  firn: { label: 'Corn', emoji: '🌞', color: 'text-yellow-400' },
  cukier: { label: 'Sugar', emoji: '✨', color: 'text-cyan-400' },
  szren: { label: 'Crust', emoji: '🧊', color: 'text-slate-400' },
  beton: { label: 'Hard/Icy', emoji: '🪨', color: 'text-gray-400' },
  kamienie: { label: 'Rocks', emoji: '⚠️', color: 'text-red-400' },
};

const TRACK_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  przetarte: { label: 'Tracked', emoji: '✅', color: 'text-green-400' },
  zasypane: { label: 'Covered', emoji: '❄️', color: 'text-blue-400' },
  lod: { label: 'Icy', emoji: '🧊', color: 'text-cyan-400' },
};

const GEAR_CONFIG: Record<string, { label: string; emoji: string }> = {
  foki: { label: 'Skins', emoji: '🦭' },
  harszle: { label: 'Ski crampons', emoji: '⛓️' },
  raki: { label: 'Crampons', emoji: '🦀' },
};

function ConditionBadge({ condition, type }: { condition: string; type: 'snow' | 'track' }) {
  const config = type === 'snow'
    ? SNOW_CONFIG[condition] || { label: condition, emoji: '❓', color: 'text-gray-400' }
    : TRACK_CONFIG[condition] || { label: condition, emoji: '❓', color: 'text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800 text-xs font-medium ${config.color}`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

function LocationSummaryCard({ summary }: { summary: LocationConditions }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(summary.lastReport), { addSuffix: true });
    } catch {
      return 'recently';
    }
  }, [summary.lastReport]);

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-white">{summary.location}</span>
        </div>
        {summary.primaryCondition !== 'unknown' && (
          <ConditionBadge condition={summary.primaryCondition} type="snow" />
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400">
        {summary.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <RatingStars rating={Math.round(summary.averageRating)} />
            <span className="ml-1">{summary.averageRating.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{summary.reportCount} reports</span>
        </div>
      </div>

      {/* Report type breakdown */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {summary.ascentCount > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <ArrowUp className="w-3 h-3" />
            {summary.ascentCount} ascent
          </span>
        )}
        {summary.descentCount > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <ArrowDown className="w-3 h-3" />
            {summary.descentCount} descent
          </span>
        )}
      </div>

      {/* Track status and gear */}
      {summary.trackStatus && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Track:</span>
          <ConditionBadge condition={summary.trackStatus} type="track" />
        </div>
      )}

      {summary.commonGear.length > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Gear needed:</span>
          {summary.commonGear.map((gear) => {
            const config = GEAR_CONFIG[gear];
            return (
              <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                {config?.emoji} {config?.label || gear}
              </span>
            );
          })}
        </div>
      )}

      {summary.hazards.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-amber-500">
            {summary.hazards.join(', ')}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Last report {timeAgo}</span>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: CommunityReport }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(report.timestamp), { addSuffix: true });
    } catch {
      return 'recently';
    }
  }, [report.timestamp]);

  const isAscent = report.type === 'ascent';

  return (
    <div className={`bg-gray-800/30 rounded-lg p-3 border ${
      report.isOwn
        ? isAscent ? 'border-green-500/30' : 'border-blue-500/30'
        : 'border-gray-700/30'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isAscent ? (
            <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
              <ArrowUp className="w-3 h-3" />
              Podejście
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              <ArrowDown className="w-3 h-3" />
              Zjazd
            </span>
          )}
          {report.isOwn && (
            <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">You</span>
          )}
        </div>
        {!isAscent && report.descent && (
          <RatingStars rating={report.descent.qualityRating} />
        )}
      </div>

      <div className="flex items-center gap-2 text-sm mb-2">
        <MapPin className="w-3 h-3 text-gray-500" />
        <span className="text-gray-300">{report.location}</span>
        <span className="text-gray-600">•</span>
        <span className="text-gray-500">{timeAgo}</span>
      </div>

      {/* Ascent details */}
      {isAscent && report.ascent && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Track:</span>
            <ConditionBadge condition={report.ascent.trackStatus} type="track" />
          </div>
          {report.ascent.gearNeeded.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Gear:</span>
              {report.ascent.gearNeeded.map((gear) => {
                const config = GEAR_CONFIG[gear];
                return (
                  <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                    {config?.emoji} {config?.label || gear}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Descent details */}
      {!isAscent && report.descent && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Snow:</span>
          <ConditionBadge condition={report.descent.snowCondition} type="snow" />
        </div>
      )}

      {report.notes && (
        <p className="mt-2 text-sm text-gray-400 line-clamp-2 italic">"{report.notes}"</p>
      )}
    </div>
  );
}

export function CommunityIntel({ region }: CommunityIntelProps) {
  const { reports, getAggregatedConditions, getRecentReports } = useReportsStore();

  const aggregated = useMemo(() => getAggregatedConditions(region), [region, reports]);
  const recentReports = useMemo(() => {
    return getRecentReports(48).filter(
      (r) => r.region.toLowerCase().includes(region.toLowerCase()) ||
        region.toLowerCase().includes(r.region.toLowerCase())
    );
  }, [region, reports]);

  const hasData = aggregated.length > 0 || recentReports.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-gray-400 font-medium mb-1">No Community Reports Yet</h3>
        <p className="text-gray-500 text-sm">
          Be the first to report conditions in {region}!
        </p>
        <p className="text-gray-600 text-xs mt-2">
          Tap the + button to submit a report
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          Community Reports
        </h3>
        <span className="text-xs text-gray-500">
          {recentReports.length} reports (48h)
        </span>
      </div>

      {/* Location summaries */}
      {aggregated.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">By Location</p>
          {aggregated.slice(0, 3).map((summary) => (
            <LocationSummaryCard key={summary.location} summary={summary} />
          ))}
        </div>
      )}

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Recent Reports</p>
          {recentReports.slice(0, 5).map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
