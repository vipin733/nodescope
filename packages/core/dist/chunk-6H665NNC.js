import {
  defaultEntryCounts
} from "./chunk-OF6NKXP5.js";

// src/storage/postgresql.ts
var PostgreSQLStorage = class {
  pool;
  connectionString;
  constructor(connectionString) {
    this.connectionString = connectionString;
  }
  async initialize() {
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: this.connectionString });
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
  async save(entry) {
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
        entry.memoryUsage ?? null
      ]
    );
  }
  async saveBatch(entries) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
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
            entry.memoryUsage ?? null
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async find(id) {
    const result = await this.pool.query(
      "SELECT * FROM nodescope_entries WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.rowToEntry(result.rows[0]);
  }
  async list(options = {}) {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;
    let where = "1=1";
    const params = [];
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
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM nodescope_entries WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const dataResult = await this.pool.query(
      `SELECT * FROM nodescope_entries WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );
    return {
      data: dataResult.rows.map((row) => this.rowToEntry(row)),
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }
  async findByBatch(batchId) {
    const result = await this.pool.query(
      "SELECT * FROM nodescope_entries WHERE batch_id = $1 ORDER BY created_at ASC",
      [batchId]
    );
    return result.rows.map((row) => this.rowToEntry(row));
  }
  async prune(beforeDate) {
    const result = await this.pool.query(
      "DELETE FROM nodescope_entries WHERE created_at < $1",
      [beforeDate]
    );
    return result.rowCount ?? 0;
  }
  async clear() {
    await this.pool.query("DELETE FROM nodescope_entries");
  }
  async stats() {
    const entriesByType = defaultEntryCounts();
    const typeResult = await this.pool.query(
      "SELECT type, COUNT(*) as count FROM nodescope_entries GROUP BY type"
    );
    for (const row of typeResult.rows) {
      entriesByType[row.type] = parseInt(row.count, 10);
    }
    const totalResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM nodescope_entries"
    );
    const rangeResult = await this.pool.query(
      "SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM nodescope_entries"
    );
    return {
      totalEntries: parseInt(totalResult.rows[0].count, 10),
      entriesByType,
      oldestEntry: rangeResult.rows[0].oldest ? new Date(rangeResult.rows[0].oldest) : void 0,
      newestEntry: rangeResult.rows[0].newest ? new Date(rangeResult.rows[0].newest) : void 0
    };
  }
  async close() {
    await this.pool.end();
  }
  rowToEntry(row) {
    return {
      id: row.id,
      batchId: row.batch_id,
      type: row.type,
      content: typeof row.content === "string" ? JSON.parse(row.content) : row.content,
      tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
      createdAt: new Date(row.created_at),
      duration: row.duration ?? void 0,
      memoryUsage: row.memory_usage ?? void 0
    };
  }
};

export {
  PostgreSQLStorage
};
