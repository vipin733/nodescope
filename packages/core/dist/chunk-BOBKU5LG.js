import {
  defaultEntryCounts
} from "./chunk-OF6NKXP5.js";

// src/storage/sqlite.ts
var SQLiteStorage = class {
  db;
  dbPath;
  constructor(dbPath) {
    this.dbPath = dbPath;
  }
  async initialize() {
    const Database = (await import("better-sqlite3")).default;
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at TEXT NOT NULL,
        duration INTEGER,
        memory_usage INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_entries_batch_id ON entries(batch_id);
      CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
      CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
    `);
  }
  async save(entry) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.batchId,
      entry.type,
      JSON.stringify(entry.content),
      JSON.stringify(entry.tags),
      entry.createdAt.toISOString(),
      entry.duration ?? null,
      entry.memoryUsage ?? null
    );
  }
  async saveBatch(entries) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (id, batch_id, type, content, tags, created_at, duration, memory_usage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((entries2) => {
      for (const entry of entries2) {
        stmt.run(
          entry.id,
          entry.batchId,
          entry.type,
          JSON.stringify(entry.content),
          JSON.stringify(entry.tags),
          entry.createdAt.toISOString(),
          entry.duration ?? null,
          entry.memoryUsage ?? null
        );
      }
    });
    insertMany(entries);
  }
  async find(id) {
    const row = this.db.prepare("SELECT * FROM entries WHERE id = ?").get(id);
    if (!row) return null;
    return this.rowToEntry(row);
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
      params.push(before.toISOString());
    }
    if (after) {
      where += " AND created_at > ?";
      params.push(after.toISOString());
    }
    if (search) {
      where += " AND content LIKE ?";
      params.push(`%${search}%`);
    }
    const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM entries WHERE ${where}`).get(...params);
    const total = countRow.count;
    const rows = this.db.prepare(
      `SELECT * FROM entries WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);
    const data = rows.map((row) => this.rowToEntry(row));
    let filteredData = data;
    if (tags && tags.length > 0) {
      filteredData = data.filter((e) => tags.some((t) => e.tags.includes(t)));
    }
    return {
      data: filteredData,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }
  async findByBatch(batchId) {
    const rows = this.db.prepare("SELECT * FROM entries WHERE batch_id = ? ORDER BY created_at ASC").all(batchId);
    return rows.map((row) => this.rowToEntry(row));
  }
  async prune(beforeDate) {
    const result = this.db.prepare("DELETE FROM entries WHERE created_at < ?").run(beforeDate.toISOString());
    return result.changes;
  }
  async clear() {
    this.db.prepare("DELETE FROM entries").run();
  }
  async stats() {
    const entriesByType = defaultEntryCounts();
    const typeRows = this.db.prepare("SELECT type, COUNT(*) as count FROM entries GROUP BY type").all();
    for (const row of typeRows) {
      entriesByType[row.type] = row.count;
    }
    const totalRow = this.db.prepare("SELECT COUNT(*) as count FROM entries").get();
    const oldestRow = this.db.prepare("SELECT MIN(created_at) as oldest FROM entries").get();
    const newestRow = this.db.prepare("SELECT MAX(created_at) as newest FROM entries").get();
    return {
      totalEntries: totalRow.count,
      entriesByType,
      oldestEntry: oldestRow.oldest ? new Date(oldestRow.oldest) : void 0,
      newestEntry: newestRow.newest ? new Date(newestRow.newest) : void 0
    };
  }
  async close() {
    this.db.close();
  }
  rowToEntry(row) {
    return {
      id: row.id,
      batchId: row.batch_id,
      type: row.type,
      content: JSON.parse(row.content),
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.created_at),
      duration: row.duration ?? void 0,
      memoryUsage: row.memory_usage ?? void 0
    };
  }
};

export {
  SQLiteStorage
};
