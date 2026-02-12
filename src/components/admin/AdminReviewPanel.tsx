/**
 * Admin Review Panel
 *
 * Review and approve/reject scraped reports that need manual verification.
 * Shows raw source text alongside parsed data for comparison.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Calendar,
  MapPin,
  Shield,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Percent,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface PendingReport {
  id: string;
  created_at: string;
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string | null;
  hazards: string[];
  safety_rating: number;
  raw_source: string | null;
  author_name: string | null;
  confidence_score: number | null;
  review_status: string;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

const REGIONS = ['Beskidy', 'Tatry'];
const COMMON_HAZARDS = ['kamienie', 'lód', 'krzaki', 'wiatr', 'mgła', 'lawiny', 'przenoski', 'oblodzenie'];

export function AdminReviewPanel() {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState<PendingReport | null>(null);
  const [showApproved, setShowApproved] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadReports = useCallback(async () => {
    try {
      let query = supabase
        .from('admin_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (showApproved) {
        query = query.in('review_status', ['pending_review', 'auto_approved', 'approved']);
      } else {
        query = query.eq('review_status', 'pending_review');
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setReports((data || []) as PendingReport[]);
    } catch (err) {
      console.error('Failed to load reports:', err);
      showToast('error', 'Nie udało się załadować raportów');
    } finally {
      setLoading(false);
    }
  }, [showApproved]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleApprove = async (reportId: string) => {
    setProcessing(reportId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData = editingReport && editingReport.id === reportId
        ? {
            review_status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
            location: editingReport.location,
            region: editingReport.region,
            snow_conditions: editingReport.snow_conditions,
            hazards: editingReport.hazards,
            safety_rating: editingReport.safety_rating,
            report_date: editingReport.report_date,
            author_name: editingReport.author_name,
          }
        : {
            review_status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
          };

      const { error } = await supabase
        .from('admin_reports')
        .update(updateData as never)
        .eq('id', reportId);

      if (error) throw error;

      showToast('success', 'Raport zatwierdzony');
      setEditingReport(null);
      setExpandedId(null);
      loadReports();
    } catch (err) {
      showToast('error', 'Nie udało się zatwierdzić raportu');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (reportId: string) => {
    setProcessing(reportId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('admin_reports')
        .update({
          review_status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
        } as never)
        .eq('id', reportId);

      if (error) throw error;

      showToast('success', 'Raport odrzucony');
      setExpandedId(null);
      loadReports();
    } catch (err) {
      showToast('error', 'Nie udało się odrzucić raportu');
    } finally {
      setProcessing(null);
    }
  };

  const toggleExpanded = (reportId: string) => {
    if (expandedId === reportId) {
      setExpandedId(null);
      setEditingReport(null);
    } else {
      setExpandedId(reportId);
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setEditingReport({ ...report });
      }
    }
  };

  const updateEditingField = (field: keyof PendingReport, value: unknown) => {
    if (editingReport) {
      setEditingReport({ ...editingReport, [field]: value });
    }
  };

  const toggleHazard = (hazard: string) => {
    if (!editingReport) return;
    const hazards = editingReport.hazards.includes(hazard)
      ? editingReport.hazards.filter(h => h !== hazard)
      : [...editingReport.hazards, hazard];
    setEditingReport({ ...editingReport, hazards });
  };

  const getConfidenceColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 rounded text-xs">Do weryfikacji</span>;
      case 'auto_approved':
        return <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">Auto</span>;
      case 'approved':
        return <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">Zatwierdzone</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 bg-red-600/20 text-red-400 rounded text-xs">Odrzucone</span>;
      default:
        return null;
    }
  };

  const pendingCount = reports.filter(r => r.review_status === 'pending_review').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Eye className="w-5 h-5 text-amber-400" />
          Weryfikacja raportów
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-600 text-white text-sm rounded-full">
              {pendingCount}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showApproved}
              onChange={(e) => setShowApproved(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            Pokaż zatwierdzone
          </label>
          <button
            onClick={loadReports}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Odśwież
          </button>
        </div>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Wszystko sprawdzone!</h3>
          <p className="text-gray-400">Brak raportów do weryfikacji.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div
              key={report.id}
              className={`bg-gray-800 rounded-xl border overflow-hidden transition-colors ${
                report.review_status === 'pending_review'
                  ? 'border-amber-600/50'
                  : 'border-gray-700'
              }`}
            >
              {/* Report header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-750"
                onClick={() => toggleExpanded(report.id)}
              >
                {/* Confidence indicator */}
                <div className={`flex items-center gap-1 ${getConfidenceColor(report.confidence_score)}`}>
                  <Percent className="w-4 h-4" />
                  <span className="text-sm font-medium">{report.confidence_score || '?'}</span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white">{report.location}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">{report.region}</span>
                    {getStatusBadge(report.review_status)}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(report.report_date), 'dd.MM.yyyy')}
                    </span>
                    {report.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {report.author_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions for pending */}
                {report.review_status === 'pending_review' && expandedId !== report.id && (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleApprove(report.id)}
                      disabled={processing === report.id}
                      className="p-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
                      title="Zatwierdź"
                    >
                      {processing === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(report.id)}
                      disabled={processing === report.id}
                      className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                      title="Odrzuć"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {expandedId === report.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Expanded content */}
              {expandedId === report.id && editingReport && (
                <div className="border-t border-gray-700 p-4 space-y-4">
                  {/* Raw source */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Oryginalny tekst z FB
                    </label>
                    <div className="p-3 bg-gray-900 rounded-lg text-sm text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {report.raw_source || 'Brak danych źródłowych'}
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Data
                      </label>
                      <input
                        type="date"
                        value={editingReport.report_date}
                        onChange={(e) => updateEditingField('report_date', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        Lokalizacja
                      </label>
                      <input
                        type="text"
                        value={editingReport.location}
                        onChange={(e) => updateEditingField('location', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Region</label>
                      <select
                        value={editingReport.region}
                        onChange={(e) => updateEditingField('region', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                      >
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        <User className="w-3 h-3 inline mr-1" />
                        Autor
                      </label>
                      <input
                        type="text"
                        value={editingReport.author_name || ''}
                        onChange={(e) => updateEditingField('author_name', e.target.value || null)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Snow conditions */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Warunki śniegowe</label>
                    <textarea
                      value={editingReport.snow_conditions || ''}
                      onChange={(e) => updateEditingField('snow_conditions', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>

                  {/* Hazards */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Zagrożenia</label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_HAZARDS.map(hazard => (
                        <button
                          key={hazard}
                          onClick={() => toggleHazard(hazard)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            editingReport.hazards.includes(hazard)
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {hazard}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Safety rating */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Ocena bezpieczeństwa
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(rating => (
                        <button
                          key={rating}
                          onClick={() => updateEditingField('safety_rating', rating)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            editingReport.safety_rating === rating
                              ? rating <= 2 ? 'bg-red-600 text-white'
                                : rating === 3 ? 'bg-yellow-600 text-white'
                                : 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleReject(report.id)}
                      disabled={processing === report.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Odrzuć
                    </button>
                    <button
                      onClick={() => handleApprove(report.id)}
                      disabled={processing === report.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-xl font-medium transition-colors"
                    >
                      {processing === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Zatwierdź
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
