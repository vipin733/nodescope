/**
 * Get the embedded dashboard HTML
 * This is a simple HTML page that loads the dashboard React app
 */
export function getDashboardHtml(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NodeScope</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#f0f9ff',
              100: '#e0f2fe',
              200: '#bae6fd',
              300: '#7dd3fc',
              400: '#38bdf8',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
              800: '#075985',
              900: '#0c4a6e',
              950: '#082f49',
            },
          },
        },
      },
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
    }
    
    code, pre, .mono {
      font-family: 'JetBrains Mono', monospace;
    }
    
    .glass {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .entry-row:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .status-success { color: #4ade80; }
    .status-warning { color: #fbbf24; }
    .status-error { color: #f87171; }
    .status-info { color: #60a5fa; }
    
    .animate-pulse-slow {
      animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
    }
    
    /* JSON syntax highlighting */
    .json-key { color: #93c5fd; }
    .json-string { color: #86efac; }
    .json-number { color: #fcd34d; }
    .json-boolean { color: #f9a8d4; }
    .json-null { color: #a78bfa; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div id="app"></div>
  
  <script>
    const API_BASE = '${basePath}/api';
    const WS_URL = location.protocol === 'https:' 
      ? 'wss://' + location.host + '${basePath}/ws'
      : 'ws://' + location.host + '${basePath}/ws';
    
    // State
    let state = {
      entries: [],
      stats: null,
      selectedEntry: null,
      selectedType: null,
      search: '',
      loading: true,
      connected: false,
      page: 0,
      hasMore: false,
    };
    
    // Types
    const ENTRY_TYPES = [
      { type: 'request', label: 'Requests', icon: '🌐' },
      { type: 'query', label: 'Queries', icon: '🔍' },
      { type: 'cache', label: 'Cache', icon: '💾' },
      { type: 'log', label: 'Logs', icon: '📝' },
      { type: 'exception', label: 'Exceptions', icon: '⚠️' },
      { type: 'http_client', label: 'HTTP Client', icon: '📡' },
      { type: 'event', label: 'Events', icon: '📣' },
      { type: 'job', label: 'Jobs', icon: '⚙️' },
    ];
    
    // Fetch entries
    async function fetchEntries() {
      state.loading = true;
      render();
      
      const params = new URLSearchParams();
      if (state.selectedType) params.set('type', state.selectedType);
      if (state.search) params.set('search', state.search);
      params.set('limit', '50');
      params.set('offset', String(state.page * 50));
      
      try {
        const res = await fetch(API_BASE + '/entries?' + params);
        const data = await res.json();
        state.entries = data.data || [];
        state.hasMore = data.hasMore;
      } catch (e) {
        console.error('Failed to fetch entries:', e);
        state.entries = [];
      }
      
      state.loading = false;
      render();
    }
    
    // Fetch stats
    async function fetchStats() {
      try {
        const res = await fetch(API_BASE + '/stats');
        state.stats = await res.json();
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
      render();
    }
    
    // Clear entries
    async function clearEntries() {
      if (!confirm('Are you sure you want to clear all entries?')) return;
      
      try {
        await fetch(API_BASE + '/entries', { method: 'DELETE' });
        state.entries = [];
        state.selectedEntry = null;
        fetchStats();
      } catch (e) {
        console.error('Failed to clear entries:', e);
      }
      render();
    }
    
    // Format date
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleTimeString();
    }
    
    // Format duration
    function formatDuration(ms) {
      if (ms < 1) return '<1ms';
      if (ms < 1000) return Math.round(ms) + 'ms';
      return (ms / 1000).toFixed(2) + 's';
    }
    
    // Get status color
    function getStatusColor(status) {
      if (status >= 500) return 'status-error';
      if (status >= 400) return 'status-warning';
      if (status >= 200 && status < 300) return 'status-success';
      return 'status-info';
    }
    
    // Syntax highlight JSON
    function highlightJson(obj, indent = 0) {
      if (obj === null) return '<span class="json-null">null</span>';
      if (typeof obj === 'boolean') return '<span class="json-boolean">' + obj + '</span>';
      if (typeof obj === 'number') return '<span class="json-number">' + obj + '</span>';
      if (typeof obj === 'string') {
        const escaped = obj.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (escaped.length > 200) {
          return '<span class="json-string">"' + escaped.substring(0, 200) + '..."</span>';
        }
        return '<span class="json-string">"' + escaped + '"</span>';
      }
      if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map(i => '  '.repeat(indent + 1) + highlightJson(i, indent + 1)).join(',\\n');
        return '[\\n' + items + '\\n' + '  '.repeat(indent) + ']';
      }
      if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(k => {
          const key = '<span class="json-key">"' + k + '"</span>';
          const value = highlightJson(obj[k], indent + 1);
          return '  '.repeat(indent + 1) + key + ': ' + value;
        }).join(',\\n');
        return '{\\n' + items + '\\n' + '  '.repeat(indent) + '}';
      }
      return String(obj);
    }
    
    // Render entry summary
    function renderEntrySummary(entry) {
      switch (entry.type) {
        case 'request':
          const req = entry.content;
          return \`
            <span class="font-medium">\${req.method}</span>
            <span class="text-slate-400 mx-1">\${req.path}</span>
            <span class="\${getStatusColor(req.response?.status || 0)}">\${req.response?.status || '...'}</span>
          \`;
        case 'query':
          const sql = entry.content.sql?.substring(0, 60) || '';
          return \`
            <span class="mono text-sm">\${sql}\${sql.length >= 60 ? '...' : ''}</span>
            \${entry.content.slow ? '<span class="ml-2 px-1 py-0.5 rounded bg-yellow-900 text-yellow-200 text-xs">slow</span>' : ''}
          \`;
        case 'cache':
          return \`
            <span class="font-medium">\${entry.content.operation}</span>
            <span class="text-slate-400 mx-1">\${entry.content.key}</span>
          \`;
        case 'log':
          return \`
            <span class="\${entry.content.level === 'error' ? 'status-error' : entry.content.level === 'warn' ? 'status-warning' : 'text-slate-300'}">\${entry.content.message?.substring(0, 80) || ''}</span>
          \`;
        case 'exception':
          return \`
            <span class="status-error font-medium">\${entry.content.class}</span>
            <span class="text-slate-400 mx-1">\${entry.content.message?.substring(0, 50) || ''}</span>
          \`;
        case 'http_client':
          const hc = entry.content;
          return \`
            <span class="font-medium">\${hc.method}</span>
            <span class="text-slate-400 mx-1 mono text-sm">\${new URL(hc.url).host}</span>
            <span class="\${getStatusColor(hc.response?.status || 0)}">\${hc.response?.status || '...'}</span>
          \`;
        case 'event':
          return \`
            <span class="font-medium">\${entry.content.name}</span>
            <span class="text-slate-400 mx-1">\${entry.content.listeners?.length || 0} listeners</span>
          \`;
        case 'job':
          return \`
            <span class="font-medium">\${entry.content.name}</span>
            <span class="\${entry.content.status === 'completed' ? 'status-success' : entry.content.status === 'failed' ? 'status-error' : 'status-info'} ml-1">\${entry.content.status}</span>
          \`;
        default:
          return \`<span class="text-slate-400">\${entry.type}</span>\`;
      }
    }
    
    // Render entry detail
    function renderEntryDetail(entry) {
      if (!entry) {
        return \`
          <div class="flex items-center justify-center h-full text-slate-500">
            <p>Select an entry to view details</p>
          </div>
        \`;
      }
      
      return \`
        <div class="p-4 space-y-4 overflow-y-auto h-full scrollbar-thin">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold capitalize">\${entry.type}</h3>
            <span class="text-sm text-slate-400">\${formatDate(entry.createdAt)}</span>
          </div>
          
          \${entry.duration ? \`
            <div class="flex items-center gap-4 text-sm">
              <span class="text-slate-400">Duration:</span>
              <span class="font-mono">\${formatDuration(entry.duration)}</span>
            </div>
          \` : ''}
          
          \${entry.tags.length ? \`
            <div class="flex flex-wrap gap-1">
              \${entry.tags.map(t => \`<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs">\${t}</span>\`).join('')}
            </div>
          \` : ''}
          
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-slate-400">Content</h4>
            <pre class="p-4 rounded-lg bg-slate-900 overflow-x-auto text-sm mono">\${highlightJson(entry.content)}</pre>
          </div>
        </div>
      \`;
    }
    
    // Main render function
    function render() {
      const app = document.getElementById('app');
      
      app.innerHTML = \`
        <div class="flex h-screen">
          <!-- Sidebar -->
          <aside class="w-64 glass border-r border-slate-800 flex flex-col">
            <div class="p-4 border-b border-slate-800">
              <h1 class="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                ⚡ NodeScope
              </h1>
              <p class="text-xs text-slate-500 mt-1">Debug Assistant</p>
            </div>
            
            <nav class="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
              <button 
                onclick="state.selectedType = null; state.page = 0; fetchEntries();"
                class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 \${!state.selectedType ? 'bg-primary-600/20 text-primary-300' : 'hover:bg-slate-800 text-slate-300'}">
                <span>📊</span>
                <span>All</span>
                \${state.stats ? \`<span class="ml-auto text-xs text-slate-500">\${state.stats.totalEntries}</span>\` : ''}
              </button>
              
              \${ENTRY_TYPES.map(t => \`
                <button 
                  onclick="state.selectedType = '\${t.type}'; state.page = 0; fetchEntries();"
                  class="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 \${state.selectedType === t.type ? 'bg-primary-600/20 text-primary-300' : 'hover:bg-slate-800 text-slate-300'}">
                  <span>\${t.icon}</span>
                  <span>\${t.label}</span>
                  \${state.stats?.entriesByType ? \`<span class="ml-auto text-xs text-slate-500">\${state.stats.entriesByType[t.type] || 0}</span>\` : ''}
                </button>
              \`).join('')}
            </nav>
            
            <div class="p-2 border-t border-slate-800">
              <button 
                onclick="clearEntries()"
                class="w-full px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 flex items-center gap-2 text-sm">
                <span>🗑️</span>
                <span>Clear All</span>
              </button>
            </div>
          </aside>
          
          <!-- Main content -->
          <main class="flex-1 flex flex-col">
            <!-- Header -->
            <header class="glass border-b border-slate-800 p-4 flex items-center gap-4">
              <div class="relative flex-1 max-w-md">
                <input 
                  type="text" 
                  placeholder="Search entries..." 
                  value="\${state.search}"
                  oninput="state.search = this.value; state.page = 0; fetchEntries();"
                  class="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-primary-500 focus:outline-none text-sm">
              </div>
              
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full \${state.connected ? 'bg-green-500 animate-pulse-slow' : 'bg-red-500'}"></span>
                <span class="text-xs text-slate-500">\${state.connected ? 'Live' : 'Offline'}</span>
              </div>
              
              <button 
                onclick="fetchEntries(); fetchStats();"
                class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm">
                🔄 Refresh
              </button>
            </header>
            
            <!-- Content -->
            <div class="flex-1 flex overflow-hidden">
              <!-- Entry list -->
              <div class="w-1/2 border-r border-slate-800 flex flex-col">
                <div class="flex-1 overflow-y-auto scrollbar-thin">
                  \${state.loading ? \`
                    <div class="flex items-center justify-center h-32">
                      <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                    </div>
                  \` : state.entries.length === 0 ? \`
                    <div class="flex items-center justify-center h-32 text-slate-500">
                      <p>No entries found</p>
                    </div>
                  \` : \`
                    <div class="divide-y divide-slate-800">
                      \${state.entries.map((entry, i) => \`
                        <div 
                          onclick="state.selectedEntry = state.entries[\${i}]; render();"
                          class="entry-row p-3 cursor-pointer \${state.selectedEntry?.id === entry.id ? 'bg-primary-600/10 border-l-2 border-primary-500' : ''}">
                          <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-2 flex-1 min-w-0">
                              <span class="text-xs text-slate-500">\${formatDate(entry.createdAt)}</span>
                              <span class="truncate">\${renderEntrySummary(entry)}</span>
                            </div>
                            \${entry.duration ? \`<span class="text-xs text-slate-500 ml-2">\${formatDuration(entry.duration)}</span>\` : ''}
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  \`}
                </div>
                
                \${state.hasMore || state.page > 0 ? \`
                  <div class="p-2 border-t border-slate-800 flex justify-between">
                    <button 
                      onclick="state.page = Math.max(0, state.page - 1); fetchEntries();"
                      \${state.page === 0 ? 'disabled' : ''}
                      class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50">
                      ← Prev
                    </button>
                    <span class="text-sm text-slate-500">Page \${state.page + 1}</span>
                    <button 
                      onclick="state.page++; fetchEntries();"
                      \${!state.hasMore ? 'disabled' : ''}
                      class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50">
                      Next →
                    </button>
                  </div>
                \` : ''}
              </div>
              
              <!-- Entry detail -->
              <div class="w-1/2 bg-slate-900/50">
                \${renderEntryDetail(state.selectedEntry)}
              </div>
            </div>
          </main>
        </div>
      \`;
    }
    
    // Initialize
    fetchStats();
    fetchEntries();
    
    // WebSocket connection (optional)
    try {
      const ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        state.connected = true;
        render();
      };
      ws.onclose = () => {
        state.connected = false;
        render();
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'entry') {
          state.entries.unshift(data.data);
          if (state.entries.length > 50) state.entries.pop();
          render();
        }
        if (data.type === 'stats') {
          state.stats = data.data;
          render();
        }
      };
    } catch (e) {
      console.log('WebSocket not available');
    }
  </script>
</body>
</html>`;
}
