import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { ageValidator, coatValidator } from "./schema";

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("watchers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const save = mutation({
  args: {
    email: v.string(),
    zip: v.string(),
    maxMiles: v.number(),
    coats: v.array(coatValidator),
    ages: v.array(ageValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to save a watch");
    const existing = await ctx.db
      .query("watchers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    let watcherId;
    if (existing !== null) {
      await ctx.db.patch(existing._id, { ...args, active: true });
      watcherId = existing._id;
    } else {
      watcherId = await ctx.db.insert("watchers", { userId, ...args, active: true });
    }
    await ctx.scheduler.runAfter(0, internal.matcher.matchWatcher, { watcherId });
    return watcherId;
  },
});
