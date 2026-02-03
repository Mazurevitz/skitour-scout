/**
 * Intel Feed Component
 *
 * Displays condition reports from web search with confidence indicators.
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  Globe,
  ExternalLink,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import type { ConditionReport } from '@/agents';
import { ConfidenceBadge, ConfidenceLegend } from './ConfidenceBadge';

interface SearchStatus {
  status: 'idle' | 'success' | 'error' | 'no_results';
  message?: string;
  timestamp?: string;
}

interface IntelFeedProps {
  /** Web search results */
  webReports: ConditionReport[];
  /** Available locations for the current region */
  locations: string[];
  /** Loading state */
  loading?: boolean;
  /** Whether web search is in progress */
  searchingWeb?: boolean;
  /** Search status for feedback */
  searchStatus?: SearchStatus;
  /** Callback to trigger web search with optional specific location */
  onSearchWeb?: (location?: string) => void;
}

const sentimentIcons = {
  positive: ThumbsUp,
  neutral: Minus,
  negative: ThumbsDown,
};

const sentimentColors = {
  positive: 'text-green-400',
  neutral: 'text-gray-400',
  negative: 'text-red-400',
};

export function IntelFeed({
  webReports,
  locations,
  loading,
  searchingWeb,
  searchStatus,
  onSearchWeb,
}: IntelFeedProps) {
  const [showLegend, setShowLegend] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-mountain-dark rounded-lg p-4 animate-pulse">
            <div className="h-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-300">Condition Reports</h3>
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              (?)
            </button>
          </div>
        </div>

        {/* Location selector and search button */}
        {onSearchWeb && (
          <div className="flex gap-2">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <button
              onClick={() => onSearchWeb(selectedLocation === 'all' ? undefined : selectedLocation)}
              disabled={searchingWeb}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            >
              {searchingWeb ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Search size={12} />
              )}
              {searchingWeb ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}
      </div>

      {/* Search status feedback */}
      {searchStatus && searchStatus.status !== 'idle' && (
        <div
          className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
            searchStatus.status === 'success'
              ? 'bg-green-900/30 border border-green-800/50 text-green-400'
              : searchStatus.status === 'error'
              ? 'bg-red-900/30 border border-red-800/50 text-red-400'
              : 'bg-yellow-900/30 border border-yellow-800/50 text-yellow-400'
          }`}
        >
          {searchStatus.status === 'success' && (
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
          )}
          {searchStatus.status === 'error' && (
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          )}
          {searchStatus.status === 'no_results' && (
            <Search size={12} className="mt-0.5 flex-shrink-0" />
          )}
          <span className="break-words">{searchStatus.message}</span>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <ConfidenceLegend />
      )}

      {/* Web search results */}
      {webReports.length > 0 && (
        <div className="space-y-3">
          {webReports.map((report, index) => (
            <WebReportCard key={`web-${index}`} report={report} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {webReports.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Search size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No reports yet</p>
          <p className="text-xs">Click "Search Web" to find recent conditions</p>
        </div>
      )}
    </div>
  );
}

/**
 * Web search result card
 */
function WebReportCard({ report }: { report: ConditionReport }) {
  const SentimentIcon = sentimentIcons[report.sentiment];
  const timeAgo = formatDistanceToNow(new Date(report.reportDate), { addSuffix: true });

  return (
    <div className="bg-mountain-dark rounded-lg p-4">
      {/* Header with confidence */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-blue-400" />
          <span className="text-sm font-medium text-white">{report.sourceName}</span>
        </div>
        <ConfidenceBadge confidence={report.confidence} compact />
      </div>

      {/* Content */}
      <p className="text-sm text-gray-300 mb-2 selectable">{report.summary}</p>

      {/* Conditions tags */}
      {report.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {report.conditions.map((condition, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs"
            >
              {condition}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {report.location !== 'Unknown' && (
            <span>{report.location}</span>
          )}
          <SentimentIcon size={12} className={sentimentColors[report.sentiment]} />
        </div>
        <div className="flex items-center gap-2">
          <span>{timeAgo}</span>
          {report.sourceUrl && (
            <a
              href={report.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
