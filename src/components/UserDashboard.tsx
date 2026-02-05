/**
 * User Dashboard Component
 *
 * Shows user's own reports with ability to delete them.
 */

import { useState, useEffect } from 'react';
import { X, Trash2, MapPin, ArrowUp, ArrowDown, Star, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useReportsStore, type CommunityReport } from '@/stores/useReportsStore';
import { format } from 'date-fns';

interface UserDashboardProps {
  onClose: () => void;
}

const SNOW_LABELS: Record<string, string> = {
  puch: 'Puch',
  firn: 'Firn',
  szren: 'Szreń',
  beton: 'Beton',
  cukier: 'Cukier',
  kamienie: 'Kamienie',
  mokry: 'Mokry',
};

const TRACK_LABELS: Record<string, string> = {
  przetarte: 'Przetarte',
  zasypane: 'Zasypane',
  lod: 'Lód',
};

export function UserDashboard({ onClose }: UserDashboardProps) {
  const { user, profile } = useAuthStore();
  const { reports, deleteReport, error, clearError } = useReportsStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Get user's reports
  const userReports = reports.filter(r => r.isOwn || r.userId === user?.id);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleDelete = async (reportId: string) => {
    if (confirmDelete !== reportId) {
      setConfirmDelete(reportId);
      return;
    }

    setDeleting(reportId);
    try {
      await deleteReport(reportId);
      setConfirmDelete(null);
    } catch {
      // Error is handled by the store
    } finally {
      setDeleting(null);
    }
  };

  const renderReport = (report: CommunityReport) => {
    const isAscent = report.type === 'ascent';
    const isDeleting = deleting === report.id;
    const isConfirming = confirmDelete === report.id;

    return (
      <div
        key={report.id}
        className={`p-4 rounded-xl border ${
          isAscent
            ? 'bg-green-500/5 border-green-500/20'
            : 'bg-blue-500/5 border-blue-500/20'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              {isAscent ? (
                <ArrowUp className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <ArrowDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              <span className={`text-sm font-medium ${isAscent ? 'text-green-400' : 'text-blue-400'}`}>
                {isAscent ? 'Podejście' : 'Zjazd'}
              </span>
              <span className="text-xs text-gray-500">
                {format(new Date(report.timestamp), 'dd.MM.yyyy HH:mm')}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 text-white font-medium mb-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              {report.location}
              <span className="text-gray-500 text-sm">({report.region})</span>
            </div>

            {/* Condition details */}
            {isAscent && report.ascent && (
              <div className="text-sm text-gray-400">
                <span className="text-white">
                  {TRACK_LABELS[report.ascent.trackStatus] || report.ascent.trackStatus}
                </span>
                {report.ascent.gearNeeded.length > 0 && (
                  <span> • {report.ascent.gearNeeded.join(', ')}</span>
                )}
              </div>
            )}

            {!isAscent && report.descent && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white">
                  {SNOW_LABELS[report.descent.snowCondition] || report.descent.snowCondition}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= report.descent!.qualityRating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {report.notes && (
              <p className="text-sm text-gray-400 mt-2 line-clamp-2">{report.notes}</p>
            )}

            {/* Sync status */}
            {!report.synced && (
              <span className="inline-block mt-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                Tylko lokalnie
              </span>
            )}
          </div>

          {/* Delete button */}
          <div className="flex-shrink-0">
            {isConfirming ? (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleDelete(report.id)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Potwierdź'
                  )}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1.5 bg-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleDelete(report.id)}
                className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-red-400"
                title="Usuń raport"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Moje raporty</h2>
            {profile && (
              <p className="text-sm text-gray-400">{profile.display_name || profile.email}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error.message}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {userReports.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nie masz jeszcze żadnych raportów</p>
              <p className="text-gray-500 text-sm mt-1">
                Dodaj swój pierwszy raport używając przycisku + na mapie
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">
                {userReports.length} {userReports.length === 1 ? 'raport' : userReports.length < 5 ? 'raporty' : 'raportów'}
              </p>
              {userReports.map(renderReport)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
