import React from 'react';
import type { Entry } from '../types';
import { formatDate, formatDuration } from '../utils';
import { JsonViewer } from './JsonViewer';
import { Clock, Tag } from 'lucide-react';

interface Props {
    entry: Entry | null;
}

export const EntryDetail: React.FC<Props> = ({ entry }) => {
    if (!entry) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 flex-col gap-4 bg-slate-900/30">
                <div className="p-4 rounded-full bg-slate-800/50">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p>Select an entry to view details</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full scrollbar-thin bg-slate-900/30">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-xl font-bold text-slate-100 capitalize tracking-wide flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-primary-900/50 border border-primary-500/20 text-primary-300 text-sm">
                        {entry.type}
                    </span>
                </h3>
                <span className="text-sm text-slate-400 flex items-center gap-1.5">
                    <Clock size={14} />
                    {formatDate(entry.createdAt)}
                </span>
            </div>

            {entry.duration !== undefined && (
                <div className="flex items-center gap-3 text-sm bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 font-medium w-20">Duration</span>
                    <span className="font-mono text-slate-200">{formatDuration(entry.duration)}</span>
                </div>
            )}

            {entry.tags && entry.tags.length > 0 && (
                <div className="flex items-start gap-4">
                    <div className="pt-0.5 text-slate-400"><Tag size={16} /></div>
                    <div className="flex flex-wrap gap-2">
                        {entry.tags.map((t, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs shadow-sm">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest pl-1">Payload</h4>
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800/80 shadow-inner overflow-x-auto">
                    <pre className="text-sm leading-relaxed font-mono">
                        <JsonViewer data={entry.content} />
                    </pre>
                </div>
            </div>
        </div>
    );
};
