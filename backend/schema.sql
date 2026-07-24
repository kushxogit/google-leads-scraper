CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  business_name TEXT NOT NULL,
  niche TEXT,
  area TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,

  rating REAL,
  reviews INTEGER,

  source TEXT,
  source_url TEXT,

  score INTEGER DEFAULT 0,
  score_breakdown TEXT,
  recommended_offer TEXT,

  status TEXT DEFAULT 'new',
  called INTEGER DEFAULT 0,
  follow_up_date TEXT,
  remarks TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  query TEXT NOT NULL,
  niche TEXT,
  area TEXT,
  source TEXT,
  lead_limit INTEGER DEFAULT 50,
  headless INTEGER DEFAULT 0,
  exclude_website INTEGER DEFAULT 0,
  workspace_id TEXT,
  created_by TEXT,
  supabase_url TEXT,
  supabase_key TEXT,

  status TEXT DEFAULT 'queued',

  found_count INTEGER DEFAULT 0,
  saved_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,

  error_message TEXT,

  reviewed_at TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  lead_id INTEGER NOT NULL,
  type TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
