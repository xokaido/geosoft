# Cloudflare Infrastructure Setup — Step-by-Step Prompt

> Use this prompt with Claude or any AI assistant to get exact CLI commands for setting up the Cloudflare infrastructure before deploying the app.

---

## Prompt

I need to set up the following Cloudflare infrastructure for a Worker-based AI chat application. Give me the exact `wrangler` CLI commands for each step, and show me what to copy into `wrangler.toml` after each step.

### Steps needed:

1. **Create a D1 database** named `geosoft-chat-db`
   - Show the command to create it
   - Show how to run the migration file located at `worker/migrations/0001_init.sql`
   - Show the database ID output and where to paste it in `wrangler.toml`

2. **Confirm R2 bucket** named `geosoft` exists (or create it if not)
   - Show the command to list existing buckets
   - Show the command to create `geosoft` if it doesn't exist
   - Show the correct `wrangler.toml` binding block

3. **Create a Vectorize index** named `geosoft-rag`
   - Dimensions: 768
   - Metric: cosine
   - Show the create command
   - Show the correct `wrangler.toml` binding block

4. **Set secrets** (not vars) for sensitive values:
   - `AUTH_PASSWORD`
   - `SESSION_SECRET`
   - Show the `wrangler secret put` commands for each

5. **Verify everything is connected**
   - Show how to run `wrangler dev` and confirm all bindings are detected

### Context:
- I have Wrangler CLI installed and am logged in (`wrangler login` already done)
- Node.js 20+
- The project root has a `wrangler.toml` already scaffolded
- Account is on the Cloudflare Workers Paid plan (required for D1, Vectorize, AI)

Please provide all commands in order, with brief explanations for each.
