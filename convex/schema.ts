import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Shared vocabulary: every surface (prefs form, scraper normalization, matcher)
// speaks these exact unions, so an illegal coat/age can't enter the system.
export const coatValidator = v.union(
  v.literal("short"),
  v.literal("medium"),
  v.literal("long"),
  v.literal("hairless"),
  v.literal("unknown"),
);

export const ageValidator = v.union(
  v.literal("kitten"),
  v.literal("young"),
  v.literal("adult"),
  v.literal("senior"),
  v.literal("unknown"),
);

export const sourceValidator = v.union(
  v.literal("petsmart"),
  v.literal("petfinder"),
);

export default defineSchema({
  ...authTables,

  // A user's saved preferences. One active watcher per user in v0.
  watchers: defineTable({
    userId: v.id("users"),
    email: v.string(),
    zip: v.string(),
    maxMiles: v.number(),
    coats: v.array(coatValidator),
    ages: v.array(ageValidator),
    active: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_active", ["active"]),

  // A cat seen at a source. (source, externalId) is the identity key,
  // making ingest upserts idempotent across repeated runs.
  listings: defineTable({
    source: sourceValidator,
    externalId: v.string(),
    url: v.string(),
    name: v.string(),
    coat: coatValidator,
    age: ageValidator,
    breed: v.optional(v.string()),
    zip: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    status: v.union(v.literal("available"), v.literal("removed")),
    lastSeenAt: v.number(),
  })
    .index("by_source_externalId", ["source", "externalId"])
    .index("by_status", ["status"]),

  // A watcher/listing pair the matcher accepted. by_watcher_listing makes
  // match creation idempotent: re-running the matcher never duplicates rows.
  matches: defineTable({
    watcherId: v.id("watchers"),
    listingId: v.id("listings"),
    score: v.number(),
    reasons: v.array(v.string()),
    scoredBy: v.union(v.literal("rules"), v.literal("llm")),
  })
    .index("by_watcher", ["watcherId"])
    .index("by_watcher_listing", ["watcherId", "listingId"]),

  // One email (real AgentMail or logged outbox) per match.
  alerts: defineTable({
    matchId: v.id("matches"),
    watcherId: v.id("watchers"),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    provider: v.union(v.literal("agentmail"), v.literal("outbox")),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_match", ["matchId"])
    .index("by_watcher", ["watcherId"]),

  // Audit trail for each scrape/fixture run.
  ingestRuns: defineTable({
    source: sourceValidator,
    mode: v.union(v.literal("live"), v.literal("fixture")),
    status: v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    listingsFound: v.number(),
    listingsNew: v.number(),
    listingsUpdated: v.number(),
    error: v.optional(v.string()),
  }).index("by_source", ["source"]),
});
