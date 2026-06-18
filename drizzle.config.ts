import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config — `npm run db:generate` / `db:migrate` / `db:studio`.
 * Foundation stub: points at the (empty) schema and the Supabase Postgres URL.
 */
export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
