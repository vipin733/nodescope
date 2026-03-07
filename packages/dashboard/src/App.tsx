import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { EntrySummary } from './components/EntrySummary';
import { EntryDetail } from './components/EntryDetail';
import type { Entry, EntryType, StorageStats } from './types';
import { RefreshCw, Activity, Search as SearchIcon, ArrowLeft, ArrowRight } from 'lucide-react';

const getBasePath = () => {
  const meta = document.querySelector('meta[name="nodescope-base-path"]');
  const path = meta?.getAttribute('content');
  return path && !path.includes('{{') ? path : '/_nodescope';
};
const basePath = getBasePath();
const API_BASE = `${basePath}/api`;
const WS_URL = location.protocol === 'https:' ? `wss://${location.host}${basePath}/ws` : `ws://${location.host}${basePath}/ws`;

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [selectedType, setSelectedType] = useState<EntryType | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedType) params.set('type', selectedType);
    if (search) params.set('search', search);
    params.set('limit', '50');
    params.set('offset', String(page * 50));

    try {
      const res = await fetch(`${API_BASE}/entries?${params}`);
      const data = await res.json();
      setEntries(data.data || []);
      setHasMore(data.hasMore);
    } catch (e) {
      console.error('Failed to fetch entries:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedType, search, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, []);

  const clearEntries = async () => {
    if (!confirm('Are you sure you want to clear all entries?')) return;
    try {
      await fetch(`${API_BASE}/entries`, { method: 'DELETE' });
      setEntries([]);
      setSelectedEntry(null);
      fetchStats();
    } catch (e) {
      console.error('Failed to clear entries:', e);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchEntries();
  }, [fetchEntries, fetchStats]);

  useEffect(() => {
    // Setup WebSocket
    const connectWs = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          setTimeout(connectWs, 5000); // Reconnect after 5s
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'entry') {
            setEntries(prev => {
              if (page > 0 || (selectedType && data.data.type !== selectedType)) return prev;
              const newEntries = [data.data, ...prev];
              if (newEntries.length > 50) newEntries.pop();
              return newEntries;
            });
          }
          if (data.type === 'stats') {
            setStats(data.data);
          }
        };
      } catch (e) {
        console.error('WebSocket connection failed', e);
      }
    };

    connectWs();
    return () => wsRef.current?.close();
  }, [page, selectedType]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-primary-500/30">
      <Sidebar
        stats={stats}
        selectedType={selectedType}
        onSelectType={(t) => { setSelectedType(t); setPage(0); }}
        onClear={clearEntries}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-slate-800/60 p-4 flex items-center gap-6 shadow-sm z-10 relative">
          <div className="relative flex-1 max-w-xl">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search specific entries or payloads..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700/50 
                       focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20 focus:outline-none 
                       text-sm transition-all shadow-inner placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800">
            <div className="relative flex items-center justify-center">
              <span className={`absolute w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-ping opacity-75' : 'bg-red-500 opacity-50'}`}></span>
              <span className={`relative w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`}></span>
            </div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button
            onClick={() => { fetchEntries(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 
                     text-sm transition-colors border border-slate-700 font-medium text-slate-200 shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-5/12 border-r border-slate-800/60 flex flex-col bg-slate-950/80 z-0">
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                  <Activity className="animate-pulse text-primary-500" size={32} />
                  <p className="text-sm font-medium">Loading entries...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                  <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                    <SearchIcon size={24} className="opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No entries found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`entry-row p-4 cursor-pointer transition-colors ${selectedEntry?.id === entry.id
                        ? 'bg-primary-500/10 border-l-2 border-primary-500'
                        : 'border-l-2 border-transparent hover:bg-slate-900/50'
                        }`}
                    >
                      <EntrySummary entry={entry} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(hasMore || page > 0) && (
              <div className="p-3 border-t border-slate-800/60 flex justify-between items-center bg-slate-900/30">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-400">Page {page + 1}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 transition-colors"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="w-7/12 relative">
            <EntryDetail entry={selectedEntry} />
          </div>
        </div>
      </main>
    </div>
  );
}
