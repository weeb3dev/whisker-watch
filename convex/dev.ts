import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { sourceValidator } from "./schema";

// Demo/dev reset: remove one source's listings and their downstream
// matches/alerts so a re-ingest demonstrates the live pipeline end to end.
export const resetSource = internalMutation({
  args: { source: sourceValidator, externalId: v.optional(v.string()) },
  handler: async (ctx, { source, externalId }) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_source_externalId", (q) => {
        const bySource = q.eq("source", source);
        return externalId ? bySource.eq("externalId", externalId) : bySource;
      })
      .collect();
    let removed = 0;
    for (const listing of listings) {
      const matches = await ctx.db.query("matches").collect();
      for (const match of matches.filter((m) => m.listingId === listing._id)) {
        const alerts = await ctx.db
          .query("alerts")
          .withIndex("by_match", (q) => q.eq("matchId", match._id))
          .collect();
        for (const alert of alerts) await ctx.db.delete(alert._id);
        await ctx.db.delete(match._id);
      }
      await ctx.db.delete(listing._id);
      removed++;
    }
    return { removed };
  },
});
