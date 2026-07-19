const express = require("express");
const db = require("../database");
const { runJobs } = require("../services/scrapeJobRunner");
const { rememberJobAuth } = require("../services/jobAuthStore");
const {
  getUser,
  verifyWorkspace,
  safeSupabaseUrl,
} = require("../services/supabasePipeline");

const router = express.Router();
const publicColumns = `
  id, query, niche, area, source, lead_limit, headless, status,
  found_count, saved_count, duplicate_count, error_message,
  created_at, started_at, finished_at
`;

router.get("/", async (req, res) => {
  try {
    const auth = await authorize(req, req.query.workspace_id);
    const jobs = db
      .prepare(
        `SELECT ${publicColumns} FROM scrape_jobs WHERE workspace_id = ? ORDER BY created_at DESC`,
      )
      .all(auth.workspaceId);
    res.json(jobs);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      query,
      niche,
      area,
      source,
      limit,
      headless,
      workspace_id: workspaceId,
    } = req.body;
    const auth = await authorize(req, workspaceId);
    if (!query?.trim() && !niche?.trim())
      throw new Error("Enter a search query or an industry.");
    const leadLimit = Math.max(1, Math.min(100, Number(limit) || 50));
    const insert = db.prepare(`
      INSERT INTO scrape_jobs
        (query, niche, area, source, lead_limit, headless, workspace_id, created_by, supabase_url, supabase_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const niches = split(niche, [""]);
    const areas = split(area, [""]);
    const queries = split(query, []);
    const jobIds = [];

    db.transaction(() => {
      if (
        queries.length > 0 &&
        niches.length === 1 &&
        areas.length === 1 &&
        !niches[0] &&
        !areas[0]
      ) {
        queries.forEach((item) => {
          const result = insert.run(
            item,
            "",
            "",
            source || "Google Maps",
            leadLimit,
            headless ? 1 : 0,
            auth.workspaceId,
            auth.user.id,
            auth.supabaseUrl,
            auth.apiKey,
          );
          jobIds.push(result.lastInsertRowid);
        });
        return;
      }

      niches.forEach((currentNiche) => {
        areas.forEach((currentArea) => {
          const dynamicQuery = `${currentNiche} in ${currentArea}`.trim();
          const finalQuery =
            queries.length === 1 && niches.length === 1 && areas.length === 1
              ? queries[0]
              : dynamicQuery;
          const result = insert.run(
            finalQuery,
            currentNiche,
            currentArea,
            source || "Google Maps",
            leadLimit,
            headless ? 1 : 0,
            auth.workspaceId,
            auth.user.id,
            auth.supabaseUrl,
            auth.apiKey,
          );
          jobIds.push(result.lastInsertRowid);
        });
      });
    })();

    rememberJobAuth(jobIds, auth.token);
    void runJobs();
    res.json({
      success: true,
      jobId: jobIds[0],
      jobsInserted: jobIds.length,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const job = db
      .prepare(
        `SELECT ${publicColumns}, workspace_id FROM scrape_jobs WHERE id = ?`,
      )
      .get(req.params.id);
    if (!job) return res.status(404).json({ error: "Not found" });
    await authorize(req, job.workspace_id);
    delete job.workspace_id;
    return res.json(job);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

async function authorize(req, workspaceId) {
  const token = bearer(req);
  const supabaseUrl = safeSupabaseUrl(
    req.headers["x-supabase-url"] ||
      req.body?.supabase_url ||
      req.query.supabase_url,
  );
  const apiKey =
    req.headers["x-supabase-key"] ||
    req.body?.supabase_key ||
    req.query.supabase_key;
  if (!workspaceId || !apiKey)
    throw new Error("Workspace configuration is missing.");
  const user = await getUser(supabaseUrl, token, apiKey);
  await verifyWorkspace(supabaseUrl, token, apiKey, workspaceId, user.id);
  return { token, supabaseUrl, apiKey, workspaceId, user };
}

function bearer(req) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) throw new Error("Sign in is required.");
  return value.slice(7);
}

function split(value, fallback) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

module.exports = router;
