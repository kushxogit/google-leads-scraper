import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.supabase.local" });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("Error: SUPABASE_DB_URL is not set in .env.supabase.local or environment.");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database.");

    // Create schema_migrations table if not exists
    await client.query(`
      create table if not exists public.schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    // Check which tables exist in public schema
    const tablesRes = await client.query(`
      select tablename from pg_tables where schemaname = 'public';
    `);
    const existingTables = new Set(tablesRes.rows.map((r) => r.tablename));
    console.log("Existing tables in public schema:", Array.from(existingTables).sort().join(", "));

    // Check already recorded migrations
    const appliedRes = await client.query(`select filename from public.schema_migrations;`);
    const appliedFiles = new Set(appliedRes.rows.map((r) => r.filename));

    // Heuristic: If core CRM tables exist, consider earlier migrations applied
    if (existingTables.has("workspaces") && existingTables.has("leads")) {
      appliedFiles.add("202607190001_initial_multitenant_crm.sql");
      appliedFiles.add("202607190002_collaboration_helpers.sql");
      appliedFiles.add("202607190003_create_workspace_rpc.sql");
    }
    if (existingTables.has("tasks")) {
      appliedFiles.add("202607200001_rewind_tasks.sql");
    }
    if (existingTables.has("workspace_notes")) {
      appliedFiles.add("202607220001_workspace_notes.sql");
    }

    // Record previously applied migrations in schema_migrations
    for (const file of appliedFiles) {
      await client.query(
        `insert into public.schema_migrations (filename) values ($1) on conflict (filename) do nothing;`,
        [file]
      );
    }

    const migrationsDir = path.resolve("supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`[SKIP] Migration already applied: ${file}`);
        continue;
      }

      console.log(`\nApplying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");
      await client.query(sql);
      await client.query(
        `insert into public.schema_migrations (filename) values ($1) on conflict (filename) do nothing;`,
        [file]
      );
      console.log(`✔ Successfully applied: ${file}`);
    }

    console.log("\nReloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✔ Sent 'NOTIFY pgrst, reload schema' to PostgREST.");

    console.log("\nAll pending migrations applied & schema cache reloaded!");
  } catch (error) {
    console.error("Migration execution failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
