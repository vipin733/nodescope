import type {
  Entry,
  ListOptions,
  PaginatedResult,
  StorageStats,
  EntryType,
} from '../types.js';
import type { StorageAdapter } from './adapter.js';
import { defaultEntryCounts } from './adapter.js';

/**
 * PostgreSQL storage adapter.
 * Production-ready with connection pooling and JSONB support.
 */
export class PostgreSQLStorage implements StorageAdapter {
  private pool: any;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({ connectionString: this.connectionString });

    // Create table with JSONB for content and tags
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS nodescope_entries (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content JSONB NOT NULL,
        tags JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        duration INTEGER,
        memory_usage INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_nodescope_entries_batch_id ON nodescope_entries(batch_id);
      CREATE INDEX IF NOT EXISTS idx_nodescope_entries_type ON nodescope_entries(type);
      CREATE INDEX IF NOT EXISTS idx_nodescope_entries_created_at ON nodescope_entries(created_at);
      CREATE INDEX IF NOT EXISTS idx_nodescope_entries_tags ON nodescope_entries USING GIN(tags);
    `);
  }

  async save(entry: Entry): Promise<void> {
    await this.pool.query(
      `INSERT INTO nodescope_entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         tags = EXCLUDED.tags,
         duration = EXCLUDED.duration,
         memory_usage = EXCLUDED.memory_usage`,
      [
        entry.id,
        entry.batchId,
        entry.type,
        JSON.stringify(entry.content),
        JSON.stringify(entry.tags),
        entry.createdAt,
        entry.duration ?? null,
        entry.memoryUsage ?? null,
      ]
    );
  }

  async saveBatch(entries: Entry[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const entry of entries) {
        await client.query(
          `INSERT INTO nodescope_entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             tags = EXCLUDED.tags,
             duration = EXCLUDED.duration,
             memory_usage = EXCLUDED.memory_usage`,
          [
            entry.id,
            entry.batchId,
            entry.type,
            JSON.stringify(entry.content),
            JSON.stringify(entry.tags),
            entry.createdAt,
            entry.duration ?? null,
            entry.memoryUsage ?? null,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async find(id: string): Promise<Entry | null> {
    const result = await this.pool.query(
      'SELECT * FROM nodescope_entries WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToEntry(result.rows[0]);
  }

  async list(options: ListOptions = {}): Promise<PaginatedResult<Entry>> {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;

    let where = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      where += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (batchId) {
      where += ` AND batch_id = $${paramIndex++}`;
      params.push(batchId);
    }

    if (tags && tags.length > 0) {
      where += ` AND tags ?| $${paramIndex++}`;
      params.push(tags);
    }

    if (before) {
      where += ` AND created_at < $${paramIndex++}`;
      params.push(before);
    }

    if (after) {
      where += ` AND created_at > $${paramIndex++}`;
      params.push(after);
    }

    if (search) {
      where += ` AND content::text ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM nodescope_entries WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const dataResult = await this.pool.query(
      `SELECT * FROM nodescope_entries WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows.map((row: any) => this.rowToEntry(row)),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findByBatch(batchId: string): Promise<Entry[]> {
    const result = await this.pool.query(
      'SELECT * FROM nodescope_entries WHERE batch_id = $1 ORDER BY created_at ASC',
      [batchId]
    );

    return result.rows.map((row: any) => this.rowToEntry(row));
  }

  async prune(beforeDate: Date): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM nodescope_entries WHERE created_at < $1',
      [beforeDate]
    );

    return result.rowCount ?? 0;
  }

  async clear(): Promise<void> {
    await this.pool.query('DELETE FROM nodescope_entries');
  }

  async stats(): Promise<StorageStats> {
    const entriesByType = defaultEntryCounts();

    const typeResult = await this.pool.query(
      'SELECT type, COUNT(*) as count FROM nodescope_entries GROUP BY type'
    );

    for (const row of typeResult.rows) {
      entriesByType[row.type as EntryType] = parseInt(row.count, 10);
    }

    const totalResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM nodescope_entries'
    );

    const rangeResult = await this.pool.query(
      'SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM nodescope_entries'
    );

    return {
      totalEntries: parseInt(totalResult.rows[0].count, 10),
      entriesByType,
      oldestEntry: rangeResult.rows[0].oldest
        ? new Date(rangeResult.rows[0].oldest)
        : undefined,
      newestEntry: rangeResult.rows[0].newest
        ? new Date(rangeResult.rows[0].newest)
        : undefined,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private rowToEntry(row: any): Entry {
    return {
      id: row.id,
      batchId: row.batch_id,
      type: row.type as EntryType,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
      createdAt: new Date(row.created_at),
      duration: row.duration ?? undefined,
      memoryUsage: row.memory_usage ?? undefined,
    };
  }
}
