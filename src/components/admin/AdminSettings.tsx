/**
 * Admin Settings Component
 *
 * Admin-only panel for managing LLM settings and moderating reports.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Loader2, AlertCircle, Check, Trash2, Settings, Users, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useReportsStore, type CommunityReport } from '@/stores/useReportsStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { AVAILABLE_MODELS } from '@/services/llm';
import { format } from 'date-fns';
import { AdminReportIngestion } from './AdminReportIngestion';

interface AdminSettingsProps {
  onClose: () => void;
}

type TabType = 'settings' | 'moderation' | 'ingestion';

interface AppSettings {
  llm_model: string;
  rate_limit_minutes: number;
}

export function AdminSettings({ onClose }: AdminSettingsProps) {
  const { isAdmin, user } = useAuthStore();
  const { reports, deleteReport } = useReportsStore();

  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<AppSettings>({
    llm_model: 'meta-llama/llama-3.2-3b-instruct:free',
    rate_limit_minutes: 30,
  });

  // Load settings
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('app_settings')
          .select('key, value');

        if (fetchError) throw fetchError;

        if (data) {
          const settingsMap: Record<string, unknown> = {};
          for (const row of data as Array<{ key: string; value: unknown }>) {
            settingsMap[row.key] = row.value;
          }

          setSettings({
            llm_model: (settingsMap.llm_model as string) || 'meta-llama/llama-3.2-3b-instruct:free',
            rate_limit_minutes: (settingsMap.rate_limit_minutes as number) || 30,
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings
  const handleSaveSettings = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updates = [
        { key: 'llm_model', value: settings.llm_model, updated_by: user.id },
        { key: 'rate_limit_minutes', value: settings.rate_limit_minutes, updated_by: user.id },
      ];

      for (const update of updates) {
        const { error: upsertError } = await supabase
          .from('app_settings')
          .upsert({
            key: update.key,
            value: update.value,
            updated_at: new Date().toISOString(),
            updated_by: update.updated_by,
          } as never);

        if (upsertError) throw upsertError;
      }

      setSuccess('Ustawienia zapisane');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings, user]);

  // Delete report (admin moderation)
  const handleDeleteReport = async (reportId: string) => {
    setDeleting(reportId);
    try {
      await deleteReport(reportId);
    } catch {
      setError('Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  // Not admin - show access denied
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Brak dostępu</h2>
          <p className="text-gray-400 text-sm mb-4">
            Ta sekcja jest dostępna tylko dla administratorów.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Panel administratora</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Ustawienia
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'moderation'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Moderacja ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'ingestion'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Import FB
          </button>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg flex items-start gap-2">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* LLM Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Model LLM
                </label>
                <select
                  value={settings.llm_model}
                  onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <optgroup label="Darmowe modele">
                    {AVAILABLE_MODELS.filter(m => m.free).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Płatne modele">
                    {AVAILABLE_MODELS.filter(m => !m.free).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Model używany do analizy raportów i generowania podsumowań.
                </p>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Limit raportów (minuty)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.rate_limit_minutes}
                  onChange={(e) => setSettings({ ...settings, rate_limit_minutes: parseInt(e.target.value) || 30 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Minimalny czas między raportami od jednego użytkownika.
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Zapisz ustawienia
                  </>
                )}
              </button>
            </div>
          ) : activeTab === 'moderation' ? (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Brak raportów do moderacji</p>
                </div>
              ) : (
                reports.map((report) => (
                  <ReportItem
                    key={report.id}
                    report={report}
                    onDelete={() => handleDeleteReport(report.id)}
                    isDeleting={deleting === report.id}
                  />
                ))
              )}
            </div>
          ) : (
            <AdminReportIngestion />
          )}
        </div>
      </div>
    </div>
  );
}

interface ReportItemProps {
  report: CommunityReport;
  onDelete: () => void;
  isDeleting: boolean;
}

function ReportItem({ report, onDelete, isDeleting }: ReportItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-2 py-0.5 rounded text-xs ${
              report.type === 'ascent' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {report.type === 'ascent' ? 'Podejście' : 'Zjazd'}
            </span>
            <span className="text-white font-medium">{report.location}</span>
            <span className="text-gray-500">({report.region})</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {format(new Date(report.timestamp), 'dd.MM.yyyy HH:mm')}
            {report.userId && <span> • ID: {report.userId.slice(0, 8)}...</span>}
          </div>
          {report.notes && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-1">{report.notes}</p>
          )}
        </div>
        <div>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Usuń'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-500 transition-colors"
              >
                Anuluj
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-slate-600 transition-colors text-gray-400 hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
