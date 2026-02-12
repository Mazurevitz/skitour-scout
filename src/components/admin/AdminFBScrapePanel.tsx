/**
 * Admin FB Scrape Panel
 *
 * UI for managing automated Facebook group scraping:
 * - Manual trigger with date range selection
 * - Group management with scraped date coverage
 * - Job history with status and costs
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  RefreshCw,
  Loader2,
  Check,
  X,
  AlertTriangle,
  DollarSign,
  FileText,
  ExternalLink,
  Trash2,
  Calendar,
  Plus,
} from 'lucide-react';
import { supabase, callEdgeFunction } from '@/lib/supabase';
import { format, subDays } from 'date-fns';

interface ScrapeJob {
  id: string;
  created_at: string;
  mode: 'daily' | 'backfill' | 'manual';
  status: 'pending' | 'running' | 'processing' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  posts_fetched: number;
  posts_filtered: number;
  posts_relevant: number;
  reports_created: number;
  apify_cost_usd: number | null;
  llm_filter_cost_usd: number | null;
  llm_parse_cost_usd: number | null;
  trigger_source: 'manual' | 'cron' | 'webhook';
  date_from: string | null;
  date_to: string | null;
}

interface FBGroupConfig {
  id: string;
  group_url: string;
  group_name: string;
  region: string;
  is_active: boolean;
  max_posts_per_scrape: number;
  last_scraped_at: string | null;
  total_posts_scraped: number;
  total_reports_created: number;
  earliest_scraped_date: string | null;
  latest_scraped_date: string | null;
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}


export function AdminFBScrapePanel() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [groups, setGroups] = useState<FBGroupConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);

  // Scrape form state
  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // New group form
  const [newGroupUrl, setNewGroupUrl] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      // Load jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('scrape_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (jobsError) throw jobsError;
      setJobs((jobsData || []) as ScrapeJob[]);

      // Load groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('fb_group_configs')
        .select('*')
        .order('group_name');

      if (groupsError) throw groupsError;
      setGroups((groupsData || []) as FBGroupConfig[]);

      // Select all active groups by default
      if (selectedGroups.length === 0 && groupsData) {
        setSelectedGroups(
          (groupsData as FBGroupConfig[])
            .filter(g => g.is_active)
            .map(g => g.id)
        );
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast('error', 'Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, [selectedGroups.length]);

  useEffect(() => {
    loadData();

    // Refresh every 30 seconds if there's a running job
    const interval = setInterval(() => {
      if (jobs.some(j => j.status === 'running' || j.status === 'processing')) {
        loadData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadData, jobs]);

  const triggerScrape = async () => {
    if (selectedGroups.length === 0) {
      showToast('error', 'Wybierz przynajmniej jedną grupę');
      return;
    }

    if (!dateFrom || !dateTo) {
      showToast('error', 'Wybierz zakres dat');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      showToast('error', 'Data początkowa musi być przed końcową');
      return;
    }

    setTriggering(true);

    try {
      const { data, error } = await callEdgeFunction<{ message?: string }>('fb-scrape-trigger', {
        mode: 'manual',
        group_ids: selectedGroups,
        date_from: dateFrom,
        date_to: dateTo,
      });

      if (error) {
        // Show as alert for multi-line errors (with help text)
        if (error.includes('\n')) {
          alert(error);
        } else {
          showToast('error', error);
        }
        return;
      }

      showToast('success', data?.message || `Uruchomiono scraping dla ${selectedGroups.length} grup`);
      loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTriggering(false);
    }
  };

  const processJob = async (jobId?: string) => {
    setProcessing(true);

    try {
      const { data, error } = await callEdgeFunction<{ stats?: { reports_created: number }; message?: string }>(
        'fb-scrape-process',
        { job_id: jobId }
      );

      if (error) {
        showToast('error', error);
        return;
      }

      if (data?.stats) {
        showToast('success', `Przetworzono: ${data.stats.reports_created} raportów`);
      } else {
        showToast('success', data?.message || 'Przetworzono');
      }
      loadData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessing(false);
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleGroupActive = async (groupId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('fb_group_configs')
        .update({ is_active: !isActive } as never)
        .eq('id', groupId);

      if (error) throw error;
      loadData();
    } catch (err) {
      showToast('error', 'Nie udało się zaktualizować grupy');
    }
  };

  const addGroup = async () => {
    if (!newGroupUrl || !newGroupName) {
      showToast('error', 'Podaj URL i nazwę grupy');
      return;
    }

    setAddingGroup(true);
    try {
      const { error } = await supabase
        .from('fb_group_configs')
        .insert({
          group_url: newGroupUrl,
          group_name: newGroupName,
        } as never);

      if (error) throw error;

      setNewGroupUrl('');
      setNewGroupName('');
      setShowAddGroup(false);
      showToast('success', 'Dodano grupę');
      loadData();
    } catch (err) {
      showToast('error', 'Nie udało się dodać grupy');
    } finally {
      setAddingGroup(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę grupę?')) return;

    try {
      const { error } = await supabase
        .from('fb_group_configs')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      loadData();
    } catch (err) {
      showToast('error', 'Nie udało się usunąć grupy');
    }
  };

  const getStatusBadge = (status: ScrapeJob['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 bg-gray-600 text-gray-200 rounded text-xs">Oczekuje</span>;
      case 'running':
        return <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />Apify
        </span>;
      case 'processing':
        return <span className="px-2 py-0.5 bg-amber-600 text-white rounded text-xs flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />LLM
        </span>;
      case 'completed':
        return <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs flex items-center gap-1">
          <Check className="w-3 h-3" />OK
        </span>;
      case 'failed':
        return <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs flex items-center gap-1">
          <X className="w-3 h-3" />Błąd
        </span>;
    }
  };

  const getTotalCost = (job: ScrapeJob) => {
    const total = (job.apify_cost_usd || 0) + (job.llm_filter_cost_usd || 0) + (job.llm_parse_cost_usd || 0);
    return total > 0 ? `$${total.toFixed(4)}` : '-';
  };

  const formatDateRange = (group: FBGroupConfig) => {
    if (!group.earliest_scraped_date && !group.latest_scraped_date) {
      return <span className="text-gray-500">Nie scrapowano</span>;
    }
    const from = group.earliest_scraped_date ? format(new Date(group.earliest_scraped_date), 'dd.MM') : '?';
    const to = group.latest_scraped_date ? format(new Date(group.latest_scraped_date), 'dd.MM.yyyy') : '?';
    return <span className="text-green-400">{from} - {to}</span>;
  };

  // Calculate totals
  const totalCosts = jobs.reduce((acc, job) => {
    return acc + (job.apify_cost_usd || 0) + (job.llm_filter_cost_usd || 0) + (job.llm_parse_cost_usd || 0);
  }, 0);
  const totalReports = jobs.reduce((acc, job) => acc + (job.reports_created || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
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

      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          Scraping FB
        </h2>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            {totalReports} raportów
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            ${totalCosts.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Groups Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Grupy do scrapowania
          </h3>
          <button
            onClick={() => setShowAddGroup(!showAddGroup)}
            className="flex items-center gap-1 px-2 py-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Dodaj grupę
          </button>
        </div>

        {/* Add group form */}
        {showAddGroup && (
          <div className="flex flex-wrap gap-2 p-3 bg-gray-700/50 rounded-lg">
            <input
              type="url"
              value={newGroupUrl}
              onChange={(e) => setNewGroupUrl(e.target.value)}
              placeholder="https://facebook.com/groups/..."
              className="flex-1 min-w-[200px] px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nazwa grupy"
              className="w-48 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={addGroup}
              disabled={addingGroup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded font-medium text-sm transition-colors"
            >
              {addingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dodaj'}
            </button>
            <button
              onClick={() => setShowAddGroup(false)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
            >
              Anuluj
            </button>
          </div>
        )}

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            Brak grup. Dodaj pierwszą grupę FB do scrapowania.
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(group => (
              <div
                key={group.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedGroups.includes(group.id)
                    ? 'bg-blue-600/20 border-blue-500'
                    : group.is_active
                      ? 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                      : 'bg-gray-800/50 border-gray-700 opacity-50'
                }`}
                onClick={() => group.is_active && toggleGroupSelection(group.id)}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedGroups.includes(group.id)
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-500'
                  }`}
                >
                  {selectedGroups.includes(group.id) && <Check className="w-3 h-3 text-white" />}
                </div>

                {/* Group info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{group.group_name}</span>
                    {group.region && <span className="text-xs px-1.5 py-0.5 bg-gray-600 rounded text-gray-300">{group.region}</span>}
                    <a
                      href={group.group_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-400"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>Scrapowane: {formatDateRange(group)}</span>
                    <span>{group.total_reports_created} raportów</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleGroupActive(group.id, group.is_active)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      group.is_active
                        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                        : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                    }`}
                  >
                    {group.is_active ? 'Aktywna' : 'Nieaktywna'}
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrape Controls */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <h3 className="font-medium text-white">Uruchom scraping</h3>

        <div className="flex flex-wrap items-end gap-4">
          {/* Date range */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1">Od daty</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1">Do daty</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Quick presets */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 3), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              3 dni
            </button>
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              7 dni
            </button>
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              30 dni
            </button>
          </div>
        </div>

        {/* Trigger button */}
        <div className="flex gap-3">
          <button
            onClick={triggerScrape}
            disabled={triggering || selectedGroups.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
          >
            {triggering ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Uruchamiam...</>
            ) : (
              <><Play className="w-5 h-5" />Uruchom scraping ({selectedGroups.length} grup)</>
            )}
          </button>

          {jobs.some(j => j.status === 'running') && (
            <button
              onClick={() => processJob()}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-xl font-medium transition-colors"
            >
              {processing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <><RefreshCw className="w-5 h-5" />Przetwórz</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Jobs History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-400">Historia zadań</h3>
          <button
            onClick={loadData}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Odśwież
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Brak zadań. Uruchom pierwszy scraping.
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => (
              <div
                key={job.id}
                className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
              >
                {getStatusBadge(job.status)}

                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">
                      {format(new Date(job.created_at), 'dd.MM HH:mm')}
                    </span>
                    {job.date_from && job.date_to && (
                      <span className="text-xs text-gray-500">
                        ({format(new Date(job.date_from), 'dd.MM')} - {format(new Date(job.date_to), 'dd.MM')})
                      </span>
                    )}
                  </div>
                  {job.status === 'completed' && (
                    <span className="text-gray-500 text-xs">
                      {job.posts_fetched} postów → {job.posts_relevant} trafnych → {job.reports_created} raportów
                    </span>
                  )}
                  {job.error_message && (
                    <span className="text-red-400 text-xs block truncate">{job.error_message}</span>
                  )}
                </div>

                <span className="text-xs text-gray-500">{getTotalCost(job)}</span>

                {job.status === 'running' && (
                  <button
                    onClick={() => processJob(job.id)}
                    disabled={processing}
                    className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors"
                  >
                    Przetwórz
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
