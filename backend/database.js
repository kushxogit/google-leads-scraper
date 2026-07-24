const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "data.db");
const schemaPath = path.join(__dirname, "schema.sql");

const db = new Database(dbPath);

// Initialize schema
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

const jobColumns = new Set(
  db
    .prepare("PRAGMA table_info(scrape_jobs)")
    .all()
    .map((column) => column.name),
);
if (!jobColumns.has("workspace_id"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN workspace_id TEXT");
if (!jobColumns.has("created_by"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN created_by TEXT");
if (!jobColumns.has("supabase_url"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN supabase_url TEXT");
if (!jobColumns.has("supabase_key"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN supabase_key TEXT");
if (!jobColumns.has("exclude_website"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN exclude_website INTEGER DEFAULT 0");
if (!jobColumns.has("reviewed_at"))
  db.exec("ALTER TABLE scrape_jobs ADD COLUMN reviewed_at TEXT");

db.pragma("journal_mode = WAL");

module.exports = db;
