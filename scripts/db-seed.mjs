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

    // Check if there are any existing workspaces
    const workspaces = await client.query("select id, created_by from public.workspaces limit 5;");

    if (workspaces.rows.length === 0) {
      console.log("No workspaces found. Seed will execute when users create their first workspace.");
    } else {
      console.log(`Found ${workspaces.rows.length} existing workspace(s). Seeding default starter notes...`);

      for (const ws of workspaces.rows) {
        // Check if workspace already has notes
        const existingNotes = await client.query(
          "select count(*) from public.workspace_notes where workspace_id = $1;",
          [ws.id]
        );

        if (parseInt(existingNotes.rows[0].count, 10) === 0) {
          console.log(`Creating default starter notes for workspace ${ws.id}...`);

          const noteRes = await client.query(
            `insert into public.workspace_notes (workspace_id, owner_id, visibility, title, body, color, is_pinned)
             values ($1, $2, 'shared', 'Welcome to Notes Room', 'Use this room to capture ideas, collaborate with your team, and turn lines into actionable tasks.', 'mint', true)
             returning id;`,
            [ws.id, ws.created_by]
          );

          const noteId = noteRes.rows[0].id;

          await client.query(
            `insert into public.workspace_note_lines (note_id, workspace_id, created_by, body, line_order)
             values
               ($1, $2, $3, 'Review upcoming lead outreach list', 0),
               ($1, $2, $3, 'Schedule team alignment meeting', 1);`,
            [noteId, ws.id, ws.created_by]
          );

          console.log(`✔ Created starter note for workspace ${ws.id}`);
        }
      }
    }

    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✔ Sent 'NOTIFY pgrst, reload schema' to PostgREST.");

    console.log("\nDatabase seed completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
