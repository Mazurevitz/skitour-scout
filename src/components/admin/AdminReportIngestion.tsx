/**
 * Admin Report Ingestion Component
 *
 * Semi-automated flow for parsing Facebook posts into structured reports:
 * 1. Paste raw text
 * 2. AI parses it (Claude 3.5 Sonnet)
 * 3. Review and edit
 * 4. Save to Supabase
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
  MapPin,
  Calendar,
  Snowflake,
  Shield,
  User,
} from 'lucide-react';
import { supabase, getEdgeFunctionUrl } from '@/lib/supabase';

type Phase = 'input' | 'review' | 'success';

interface ParsedReport {
  report_date: string;
  location: string;
  region: string;
  snow_conditions: string;
  hazards: string[];
  is_safe: boolean;
  author_name: string | null;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

const REGIONS = ['Beskid Śląski', 'Beskid Żywiecki', 'Tatry'];
const COMMON_HAZARDS = ['kamienie', 'lód', 'krzaki', 'wiatr', 'mgła', 'lawiny', 'oblodzenie', 'zaspy'];

export function AdminReportIngestion() {
  const [phase, setPhase] = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Editable form state
  const [formData, setFormData] = useState<ParsedReport>({
    report_date: new Date().toISOString().split('T')[0],
    location: '',
    region: 'Beskid Śląski',
    snow_conditions: '',
    hazards: [],
    is_safe: true,
    author_name: null,
  });

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

      // Get session and verify user is logged in
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session?.access_token) {
        throw new Error('Nie jesteś zalogowany. Zaloguj się ponownie.');
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };

      console.log('Calling parse-report with auth token:', session.access_token.substring(0, 20) + '...');

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ raw_text: rawText }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Build detailed error message
        let errorMsg = data.error || 'Failed to parse report';
        if (data.details) {
          errorMsg += `\n\nSzczegóły: ${data.details}`;
        }
        if (data.raw_response) {
          errorMsg += `\n\nOdpowiedź AI: ${data.raw_response}`;
        }
        throw new Error(errorMsg);
      }

      if (data.parsed) {
        setFormData({
          ...data.parsed,
          hazards: data.parsed.hazards || [],
          author_name: data.parsed.author_name || null,
        });
        setRawResponse(data.raw_response);
        setPhase('review');
      } else {
        let errorMsg = 'No parsed data returned';
        if (data.raw_response) {
          errorMsg += `\n\nOdpowiedź AI: ${data.raw_response}`;
        }
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Parse error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData = {
        report_date: formData.report_date,
        location: formData.location,
        region: formData.region,
        snow_conditions: formData.snow_conditions || null,
        hazards: formData.hazards,
        is_safe: formData.is_safe,
        raw_source: rawText,
        author_name: formData.author_name,
        source_type: 'facebook',
        ingested_by: user?.id,
      };

      const { error: insertError } = await supabase
        .from('admin_reports')
        .insert(insertData as never);

      if (insertError) {
        throw insertError;
      }

      showToast('success', 'Raport zapisany pomyślnie!');
      setPhase('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      showToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPhase('input');
    setRawText('');
    setRawResponse(null);
    setError(null);
    setFormData({
      report_date: new Date().toISOString().split('T')[0],
      location: '',
      region: 'Beskid Śląski',
      snow_conditions: '',
      hazards: [],
      is_safe: true,
      author_name: null,
    });
  };

  const toggleHazard = (hazard: string) => {
    setFormData((prev) => ({
      ...prev,
      hazards: prev.hazards.includes(hazard)
        ? prev.hazards.filter((h) => h !== hazard)
        : [...prev.hazards, hazard],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Import raportu z Facebooka
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded ${phase === 'input' ? 'bg-blue-600' : 'bg-gray-700'}`}>
            1. Wklej
          </span>
          <span className={`px-2 py-1 rounded ${phase === 'review' ? 'bg-blue-600' : 'bg-gray-700'}`}>
            2. Sprawdź
          </span>
          <span className={`px-2 py-1 rounded ${phase === 'success' ? 'bg-green-600' : 'bg-gray-700'}`}>
            3. Zapisz
          </span>
        </div>
      </div>

      {/* Phase 1: Input */}
      {phase === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Wklej tekst posta z Facebooka
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Skopiuj i wklej cały post z Facebooka (włącznie z datą, autorem, treścią)..."
              className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
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
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analizuję z AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Przetwórz z AI
              </>
            )}
          </button>
        </div>
      )}

      {/* Phase 2: Review */}
      {phase === 'review' && (
        <div className="space-y-4">
          {/* Editable form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4" />
                Data raportu
              </label>
              <input
                type="date"
                value={formData.report_date}
                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4" />
                Lokalizacja
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="np. Skrzyczne, Pilsko"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Region */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4" />
                Region
              </label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Author */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4" />
                Autor
              </label>
              <input
                type="text"
                value={formData.author_name || ''}
                onChange={(e) => setFormData({ ...formData, author_name: e.target.value || null })}
                placeholder="Imię i nazwisko autora"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Snow conditions */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Snowflake className="w-4 h-4" />
              Warunki śniegowe
            </label>
            <textarea
              value={formData.snow_conditions}
              onChange={(e) => setFormData({ ...formData, snow_conditions: e.target.value })}
              placeholder="Opis warunków śniegowych..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Hazards */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Zagrożenia
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_HAZARDS.map((hazard) => (
                <button
                  key={hazard}
                  onClick={() => toggleHazard(hazard)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    formData.hazards.includes(hazard)
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {hazard}
                </button>
              ))}
            </div>
          </div>

          {/* Is safe toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFormData({ ...formData, is_safe: !formData.is_safe })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                formData.is_safe
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              {formData.is_safe ? 'Bezpieczne' : 'Niebezpieczne'}
            </button>
            <span className="text-sm text-gray-400">
              Kliknij, aby zmienić
            </span>
          </div>

          {/* Debug: Raw AI response */}
          {rawResponse && (
            <details className="bg-gray-800/50 rounded-lg p-3">
              <summary className="text-sm text-gray-400 cursor-pointer">
                Odpowiedź AI (debug)
              </summary>
              <pre className="mt-2 text-xs text-gray-500 overflow-x-auto whitespace-pre-wrap">
                {rawResponse}
              </pre>
            </details>
          )}

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <pre className="text-sm whitespace-pre-wrap break-words flex-1 font-sans">{error}</pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Zacznij od nowa
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !formData.location || !formData.region}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Zapisuję...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Zatwierdź i zapisz
                </>
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
          <h3 className="text-xl font-semibold text-white mb-2">Raport zapisany!</h3>
          <p className="text-gray-400 mb-6">
            Raport z {formData.location} został dodany do bazy danych.
          </p>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors mx-auto"
          >
            <FileText className="w-5 h-5" />
            Dodaj kolejny raport
          </button>
        </div>
      )}
    </div>
  );
}
