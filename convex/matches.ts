import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// The live match board: matches for the signed-in user's watcher joined
// with their listings, newest first. Convex subscriptions push updates the
// moment the matcher writes a row.
export const board = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const watcher = await ctx.db
      .query("watchers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!watcher) return [];
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_watcher", (q) => q.eq("watcherId", watcher._id))
      .order("desc")
      .take(50);
    const rows = [];
    for (const match of matches) {
      const listing = await ctx.db.get(match.listingId);
      if (!listing || listing.status !== "available") continue;
      rows.push({
        matchId: match._id,
        score: match.score,
        reasons: match.reasons,
        scoredBy: match.scoredBy,
        matchedAt: match._creationTime,
        listing: {
          name: listing.name,
          url: listing.url,
          breed: listing.breed,
          coat: listing.coat,
          age: listing.age,
          city: listing.city,
          state: listing.state,
          source: listing.source,
          photoUrl: listing.photoUrl,
        },
      });
    }
    return rows;
  },
});
