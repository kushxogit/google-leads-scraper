const db = require("../database");
const { getScraper } = require("../scrapers");
const { normalizeLead } = require("./leadNormalizer");
const { scoreLead } = require("./leadScorer");
const { generateRecommendedOffer } = require("./recommendedOfferGenerator");
const { getJobAuth, forgetJobAuth } = require("./jobAuthStore");
const {
  loadLeadKeys,
  isKnownLead,
  addKeys,
  insertLead,
} = require("./supabasePipeline");

let isRunning = false;

async function runJobs() {
  if (isRunning) return;
  isRunning = true;
  let job;

  try {
    job = db
      .prepare("SELECT * FROM scrape_jobs WHERE status = ? LIMIT 1")
      .get("queued");
    if (!job) {
      isRunning = false;
      return; // No pending jobs
    }

    db.prepare(
      "UPDATE scrape_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(job.id);

    const scraper = getScraper(job.source);
    if (!scraper) {
      throw new Error(`Scraper for source '${job.source}' not found.`);
    }

    let foundCount = 0;
    let savedCount = 0;
    let duplicateCount = 0;
    const logs = [];
    const token = getJobAuth(job.id);
    if (!token || !job.workspace_id || !job.supabase_url)
      throw new Error(
        "This job lost its authenticated workspace session. Launch it again.",
      );
    const leadKeys = await loadLeadKeys(job, token);

    const onLog = (message) => {
      console.log(`[Job ${job.id}] ${message}`);
      logs.push(message);
    };

    const onLead = async (rawLead) => {
      foundCount++;
      const normalized = normalizeLead(rawLead);

      if (isKnownLead(leadKeys, normalized)) {
        duplicateCount++;
        onLog(`Duplicate skipped: ${normalized.businessName}`);
        return;
      }

      const { score, scoreBreakdown } = scoreLead(normalized);
      const recommendedOffer = generateRecommendedOffer(normalized);

      await insertLead(
        job,
        token,
        normalized,
        score,
        scoreBreakdown,
        recommendedOffer,
      );
      addKeys(leadKeys, normalized);

      savedCount++;

      // Update job progress
      db.prepare(
        `
        UPDATE scrape_jobs 
        SET found_count = ?, saved_count = ?, duplicate_count = ? 
        WHERE id = ?
      `,
      ).run(foundCount, savedCount, duplicateCount, job.id);
    };

    try {
      await scraper.scrape({
        query: job.query,
        niche: job.niche,
        area: job.area,
        limit: job.lead_limit,
        headless: job.headless,
        onLead,
        onLog,
      });

      db.prepare(
        `
        UPDATE scrape_jobs 
        SET status = 'completed', finished_at = CURRENT_TIMESTAMP, error_message = ? 
        WHERE id = ?
      `,
      ).run(logs.slice(-5).join(" | "), job.id); // store last few logs in error_message as a debug trail for now
      forgetJobAuth(job.id);
    } catch (err) {
      db.prepare(
        `
        UPDATE scrape_jobs 
        SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ? 
        WHERE id = ?
      `,
      ).run(err.message, job.id);
      forgetJobAuth(job.id);
    }
  } catch (globalErr) {
    console.error("Job runner error:", globalErr);
    if (job?.id) {
      db.prepare(
        "UPDATE scrape_jobs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
      ).run(globalErr.message, job.id);
      forgetJobAuth(job.id);
    }
  } finally {
    isRunning = false;
    // Check for next job
    setTimeout(runJobs, 5000);
  }
}

// Start polling
setInterval(runJobs, 10000);

module.exports = { runJobs };
