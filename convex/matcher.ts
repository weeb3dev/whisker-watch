import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { milesBetweenZips } from "./geo";

declare const process: { env: Record<string, string | undefined> };

type Verdict = { matched: boolean; score: number; reasons: string[] };

// Pure preference rules. Coat, age, and distance must each pass;
// score is explanatory, not a threshold. Preferences framing only.
export function evaluate(
  watcher: Doc<"watchers">,
  listing: Doc<"listings">,
): Verdict {
  const reasons: string[] = [];
  let score = 10;

  if (watcher.coats.length === 0) {
    reasons.push("any coat welcome");
  } else if (watcher.coats.includes(listing.coat)) {
    score += 40;
    reasons.push(`${listing.coat} coat matches your preference`);
  } else {
    return { matched: false, score: 0, reasons: [`coat ${listing.coat} not in prefs`] };
  }

  if (watcher.ages.length === 0) {
    reasons.push("any age welcome");
  } else if (watcher.ages.includes(listing.age)) {
    score += 20;
    reasons.push(`${listing.age} fits your age preference`);
  } else {
    return { matched: false, score: 0, reasons: [`age ${listing.age} not in prefs`] };
  }

  const miles = milesBetweenZips(watcher.zip, listing.zip);
  if (miles === null) {
    reasons.push("distance unknown (zip outside geo table)");
  } else if (miles <= watcher.maxMiles) {
    score += 30;
    reasons.push(`~${miles} miles away (within ${watcher.maxMiles})`);
  } else {
    return { matched: false, score: 0, reasons: [`${miles} miles exceeds ${watcher.maxMiles}`] };
  }

  return { matched: true, score, reasons };
}

// Optional LLM refinement over rule-matched pairs. Works against OpenAI or
// any OpenAI-compatible endpoint (set OPENAI_BASE_URL for Convex AI Gateway).
async function llmRefine(
  watcher: Doc<"watchers">,
  listing: Doc<"listings">,
  rules: Verdict,
): Promise<{ score: number; reasons: string[]; scoredBy: "rules" | "llm" }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const rulesResult = {
    score: rules.score,
    reasons: rules.reasons,
    scoredBy: "rules" as const,
  };
  if (!apiKey) return rulesResult;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You score cat adoption matches on style preferences only (coat, age, distance). Never make medical or allergy claims. Reply as JSON {\"score\": 0-100, \"reasons\": [\"...\"]} with at most 3 short reasons.",
          },
          {
            role: "user",
            content: JSON.stringify({
              preferences: {
                coats: watcher.coats,
                ages: watcher.ages,
                zip: watcher.zip,
                maxMiles: watcher.maxMiles,
              },
              cat: {
                name: listing.name,
                breed: listing.breed,
                coat: listing.coat,
                age: listing.age,
                city: listing.city,
                state: listing.state,
              },
              ruleReasons: rules.reasons,
            }),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM ${response.status}`);
    const body = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const parsed = JSON.parse(body.choices[0].message.content) as {
      score?: number;
      reasons?: string[];
    };
    if (typeof parsed.score !== "number" || !Array.isArray(parsed.reasons)) {
      throw new Error("LLM returned unexpected shape");
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reasons: parsed.reasons.slice(0, 3).map(String),
      scoredBy: "llm",
    };
  } catch {
    return rulesResult;
  }
}

type Candidate = {
  watcherId: Id<"watchers">;
  listingId: Id<"listings">;
  score: number;
  reasons: string[];
  scoredBy: "rules" | "llm";
};

async function scorePairs(
  watchers: Doc<"watchers">[],
  listings: Doc<"listings">[],
): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  for (const watcher of watchers) {
    for (const listing of listings) {
      if (listing.status !== "available") continue;
      const rules = evaluate(watcher, listing);
      if (!rules.matched) continue;
      const refined = await llmRefine(watcher, listing, rules);
      candidates.push({
        watcherId: watcher._id,
        listingId: listing._id,
        ...refined,
      });
    }
  }
  return candidates;
}

export const matchListing = internalAction({
  args: { listingId: v.id("listings") },
  handler: async (ctx, { listingId }): Promise<void> => {
    const listing: Doc<"listings"> | null = await ctx.runQuery(
      internal.matcher.getListing,
      { listingId },
    );
    if (!listing) return;
    const watchers: Doc<"watchers">[] = await ctx.runQuery(
      internal.matcher.activeWatchers,
      {},
    );
    const candidates = await scorePairs(watchers, [listing]);
    await ctx.runMutation(internal.matcher.recordMatches, { candidates });
  },
});

export const matchWatcher = internalAction({
  args: { watcherId: v.id("watchers") },
  handler: async (ctx, { watcherId }): Promise<void> => {
    const watcher: Doc<"watchers"> | null = await ctx.runQuery(
      internal.matcher.getWatcher,
      { watcherId },
    );
    if (!watcher || !watcher.active) return;
    const listings: Doc<"listings">[] = await ctx.runQuery(
      internal.matcher.availableListings,
      {},
    );
    const candidates = await scorePairs([watcher], listings);
    await ctx.runMutation(internal.matcher.recordMatches, { candidates });
  },
});

export const getListing = internalQuery({
  args: { listingId: v.id("listings") },
  handler: (ctx, { listingId }) => ctx.db.get(listingId),
});

export const getWatcher = internalQuery({
  args: { watcherId: v.id("watchers") },
  handler: (ctx, { watcherId }) => ctx.db.get(watcherId),
});

export const activeWatchers = internalQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("watchers")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect(),
});

export const availableListings = internalQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .collect(),
});

// Idempotent: the by_watcher_listing index makes re-scoring a no-op for
// existing pairs, so re-runs never duplicate matches or alerts.
export const recordMatches = internalMutation({
  args: {
    candidates: v.array(
      v.object({
        watcherId: v.id("watchers"),
        listingId: v.id("listings"),
        score: v.number(),
        reasons: v.array(v.string()),
        scoredBy: v.union(v.literal("rules"), v.literal("llm")),
      }),
    ),
  },
  handler: async (ctx, { candidates }) => {
    const newMatchIds: Id<"matches">[] = [];
    for (const candidate of candidates) {
      const existing = await ctx.db
        .query("matches")
        .withIndex("by_watcher_listing", (q) =>
          q
            .eq("watcherId", candidate.watcherId)
            .eq("listingId", candidate.listingId),
        )
        .unique();
      if (existing !== null) continue;
      newMatchIds.push(await ctx.db.insert("matches", candidate));
    }
    for (const matchId of newMatchIds) {
      await ctx.scheduler.runAfter(0, internal.alerts.sendForMatch, { matchId });
    }
    return { created: newMatchIds.length };
  },
});
