import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

declare const process: { env: Record<string, string | undefined> };

// Both providers take the same payload and return a provider message id,
// so switching from the outbox mock to real AgentMail is only a matter of
// setting AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID on the deployment.
type SendPayload = { to: string; subject: string; text: string; html: string };

async function sendViaAgentMail(payload: SendPayload): Promise<string> {
  const apiKey = process.env.AGENTMAIL_API_KEY!;
  const inboxId = process.env.AGENTMAIL_INBOX_ID!;
  const response = await fetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(`AgentMail ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const body = (await response.json()) as { message_id: string };
  return body.message_id;
}

function sendViaOutbox(payload: SendPayload): string {
  const id = `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[outbox] ${id} -> ${payload.to}: ${payload.subject}\n${payload.text}`);
  return id;
}

export const sendForMatch = internalAction({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }): Promise<void> => {
    const context: {
      match: Doc<"matches">;
      watcher: Doc<"watchers">;
      listing: Doc<"listings">;
    } | null = await ctx.runQuery(internal.alerts.matchContext, { matchId });
    if (!context) return;
    const { match, watcher, listing } = context;

    const where = listing.city ? ` in ${listing.city}, ${listing.state}` : "";
    const subject = `Whisker Watch: ${listing.name} just appeared${where}`;
    const text = [
      `${listing.name} matches your watch (score ${match.score}).`,
      ...match.reasons.map((reason) => `- ${reason}`),
      "",
      `See the listing before someone else does: ${listing.url}`,
      "",
      "Coat and age are style preferences only; no medical or allergy claims.",
    ].join("\n");
    const html = [
      `<p><strong>${listing.name}</strong> matches your watch (score ${match.score}).</p>`,
      `<ul>${match.reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>`,
      `<p><a href="${listing.url}">See the listing before someone else does</a></p>`,
      `<p style="color:#888;font-size:12px">Coat and age are style preferences only; no medical or allergy claims.</p>`,
    ].join("");

    const useAgentMail = Boolean(
      process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_INBOX_ID,
    );
    const provider = useAgentMail ? "agentmail" : "outbox";
    const alertId: Id<"alerts"> = await ctx.runMutation(
      internal.alerts.create,
      {
        matchId,
        watcherId: watcher._id,
        email: watcher.email,
        subject,
        body: text,
        provider,
      },
    );

    try {
      const payload = { to: watcher.email, subject, text, html };
      const providerMessageId = useAgentMail
        ? await sendViaAgentMail(payload)
        : sendViaOutbox(payload);
      await ctx.runMutation(internal.alerts.markSent, {
        alertId,
        providerMessageId,
      });
    } catch (error) {
      await ctx.runMutation(internal.alerts.markFailed, {
        alertId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

export const matchContext = internalQuery({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return null;
    // One alert per match, even if the send action is retried.
    const existing = await ctx.db
      .query("alerts")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .first();
    if (existing) return null;
    const watcher = await ctx.db.get(match.watcherId);
    const listing = await ctx.db.get(match.listingId);
    if (!watcher || !listing) return null;
    return { match, watcher, listing };
  },
});

export const create = internalMutation({
  args: {
    matchId: v.id("matches"),
    watcherId: v.id("watchers"),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    provider: v.union(v.literal("agentmail"), v.literal("outbox")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", { ...args, status: "pending" });
  },
});

export const markSent = internalMutation({
  args: { alertId: v.id("alerts"), providerMessageId: v.string() },
  handler: async (ctx, { alertId, providerMessageId }) => {
    await ctx.db.patch(alertId, {
      status: "sent",
      providerMessageId,
      sentAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: { alertId: v.id("alerts"), error: v.string() },
  handler: async (ctx, { alertId, error }) => {
    await ctx.db.patch(alertId, { status: "failed", error });
  },
});

// Outbox view for the signed-in user: with the mock provider this is the
// demoable proof that the email path ran.
export const myAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const watcher = await ctx.db
      .query("watchers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!watcher) return [];
    return await ctx.db
      .query("alerts")
      .withIndex("by_watcher", (q) => q.eq("watcherId", watcher._id))
      .order("desc")
      .take(10);
  },
});
