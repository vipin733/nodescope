import {
  defaultEntryCounts
} from "./chunk-OF6NKXP5.js";

// src/storage/mysql.ts
var MySQLStorage = class {
  pool;
  connectionString;
  constructor(connectionString) {
    this.connectionString = connectionString;
  }
  async initialize() {
    const mysql = await import("mysql2/promise");
    this.pool = mysql.createPool(this.connectionString);
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
  async save(entry) {
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
        entry.memoryUsage ?? null
      ]
    );
  }
  async saveBatch(entries) {
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
            entry.memoryUsage ?? null
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
  async find(id) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM nodescope_entries WHERE id = ?",
      [id]
    );
    if (rows.length === 0) return null;
    return this.rowToEntry(rows[0]);
  }
  async list(options = {}) {
    const { type, batchId, tags, search, before, after, limit = 50, offset = 0 } = options;
    let where = "1=1";
    const params = [];
    if (type) {
      where += " AND type = ?";
      params.push(type);
    }
    if (batchId) {
      where += " AND batch_id = ?";
      params.push(batchId);
    }
    if (before) {
      where += " AND created_at < ?";
      params.push(before);
    }
    if (after) {
      where += " AND created_at > ?";
      params.push(after);
    }
    if (search) {
      where += ' AND JSON_SEARCH(content, "one", ?) IS NOT NULL';
      params.push(`%${search}%`);
    }
    const [countRows] = await this.pool.execute(
      `SELECT COUNT(*) as count FROM nodescope_entries WHERE ${where}`,
      params
    );
    const total = countRows[0].count;
    const [dataRows] = await this.pool.execute(
      `SELECT * FROM nodescope_entries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    let data = dataRows.map((row) => this.rowToEntry(row));
    if (tags && tags.length > 0) {
      data = data.filter((e) => tags.some((t) => e.tags.includes(t)));
    }
    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }
  async findByBatch(batchId) {
    const [rows] = await this.pool.execute(
      "SELECT * FROM nodescope_entries WHERE batch_id = ? ORDER BY created_at ASC",
      [batchId]
    );
    return rows.map((row) => this.rowToEntry(row));
  }
  async prune(beforeDate) {
    const [result] = await this.pool.execute(
      "DELETE FROM nodescope_entries WHERE created_at < ?",
      [beforeDate]
    );
    return result.affectedRows;
  }
  async clear() {
    await this.pool.execute("DELETE FROM nodescope_entries");
  }
  async stats() {
    const entriesByType = defaultEntryCounts();
    const [typeRows] = await this.pool.execute(
      "SELECT type, COUNT(*) as count FROM nodescope_entries GROUP BY type"
    );
    for (const row of typeRows) {
      entriesByType[row.type] = row.count;
    }
    const [totalRows] = await this.pool.execute(
      "SELECT COUNT(*) as count FROM nodescope_entries"
    );
    const [rangeRows] = await this.pool.execute(
      "SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM nodescope_entries"
    );
    return {
      totalEntries: totalRows[0].count,
      entriesByType,
      oldestEntry: rangeRows[0].oldest ? new Date(rangeRows[0].oldest) : void 0,
      newestEntry: rangeRows[0].newest ? new Date(rangeRows[0].newest) : void 0
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
  MySQLStorage
};
