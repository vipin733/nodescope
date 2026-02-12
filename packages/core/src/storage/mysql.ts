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
 * MySQL storage adapter.
 * Production-ready with connection pooling and JSON support.
 */
export class MySQLStorage implements StorageAdapter {
  private pool: any;
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    const mysql = await import('mysql2/promise');
    this.pool = mysql.createPool(this.connectionString);

    // Create table with JSON columns
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS nodescope_entries (
        id VARCHAR(36) PRIMARY KEY,
        batch_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL,
        content JSON NOT NULL,
        tags JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        duration INT,
        memory_usage INT,
        INDEX idx_batch_id (batch_id),
        INDEX idx_type (type),
        INDEX idx_created_at (created_at)
      )
    `);
  }

  async save(entry: Entry): Promise<void> {
    await this.pool.execute(
      `INSERT INTO nodescope_entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content = VALUES(content),
         tags = VALUES(tags),
         duration = VALUES(duration),
         memory_usage = VALUES(memory_usage)`,
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
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const entry of entries) {
        await connection.execute(
          `INSERT INTO nodescope_entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             content = VALUES(content),
             tags = VALUES(tags),
             duration = VALUES(duration),
             memory_usage = VALUES(memory_usage)`,
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

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async find(id: string): Promise<Entry | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM nodescope_entries WHERE id = ?',
      [id]
    );

    if ((rows as any[]).length === 0) return null;
    return this.rowToEntry((rows as any[])[0]);
  }

  async list(options: ListOptions = {}): Promise<PaginatedResult<Entry>> {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;

    let where = '1=1';
    const params: any[] = [];

    if (type) {
      where += ' AND type = ?';
      params.push(type);
    }

    if (batchId) {
      where += ' AND batch_id = ?';
      params.push(batchId);
    }

    if (before) {
      where += ' AND created_at < ?';
      params.push(before);
    }

    if (after) {
      where += ' AND created_at > ?';
      params.push(after);
    }

    if (search) {
      where += ' AND JSON_SEARCH(content, "one", ?) IS NOT NULL';
      params.push(`%${search}%`);
    }

    // Get total count
    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) as count FROM nodescope_entries WHERE ${where}`,
      params
    );
    const total = (countRows as any[])[0].count;

    // Get paginated results
    const [dataRows] = await this.pool.execute(
      `SELECT * FROM nodescope_entries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    let data = (dataRows as any[]).map((row) => this.rowToEntry(row));

    // Filter by tags in memory (MySQL JSON array filtering is complex)
    if (tags && tags.length > 0) {
      data = data.filter((e) => tags.some((t) => e.tags.includes(t)));
    }

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async findByBatch(batchId: string): Promise<Entry[]> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM nodescope_entries WHERE batch_id = ? ORDER BY created_at ASC',
      [batchId]
    );

    return (rows as any[]).map((row) => this.rowToEntry(row));
  }

  async prune(beforeDate: Date): Promise<number> {
    const [result] = await this.pool.execute(
      'DELETE FROM nodescope_entries WHERE created_at < ?',
      [beforeDate]
    );

    return (result as any).affectedRows;
  }

  async clear(): Promise<void> {
    await this.pool.execute('DELETE FROM nodescope_entries');
  }

  async stats(): Promise<StorageStats> {
    const entriesByType = defaultEntryCounts();

    const [typeRows] = await this.pool.execute(
      'SELECT type, COUNT(*) as count FROM nodescope_entries GROUP BY type'
    );

    for (const row of typeRows as any[]) {
      entriesByType[row.type as EntryType] = row.count;
    }

    const [totalRows] = await this.pool.execute(
      'SELECT COUNT(*) as count FROM nodescope_entries'
    );

    const [rangeRows] = await this.pool.execute(
      'SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM nodescope_entries'
    );

    return {
      totalEntries: (totalRows as any[])[0].count,
      entriesByType,
      oldestEntry: (rangeRows as any[])[0].oldest
        ? new Date((rangeRows as any[])[0].oldest)
        : undefined,
      newestEntry: (rangeRows as any[])[0].newest
        ? new Date((rangeRows as any[])[0].newest)
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
