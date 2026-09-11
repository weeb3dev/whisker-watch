import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { sourceValidator } from "./schema";
import { FIXTURES, type RawListing } from "./fixtures";
import { ageFromText, coatFromText } from "./normalize";
import { zipInfo } from "./geo";

declare const process: { env: Record<string, string | undefined> };

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

// Exact scrape targets. PetSmart's adoption finder renders results
// client-side after user input, so its live extraction usually comes back
// empty and the fixture fallback carries the demo (Alberto-approved).
const SCRAPE_TARGETS = {
  petfinder: (zip: string) => {
    const state = (zipInfo(zip)?.state ?? "ca").toLowerCase();
    return `https://www.petfinder.com/search/cats-for-adoption/us/${state}/${zip}/`;
  },
  petsmart: (_zip: string) => "https://www.petsmartcharities.org/adopt-a-pet",
} as const;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    cats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          breed: { type: "string" },
          age: { type: "string" },
          location: { type: "string", description: "City, ST if shown" },
          photoUrl: { type: "string" },
        },
        required: ["name", "url"],
      },
    },
  },
  required: ["cats"],
};

type ScrapedCat = {
  name: string;
  url: string;
  breed?: string;
  age?: string;
  location?: string;
  photoUrl?: string;
};

// Boundary guard: only URLs shaped like real adoption listings become
// Listings. The PetSmart page has no per-cat pages, so its live extraction
// (which picks up editorial success stories) is rejected here and ingest
// falls through to fixtures.
const LISTING_URL_PATTERNS = {
  petfinder: /\/cat\/[^/]+\//,
  petsmart: /\/pet\/[a-z0-9-]+/i,
} as const;

async function scrapeSource(
  source: "petsmart" | "petfinder",
  zip: string,
): Promise<RawListing[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const response = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      url: SCRAPE_TARGETS[source](zip),
      formats: [
        {
          type: "json",
          prompt:
            "Extract every adoptable cat visible on this page. Skip ads and navigation.",
          schema: EXTRACT_SCHEMA,
        },
      ],
      onlyMainContent: false,
      timeout: 90000,
    }),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    success: boolean;
    data?: { json?: { cats?: ScrapedCat[] } };
  };
  const cats = body.data?.json?.cats ?? [];
  return cats
    .filter(
      (cat) => cat.name && cat.url && LISTING_URL_PATTERNS[source].test(cat.url),
    )
    .map((cat) => ({
      // Petfinder detail URLs embed a stable slug: /cat/<slug>/...
      externalId: cat.url.match(/\/cat\/([^/]+)\//)?.[1] ?? cat.url,
      name: cat.name,
      url: cat.url,
      breed: cat.breed ?? "",
      age: cat.age ?? "",
      zip, // search page shows cats near the searched zip
      photoUrl: cat.photoUrl?.startsWith("http") ? cat.photoUrl : undefined,
    }));
}

export const run = action({
  args: { source: sourceValidator, zip: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    runId: Id<"ingestRuns">;
    mode: "live" | "fixture";
    found: number;
    newCount: number;
    updatedCount: number;
  }> => {
    const zip = args.zip ?? "94103";
    const runId: Id<"ingestRuns"> = await ctx.runMutation(
      internal.ingest.startRun,
      { source: args.source },
    );

    let raw: RawListing[] = [];
    let mode: "live" | "fixture" = "live";
    let scrapeError: string | undefined;
    try {
      raw = await scrapeSource(args.source, zip);
    } catch (error) {
      scrapeError = error instanceof Error ? error.message : String(error);
    }
    if (raw.length === 0) {
      mode = "fixture";
      raw = FIXTURES[args.source];
    }

    const listings = raw.map((item) => {
      const info = zipInfo(item.zip);
      return {
        source: args.source,
        externalId: item.externalId,
        url: item.url,
        name: item.name,
        coat: coatFromText(item.breed),
        age: ageFromText(item.age),
        breed: item.breed || undefined,
        zip: item.zip,
        lat: info?.lat,
        lng: info?.lng,
        city: info?.city,
        state: info?.state,
        photoUrl: item.photoUrl,
      };
    });

    const { newCount, updatedCount }: { newCount: number; updatedCount: number } =
      await ctx.runMutation(internal.ingest.upsertBatch, { listings });
    await ctx.runMutation(internal.ingest.finishRun, {
      runId,
      mode,
      status: "succeeded",
      listingsFound: raw.length,
      listingsNew: newCount,
      listingsUpdated: updatedCount,
      error: scrapeError,
    });
    return { runId, mode, found: raw.length, newCount, updatedCount };
  },
});

export const startRun = internalMutation({
  args: { source: sourceValidator },
  handler: async (ctx, { source }) => {
    return await ctx.db.insert("ingestRuns", {
      source,
      mode: "live",
      status: "running",
      startedAt: Date.now(),
      listingsFound: 0,
      listingsNew: 0,
      listingsUpdated: 0,
    });
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("ingestRuns"),
    mode: v.union(v.literal("live"), v.literal("fixture")),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    listingsFound: v.number(),
    listingsNew: v.number(),
    listingsUpdated: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, ...rest }) => {
    await ctx.db.patch(runId, { ...rest, finishedAt: Date.now() });
  },
});

const listingInput = v.object({
  source: sourceValidator,
  externalId: v.string(),
  url: v.string(),
  name: v.string(),
  coat: v.union(
    v.literal("short"), v.literal("medium"), v.literal("long"),
    v.literal("hairless"), v.literal("unknown"),
  ),
  age: v.union(
    v.literal("kitten"), v.literal("young"), v.literal("adult"),
    v.literal("senior"), v.literal("unknown"),
  ),
  breed: v.optional(v.string()),
  zip: v.string(),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  photoUrl: v.optional(v.string()),
});

export const upsertBatch = internalMutation({
  args: { listings: v.array(listingInput) },
  handler: async (ctx, { listings }) => {
    let updatedCount = 0;
    const now = Date.now();
    const newIds: Id<"listings">[] = [];
    for (const listing of listings) {
      const existing = await ctx.db
        .query("listings")
        .withIndex("by_source_externalId", (q) =>
          q.eq("source", listing.source).eq("externalId", listing.externalId),
        )
        .unique();
      if (existing !== null) {
        await ctx.db.patch(existing._id, {
          ...listing,
          status: "available",
          lastSeenAt: now,
        });
        updatedCount++;
      } else {
        newIds.push(
          await ctx.db.insert("listings", {
            ...listing,
            status: "available",
            lastSeenAt: now,
          }),
        );
      }
    }
    for (const listingId of newIds) {
      await ctx.scheduler.runAfter(0, internal.matcher.matchListing, { listingId });
    }
    return { newCount: newIds.length, updatedCount };
  },
});

export const recentRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("ingestRuns").order("desc").take(6);
  },
});
