/**
 * Drizzle schema — intentionally empty for this pass.
 *
 * The wider Counder Connect product (profiles, events + sessions, chat,
 * matchmaking, notifications) will define its tables here. Example shape to
 * grow into:
 *
 *   export const profiles = pgTable("profiles", {
 *     id: uuid("id").primaryKey().defaultRandom(),
 *     userId: uuid("user_id").notNull(),      // → auth.users.id (Supabase)
 *     displayName: text("display_name"),
 *     headline: text("headline"),             // "Family office principal · São Paulo"
 *     country: text("country"),
 *     createdAt: timestamp("created_at").defaultNow(),
 *   });
 *
 * TODO: define real tables, then `npm run db:generate && npm run db:migrate`.
 */
export {};
