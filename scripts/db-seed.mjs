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

async function seed() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database for seeding.");

    const workspacesRes = await client.query("select id, name, created_by from public.workspaces;");
    const workspaces = workspacesRes.rows;

    if (workspaces.length === 0) {
      console.log("No workspaces found. Create a workspace first.");
      return;
    }

    console.log(`Found ${workspaces.length} workspace(s). Seeding acquisition & client collection data...`);

    const now = new Date();
    const todayIso = now.toISOString();
    const tomorrowIso = new Date(Date.now() + 86400000).toISOString();
    const yesterdayIso = new Date(Date.now() - 86400000).toISOString();
    const inThreeDaysIso = new Date(Date.now() + 3 * 86400000).toISOString();
    const lastWeekIso = new Date(Date.now() - 7 * 86400000).toISOString();

    for (const ws of workspaces) {
      const wsId = ws.id;
      const ownerId = ws.created_by;

      console.log(`\n--- Seeding workspace: "${ws.name}" (${wsId}) ---`);

      // -------------------------------------------------------------
      // 1. LEADS / CLIENTS
      // -------------------------------------------------------------
      let leadRes = await client.query("select id, name from public.leads where workspace_id = $1 limit 10;", [wsId]);

      if (leadRes.rows.length === 0) {
        console.log("Seeding sample client leads...");
        const sampleLeadsData = [
          {
            name: "Apex Global Tech",
            company: "Apex Global Inc",
            email: "contact@apexglobal.tech",
            phone: "+1-415-555-0192",
            website: "https://apexglobal.tech",
            required_service: "Custom B2B Lead Scraper & CRM Integration",
            project_value: 125000,
            status: "qualified",
            payment_status: "pending",
            pending_feedback: true,
            next_follow_up_at: todayIso,
            last_conversation_at: yesterdayIso,
            important_notes: "Needs automated proxy rotation and webhooks to sync leads directly to HubSpot.",
            source: "LinkedIn Outreach",
          },
          {
            name: "Dr. Anand CA Advisors",
            company: "Anand & Associates",
            email: "anand@caadvisors.in",
            phone: "+91-98765-43210",
            website: "https://caadvisors.in",
            required_service: "Full-Stack Web Portal & Supabase RLS",
            project_value: 85000,
            status: "proposal",
            payment_status: "partial",
            pending_feedback: false,
            next_follow_up_at: tomorrowIso,
            last_conversation_at: yesterdayIso,
            important_notes: "Client reviewed initial UI wireframes. Waiting on final sign-off for backend retainer.",
            source: "Referral",
          },
          {
            name: "Suvidha Healthcare",
            company: "Suvidha Health Pvt Ltd",
            email: "info@suvidhahealth.org",
            phone: "+91-99887-76655",
            website: "https://suvidhahealth.org",
            required_service: "Local SEO Audit & Automated Booking System",
            project_value: 60000,
            status: "won",
            payment_status: "paid",
            pending_feedback: true,
            next_follow_up_at: inThreeDaysIso,
            last_conversation_at: lastWeekIso,
            important_notes: "Phase 1 delivered successfully. Client requested testimonial for website.",
            source: "Google Search",
          },
          {
            name: "Zenith Creative Agency",
            company: "Zenith Media",
            email: "hello@zenithdesign.io",
            phone: "+1-212-555-0148",
            website: "https://zenithdesign.io",
            required_service: "Next.js UI & Webflow Migration",
            project_value: 150000,
            status: "new",
            payment_status: "not_set",
            pending_feedback: false,
            next_follow_up_at: todayIso,
            last_conversation_at: null,
            important_notes: "Inbound inquiry from Freelancer profile. Looking for interactive dashboard development.",
            source: "Freelancer.com",
          },
        ];

        for (const ld of sampleLeadsData) {
          await client.query(
            `insert into public.leads (
              workspace_id, name, company, email, phone, website, required_service,
              project_value, status, payment_status, pending_feedback, next_follow_up_at,
              last_conversation_at, important_notes, source, created_by
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
            [
              wsId, ld.name, ld.company, ld.email, ld.phone, ld.website, ld.required_service,
              ld.project_value, ld.status, ld.payment_status, ld.pending_feedback, ld.next_follow_up_at,
              ld.last_conversation_at, ld.important_notes, ld.source, ownerId
            ]
          );
        }
        console.log("✔ Created 4 sample leads for workspace.");
        leadRes = await client.query("select id, name from public.leads where workspace_id = $1 limit 10;", [wsId]);
      } else {
        // Update existing leads with rich client fields if they don't have them
        console.log(`Updating ${leadRes.rows.length} existing lead(s) with rich client fields...`);
        for (let i = 0; i < leadRes.rows.length; i++) {
          const l = leadRes.rows[i];
          const services = [
            "Full-Stack Web App Development",
            "Supabase Backend & Postgres Migration",
            "SEO & Google Maps Scraper Pipeline",
            "UI/UX Design & Branding",
            "Workflow Automation & Webhooks",
          ];
          const service = services[i % services.length];
          const val = (i + 1) * 45000;
          const paymentStatuses = ["pending", "partial", "paid", "not_set"];
          const payStat = paymentStatuses[i % paymentStatuses.length];

          await client.query(
            `update public.leads set
              website = coalesce(website, $1),
              required_service = coalesce(required_service, $2),
              project_value = coalesce(project_value, $3),
              payment_status = case when payment_status = 'not_set' then $4 else payment_status end,
              next_follow_up_at = coalesce(next_follow_up_at, $5),
              last_conversation_at = coalesce(last_conversation_at, $6),
              pending_feedback = coalesce(pending_feedback, $7)
            where id = $8;`,
            [
              `https://${l.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "client"}.com`,
              service,
              val,
              payStat,
              i % 2 === 0 ? todayIso : tomorrowIso,
              yesterdayIso,
              i % 3 === 0,
              l.id,
            ]
          );
        }
        console.log("✔ Enriched existing leads with acquisition fields.");
      }

      const leadsList = leadRes.rows;
      const primaryLead = leadsList[0];

      // -------------------------------------------------------------
      // 2. LEAD INTERACTIONS (`lead_interactions`)
      // -------------------------------------------------------------
      const existingInteractions = await client.query(
        "select count(*) from public.lead_interactions where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingInteractions.rows[0].count, 10) === 0 && primaryLead) {
        console.log("Seeding lead interactions...");
        const interRes = await client.query(
          `insert into public.lead_interactions (
            lead_id, workspace_id, author_id, raw_note, channel, summary, outcome,
            next_step, follow_up_date, feedback_status, payment_status, service,
            suggested_status, processing_status, processed_at
          ) values
          ($1, $2, $3, 'Had a 30-minute discovery call regarding their automated lead scraper needs. Client confirmed budget of ₹1,25,000.', 'call', 'Discovery Call - Scraper Project', 'Client agreed to move forward to proposal.', 'Send statement of work and retainer invoice.', $4, 'pending', 'pending', 'Custom B2B Lead Scraper', 'qualified', 'applied', now())
          returning id;`,
          [primaryLead.id, wsId, ownerId, tomorrowIso]
        );

        await client.query(
          `insert into public.interaction_processing_jobs (
            interaction_id, lead_id, workspace_id, status, attempts, completed_at
          ) values ($1, $2, $3, 'applied', 1, now());`,
          [interRes.rows[0].id, primaryLead.id, wsId]
        );
        console.log("✔ Created initial lead interaction log.");
      }

      // -------------------------------------------------------------
      // 3. ACQUISITION PROFILES (`acquisition_profiles`)
      // -------------------------------------------------------------
      const existingProfiles = await client.query(
        "select count(*) from public.acquisition_profiles where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingProfiles.rows[0].count, 10) === 0) {
        console.log("Seeding acquisition profiles (Freelancer, LinkedIn, Instagram)...");
        await client.query(
          `insert into public.acquisition_profiles (workspace_id, platform, positioning, services, proof, trust_signals, profile_url, updated_by)
           values
           ($1, 'freelancer', 'Full-Stack Developer & Supabase / Automation Specialist', 'Next.js, Node.js, Supabase, Postgres, Web Scraping', '25+ high-rating SaaS & Lead Scraper deliverables', 'Top Rated Freelancer, 100% On-Time Delivery', 'https://freelancer.com/u/leadpilot-dev', $2),
           ($1, 'linkedin', 'Helping B2B agencies automate lead generation & build bespoke web platforms', 'Google Maps Scrapers, Custom CRMs, Web App Architecture', 'Case Study: 10,000+ targeted local leads delivered with 99.4% uptime', 'Featured in Tech Weekly, 5k+ B2B Founder Connections', 'https://linkedin.com/in/leadpilot-hq', $2),
           ($1, 'instagram', 'Building high-ticket web products, automated workflows & UI tear-downs', 'Web App Design, UI/UX Systems, Modern Web Development', 'Visual showcases of modern dashboard UIs & scrapers', '10k+ Developer Community', 'https://instagram.com/devstudio.build', $2)
           on conflict (workspace_id, platform) do update set
             positioning = excluded.positioning,
             services = excluded.services,
             proof = excluded.proof,
             trust_signals = excluded.trust_signals,
             profile_url = excluded.profile_url;`,
          [wsId, ownerId]
        );
        console.log("✔ Created 3 acquisition profile entries.");
      }

      // -------------------------------------------------------------
      // 4. PROOF LIBRARY (`proof_library`)
      // -------------------------------------------------------------
      const existingProof = await client.query(
        "select count(*) from public.proof_library where workspace_id = $1;",
        [wsId]
      );

      let proofId = null;
      if (parseInt(existingProof.rows[0].count, 10) === 0) {
        console.log("Seeding proof library...");
        const proofRes = await client.query(
          `insert into public.proof_library (workspace_id, title, proof_type, summary, asset_url, created_by)
           values
           ($1, 'Google Maps B2B Scraping & Lead Enrichment Pipeline', 'automation', 'Built an automated pipeline extracting 10,000+ local leads with instant phone/email verification and zero IP bans.', 'https://github.com/example/lead-scraper-case-study', $2),
           ($1, 'High-Converting SaaS Landing Page & Supabase Backend', 'completed_work', 'Redesigned landing page and engineered Supabase backend with Row Level Security, boosting conversions by 140%.', 'https://example.com/case-studies/saas-redesign', $2),
           ($1, 'Local SEO & Performance Audit for Medical Clinic', 'audit', 'Detailed 20-page technical audit fixing local schema markup gaps and increasing map pack views by 85%.', 'https://example.com/audits/clinic-seo', $2)
           returning id;`,
          [wsId, ownerId]
        );
        proofId = proofRes.rows[0]?.id || null;
        console.log("✔ Created 3 proof library items.");
      } else {
        const pr = await client.query("select id from public.proof_library where workspace_id = $1 limit 1;", [wsId]);
        proofId = pr.rows[0]?.id || null;
      }

      // -------------------------------------------------------------
      // 5. CONTENT ITEMS (`content_items`)
      // -------------------------------------------------------------
      const existingContent = await client.query(
        "select count(*) from public.content_items where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingContent.rows[0].count, 10) === 0) {
        console.log("Seeding content draft queue...");
        await client.query(
          `insert into public.content_items (workspace_id, platform, title, draft, proof_asset_id, cta, status, created_by)
           values
           ($1, 'linkedin', 'How we extracted 10,000 verified leads without getting blocked', 'Most lead scrapers fail because of static user agents and poor concurrency management.\n\nHere is how we built a resilient proxy rotator with Playwright and Supabase:\n1. Rotating residential proxy pool\n2. Smart DOM selector fallbacks\n3. Instant DB sync via PostgREST', $2, 'DM "SCRAPER" for the full open-source code architecture.', 'ready', $3),
           ($1, 'instagram', '3 Common Supabase RLS Mistakes That Slow Down Your App', 'Slide 1: Missing index on workspace_id\nSlide 2: Calling non-STABLE functions inside RLS policy check\nSlide 3: Deep nested subqueries in row filters', $2, 'Save this post for your next project build!', 'draft', $3),
           ($1, 'freelancer', 'Custom B2B CRM & Lead Pipeline Proposal Template', 'Hi there! Reviewed your requirements for building a custom lead outreach CRM. Having built similar platforms using Supabase, Node, and React, I can deliver a prototype in 5 days.', null, 'Schedule a 10-min intro call to see a live demo.', 'ready', $3);`,
          [wsId, proofId, ownerId]
        );
        console.log("✔ Created 3 content draft items.");
      }

      // -------------------------------------------------------------
      // 6. RELATIONSHIP CONTACTS (`relationship_contacts`)
      // -------------------------------------------------------------
      const existingContacts = await client.query(
        "select count(*) from public.relationship_contacts where workspace_id = $1;",
        [wsId]
      );

      let relId = null;
      if (parseInt(existingContacts.rows[0].count, 10) === 0) {
        console.log("Seeding relationship contacts...");
        const relRes = await client.query(
          `insert into public.relationship_contacts (workspace_id, contact_name, company, channel, relationship_stage, next_touch_at, notes, created_by)
           values
           ($1, 'Sarah Jenkins', 'Apex Marketing Agency', 'LinkedIn', 'warm', $2, 'Agency founder looking to outsource custom scraper builds for real estate clients.', $3),
           ($1, 'Rahul Mehta', 'SaaS Growth Labs', 'Twitter / X', 'active', $2, 'Interested in co-hosting a webinar on automated B2B lead enrichment.', $3),
           ($1, 'David Chen', 'DevStudio Ventures', 'Referral', 'partner', $2, 'Angel investor referring early-stage founders needing web MVPs.', $3)
           returning id;`,
          [wsId, tomorrowIso, ownerId]
        );
        relId = relRes.rows[0]?.id || null;
        console.log("✔ Created 3 relationship contacts.");
      } else {
        const rc = await client.query("select id from public.relationship_contacts where workspace_id = $1 limit 1;", [wsId]);
        relId = rc.rows[0]?.id || null;
      }

      // -------------------------------------------------------------
      // 7. OUTREACH QUEUE (`outreach_queue`)
      // -------------------------------------------------------------
      const existingOutreach = await client.query(
        "select count(*) from public.outreach_queue where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingOutreach.rows[0].count, 10) === 0) {
        console.log("Seeding outreach queue...");
        await client.query(
          `insert into public.outreach_queue (workspace_id, lead_id, relationship_id, channel, message_draft, status, next_action_at, created_by)
           values
           ($1, $2, null, 'email', 'Hi Apex team,\n\nFollowing up on our discovery call yesterday regarding the custom lead scraper pipeline. I attached our proposed scope document and milestone breakdown.\n\nLet me know if 3pm tomorrow works for a short review call!', 'ready', $3, $4),
           ($1, null, $5, 'linkedin', 'Hi Sarah, loved your recent post on expanding Apex Marketing''s lead acquisition services! We just shipped an automated lead scraper pipeline for B2B agencies. Would love to send over a 2-min demo if you are open to it?', 'draft', $3, $4);`,
          [wsId, primaryLead ? primaryLead.id : null, tomorrowIso, ownerId, relId]
        );
        console.log("✔ Created 2 personalized outreach queue items.");
      }

      // -------------------------------------------------------------
      // 8. WORKSPACE NOTES (`workspace_notes` & `workspace_note_lines`)
      // -------------------------------------------------------------
      const existingNotes = await client.query(
        "select count(*) from public.workspace_notes where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingNotes.rows[0].count, 10) === 0) {
        console.log("Creating default starter notes for workspace...");
        const noteRes = await client.query(
          `insert into public.workspace_notes (workspace_id, owner_id, visibility, title, body, color, is_pinned)
           values ($1, $2, 'shared', 'Welcome to Acquisition & Leads Hub', 'Use this workspace to track outreach, manage active client lifecycles, and store project proof.', 'mint', true)
           returning id;`,
          [wsId, ownerId]
        );

        const noteId = noteRes.rows[0].id;
        await client.query(
          `insert into public.workspace_note_lines (note_id, workspace_id, created_by, body, line_order)
           values
             ($1, $2, $3, 'Review upcoming client follow-up list', 0),
             ($1, $2, $3, 'Publish latest case study on LinkedIn', 1),
             ($1, $2, $3, 'Send proposal to Dr. Anand CA Advisors', 2);`,
          [noteId, wsId, ownerId]
        );
        console.log("✔ Created starter notes.");
      }

      // -------------------------------------------------------------
      // 9. TASKS (`tasks`)
      // -------------------------------------------------------------
      const existingTasks = await client.query(
        "select count(*) from public.tasks where workspace_id = $1;",
        [wsId]
      );

      if (parseInt(existingTasks.rows[0].count, 10) === 0) {
        console.log("Seeding workspace tasks...");
        await client.query(
          `insert into public.tasks (
            workspace_id, lead_id, title, description, category, priority, status, scheduled_start, created_by
          ) values
          ($1, $2, 'Send technical scope & proposal to Apex Global', 'Finalize scope doc for B2B scraper architecture.', 'proposal', 'high', 'in_progress', $3, $4),
          ($1, $2, 'Follow up with Dr. Anand on retainer sign-off', 'Check if wireframe feedback was incorporated.', 'follow_up', 'medium', 'planned', $3, $4),
          ($1, null, 'Publish Google Maps scraper case study', 'Post carousel on LinkedIn and Freelancer portfolio.', 'development', 'high', 'planned', $3, $4);`,
          [wsId, primaryLead ? primaryLead.id : null, todayIso, ownerId]
        );
        console.log("✔ Created 3 sample tasks.");
      }
    }

    console.log("\nReloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✔ Sent 'NOTIFY pgrst, reload schema' to PostgREST.");

    console.log("\nDatabase seed completed successfully for all collections!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
