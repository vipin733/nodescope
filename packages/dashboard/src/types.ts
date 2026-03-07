export type EntryType =
  | 'request'
  | 'query'
  | 'cache'
  | 'log'
  | 'exception'
  | 'http_client'
  | 'event'
  | 'job'
  | 'schedule'
  | 'dump';

export interface Entry {
  id: string;
  batchId: string;
  type: EntryType;
  content: any;
  tags: string[];
  createdAt: string;
  duration?: number;
  memoryUsage?: number;
}

export interface StorageStats {
  totalEntries: number;
  entriesByType: Record<EntryType, number>;
  oldestEntry?: string;
  newestEntry?: string;
}
