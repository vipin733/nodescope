import React from 'react';
import type { Entry } from '../types';
import { getStatusColor } from '../utils';

interface Props {
    entry: Entry;
}

export const EntrySummary: React.FC<Props> = ({ entry }) => {
    switch (entry.type) {
        case 'request': {
            const req = entry.content as any;
            const status = req.response?.status || 0;
            return (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs tracking-wider uppercase w-12">{req.method}</span>
                    <span className="text-slate-300 font-mono text-sm truncate max-w-xs" title={req.path}>{req.path}</span>
                    <span className={`font-mono text-xs ${getStatusColor(status)}`}>{status || '...'}</span>
                </div>
            );
        }
        case 'query': {
            const sql: string = entry.content.sql || '';
            const slow: boolean = !!entry.content.slow;
            return (
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs truncate text-slate-300" title={sql}>
                        {sql.length > 70 ? sql.slice(0, 70) + '...' : sql}
                    </span>
                    {slow && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 text-[10px] font-medium border border-amber-800/50">
                            SLOW
                        </span>
                    )}
                </div>
            );
        }
        case 'cache':
            return (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-purple-400 uppercase tracking-wider">{entry.content.operation}</span>
                    <span className="text-slate-300 font-mono text-sm">{entry.content.key}</span>
                </div>
            );
        case 'log': {
            const level = entry.content.level as string;
            const color = level === 'error' ? 'text-red-400' : level === 'warn' ? 'text-amber-400' : 'text-blue-400';
            return (
                <div className="flex items-center gap-2">
                    <span className={`font-medium ${color} text-xs uppercase w-12`}>{level}</span>
                    <span className="text-slate-300 text-sm truncate" title={entry.content.message}>{entry.content.message}</span>
                </div>
            );
        }
        case 'exception':
            return (
                <div className="flex items-center gap-2">
                    <span className="text-red-400 font-mono text-xs truncate max-w-[150px]">{entry.content.class}</span>
                    <span className="text-slate-300 text-sm truncate">{entry.content.message}</span>
                </div>
            );
        case 'http_client': {
            const hc = entry.content as any;
            const url = new URL(hc.url).host;
            return (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-indigo-400 uppercase tracking-wider w-12">{hc.method}</span>
                    <span className="text-slate-300 font-mono text-sm">{url}</span>
                    <span className={`font-mono text-xs ${getStatusColor(hc.response?.status)}`}>{hc.response?.status || '...'}</span>
                </div>
            );
        }
        case 'event':
            return (
                <div className="flex items-center gap-2">
                    <span className="text-amber-300 font-medium text-sm">{entry.content.name}</span>
                    <span className="text-slate-500 text-xs">{entry.content.listeners?.length || 0} listeners</span>
                </div>
            );
        case 'job':
            return (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-200">{entry.content.name}</span>
                    <span className={`text-xs ml-1 ${entry.content.status === 'completed' ? 'text-green-400' : entry.content.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                        {entry.content.status}
                    </span>
                </div>
            );
        default:
            return <span className="text-slate-400 text-sm capitalize">{entry.type}</span>;
    }
};
