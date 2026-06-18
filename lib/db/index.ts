import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle ORM client over the Supabase Postgres connection (`DATABASE_URL`).
 *
 * Foundation stub: the connection is wired but the schema is empty. Lazily
 * created so importing this module never opens a socket at build time.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}
