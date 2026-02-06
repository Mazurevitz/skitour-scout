/**
 * Admin Report Ingestion Component
 *
 * Bulk import flow for parsing Facebook posts into structured reports:
 * 1. Paste raw text (multiple comments)
 * 2. AI extracts multiple reports (ignores junk)
 * 3. Review, edit, remove individual reports
 * 4. Save selected reports to Supabase
 */

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  X,
  Save,
  RotateCcw,
  FileText,
  Calendar,
  Shield,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase, getEdgeFunctionUrl } from '@/lib/supabase';

type Phase = 'input' | 'review' | 'success';

interface ParsedReport {
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string;
  hazards: string[];
  safety_rating: number;
  author_name: string | null;
}

interface ReportWithMeta extends ParsedReport {
  id: string;
  expanded: boolean;
  source_group: string | null;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

const REGIONS = ['Beskid Śląski', 'Beskid Żywiecki', 'Tatry'];
const COMMON_HAZARDS = ['kamienie', 'lód', 'krzaki', 'wiatr', 'mgła', 'lawiny', 'przenoski', 'oblodzenie'];

export function AdminReportIngestion() {
  const [phase, setPhase] = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sourceGroup, setSourceGroup] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  // Multiple reports state
  const [reports, setReports] = useState<ReportWithMeta[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      setError('Wklej tekst posta z Facebooka');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const edgeFunctionUrl = getEdgeFunctionUrl('parse-report');
      if (!edgeFunctionUrl) {
        throw new Error('Edge Function URL not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Musisz być zalogowany jako administrator');
      }

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ raw_text: rawText }),
      });

      const responseText = await response.text();
      console.log('Response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        throw new Error(`[${response.status}] ${data.error || 'Failed to parse'}`);
      }

      if (data.reports && Array.isArray(data.reports)) {
        if (data.reports.length === 0) {
          setError('AI nie znalazło żadnych raportów w tekście. Spróbuj wkleić inne komentarze.');
          return;
        }

        // Add metadata to each report
        const reportsWithMeta: ReportWithMeta[] = data.reports.map((r: ParsedReport, i: number) => ({
          ...r,
          id: `report-${Date.now()}-${i}`,
          expanded: i === 0, // First one expanded by default
          hazards: r.hazards || [],
          safety_rating: r.safety_rating || 3,
          source_group: null,
        }));

        setReports(reportsWithMeta);
        setRawResponse(data.raw_response);
        setPhase('review');
      } else {
        throw new Error('Nieprawidłowa odpowiedź z AI');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Parse error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (reports.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData = reports.map(r => ({
        report_date: r.report_date,
        location: r.location,
        region: r.region,
        snow_conditions: r.snow_conditions || null,
        hazards: r.hazards,
        safety_rating: r.safety_rating,
        raw_source: rawText,
        author_name: r.author_name,
        source_group: sourceGroup || null,
        source_type: 'facebook',
        ingested_by: user?.id,
      }));

      const { error: insertError } = await supabase
        .from('admin_reports')
        .insert(insertData as never[]);

      if (insertError) {
        throw insertError;
      }

      setSavedCount(reports.length);
      showToast('success', `Zapisano ${reports.length} raportów!`);
      setPhase('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPhase('input');
    setRawText('');
    setRawResponse(null);
    setError(null);
    setReports([]);
    setSourceGroup('');
    setSavedCount(0);
  };

  const updateReport = (id: string, updates: Partial<ReportWithMeta>) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeReport = (id: string) => {
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const toggleExpanded = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, expanded: !r.expanded } : r));
  };

  const toggleHazard = (id: string, hazard: string) => {
    setReports(prev => prev.map(r => {
      if (r.id !== id) return r;
      const hazards = r.hazards.includes(hazard)
        ? r.hazards.filter(h => h !== hazard)
        : [...r.hazards, hazard];
      return { ...r, hazards };
    }));
  };

  const getSafetyColor = (rating: number) => {
    if (rating <= 2) return 'bg-red-600';
    if (rating === 3) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Import raportów z FB
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded ${phase === 'input' ? 'bg-blue-600' : 'bg-gray-700'}`}>1. Wklej</span>
          <span className={`px-2 py-1 rounded ${phase === 'review' ? 'bg-blue-600' : 'bg-gray-700'}`}>2. Sprawdź</span>
          <span className={`px-2 py-1 rounded ${phase === 'success' ? 'bg-green-600' : 'bg-gray-700'}`}>3. Zapisz</span>
        </div>
      </div>

      {/* Phase 1: Input */}
      {phase === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wklej komentarze z Facebooka (można wiele naraz)
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Skopiuj i wklej komentarze z grupy FB. AI wyodrębni raporty warunków, ignorując pytania i żarty..."
              className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <pre className="text-sm whitespace-pre-wrap break-words flex-1 font-sans">{error}</pre>
              </div>
            </div>
          )}

          <button
            onClick={handleParse}
            disabled={loading || !rawText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Analizuję z AI...</>
            ) : (
              <><Sparkles className="w-5 h-5" />Wyodrębnij raporty</>
            )}
          </button>
        </div>
      )}

      {/* Phase 2: Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          {/* Source group - applies to all */}
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <FileText className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={sourceGroup}
              onChange={(e) => setSourceGroup(e.target.value)}
              placeholder="Grupa FB (opcjonalnie, dla wszystkich)"
              className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-gray-400">{reports.length} raportów</span>
          </div>

          {/* Report cards */}
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {reports.map((report) => (
              <div key={report.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Card header - always visible */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-750"
                  onClick={() => toggleExpanded(report.id)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${getSafetyColor(report.safety_rating)}`}>
                    {report.safety_rating}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{report.location}</span>
                      <span className="text-gray-500 text-sm">({report.region})</span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {report.report_date}
                      {report.author_name && (
                        <><User className="w-3 h-3 ml-2" />{report.author_name}</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeReport(report.id); }}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {report.expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {/* Expanded content */}
                {report.expanded && (
                  <div className="p-3 pt-0 space-y-3 border-t border-gray-700">
                    {/* Basic fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={report.report_date}
                        onChange={(e) => updateReport(report.id, { report_date: e.target.value })}
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                      <input
                        type="text"
                        value={report.location}
                        onChange={(e) => updateReport(report.id, { location: e.target.value })}
                        placeholder="Lokalizacja"
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                      <select
                        value={report.region}
                        onChange={(e) => updateReport(report.id, { region: e.target.value })}
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      >
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input
                        type="text"
                        value={report.author_name || ''}
                        onChange={(e) => updateReport(report.id, { author_name: e.target.value || null })}
                        placeholder="Autor (opcjonalnie)"
                        className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                    </div>

                    {/* Snow conditions */}
                    <textarea
                      value={report.snow_conditions}
                      onChange={(e) => updateReport(report.id, { snow_conditions: e.target.value })}
                      placeholder="Warunki śniegowe..."
                      rows={2}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                    />

                    {/* Hazards */}
                    <div className="flex flex-wrap gap-1">
                      {COMMON_HAZARDS.map(hazard => (
                        <button
                          key={hazard}
                          onClick={() => toggleHazard(report.id, hazard)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            report.hazards.includes(hazard)
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {hazard}
                        </button>
                      ))}
                    </div>

                    {/* Safety rating */}
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            onClick={() => updateReport(report.id, { safety_rating: rating })}
                            className={`w-8 h-8 rounded font-medium text-sm transition-colors ${
                              report.safety_rating === rating
                                ? getSafetyColor(rating) + ' text-white'
                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">1=niebezpieczne, 5=bezpieczne</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Debug */}
          {rawResponse && (
            <details className="bg-gray-800/50 rounded-lg p-3">
              <summary className="text-sm text-gray-400 cursor-pointer">Odpowiedź AI (debug)</summary>
              <pre className="mt-2 text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap">{rawResponse}</pre>
            </details>
          )}

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Od nowa
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || reports.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Zapisuję...</>
              ) : (
                <><Save className="w-4 h-4" />Zapisz {reports.length} raportów</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Phase 3: Success */}
      {phase === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Zapisano {savedCount} raportów!</h3>
          <p className="text-gray-400 mb-6">Raporty zostały dodane do bazy danych.</p>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors mx-auto"
          >
            <FileText className="w-5 h-5" />
            Importuj kolejne
          </button>
        </div>
      )}
    </div>
  );
}
