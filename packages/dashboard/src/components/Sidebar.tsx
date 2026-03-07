import React from 'react';
import {
    Globe, Search, HardDrive, FileText,
    AlertTriangle, Radio, Megaphone, Settings, Trash2, LayoutDashboard
} from 'lucide-react';
import type { EntryType, StorageStats } from '../types';

interface SidebarProps {
    stats: StorageStats | null;
    selectedType: EntryType | null;
    onSelectType: (type: EntryType | null) => void;
    onClear: () => void;
}

const ENTRY_TYPES: { type: EntryType | null; label: string; icon: React.ReactNode }[] = [
    { type: null, label: 'All', icon: <LayoutDashboard size={18} /> },
    { type: 'request', label: 'Requests', icon: <Globe size={18} /> },
    { type: 'query', label: 'Queries', icon: <Search size={18} /> },
    { type: 'cache', label: 'Cache', icon: <HardDrive size={18} /> },
    { type: 'log', label: 'Logs', icon: <FileText size={18} /> },
    { type: 'exception', label: 'Exceptions', icon: <AlertTriangle size={18} /> },
    { type: 'http_client', label: 'HTTP Client', icon: <Radio size={18} /> },
    { type: 'event', label: 'Events', icon: <Megaphone size={18} /> },
    { type: 'job', label: 'Jobs', icon: <Settings size={18} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({ stats, selectedType, onSelectType, onClear }) => {
    return (
        <aside className="w-64 glass border-r border-slate-800 flex flex-col h-full bg-slate-950/50">
            <div className="p-4 border-b border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent flex items-center gap-2">
                    ⚡ NodeScope
                </h1>
                <p className="text-xs text-slate-500 mt-1">Debug Assistant</p>
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
                {ENTRY_TYPES.map((t) => {
                    const isActive = selectedType === t.type;
                    const count = t.type === null
                        ? stats?.totalEntries
                        : stats?.entriesByType?.[t.type as EntryType] || 0;

                    return (
                        <button
                            key={t.type || 'all'}
                            onClick={() => onSelectType(t.type)}
                            className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${isActive ? 'bg-primary-600/20 text-primary-300' : 'hover:bg-slate-800 text-slate-300'
                                }`}
                        >
                            {t.icon}
                            <span className="flex-1 text-sm">{t.label}</span>
                            {stats && (
                                <span className="text-xs text-slate-500 font-mono">
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="p-3 border-t border-slate-800">
                <button
                    onClick={onClear}
                    className="w-full px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/50 flex items-center gap-2 text-sm transition-colors group"
                >
                    <Trash2 size={16} className="group-hover:text-red-300" />
                    <span>Clear All Data</span>
                </button>
            </div>
        </aside>
    );
};
