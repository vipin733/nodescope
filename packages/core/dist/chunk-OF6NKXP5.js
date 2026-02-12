// src/storage/adapter.ts
async function createStorageAdapter(driver, options) {
  switch (driver) {
    case "memory":
      const { MemoryStorage } = await import("./memory-5GF7O2HJ.js");
      return new MemoryStorage();
    case "sqlite":
      const { SQLiteStorage } = await import("./sqlite-DMOIPBIO.js");
      return new SQLiteStorage(options?.databaseUrl || "./nodescope.db");
    case "postgresql":
      const { PostgreSQLStorage } = await import("./postgresql-XD7N5SFI.js");
      if (!options?.databaseUrl) {
        throw new Error("PostgreSQL requires a databaseUrl");
      }
      return new PostgreSQLStorage(options.databaseUrl);
    case "mysql":
      const { MySQLStorage } = await import("./mysql-KNBA3N7P.js");
      if (!options?.databaseUrl) {
        throw new Error("MySQL requires a databaseUrl");
      }
      return new MySQLStorage(options.databaseUrl);
    default:
      throw new Error(`Unknown storage driver: ${driver}`);
  }
}
function defaultEntryCounts() {
  return {
    request: 0,
    query: 0,
    cache: 0,
    log: 0,
    exception: 0,
    http_client: 0,
    event: 0,
    job: 0,
    schedule: 0,
    dump: 0
  };
}

export {
  createStorageAdapter,
  defaultEntryCounts
};
