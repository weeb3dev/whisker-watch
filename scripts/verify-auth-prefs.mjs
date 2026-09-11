// Proof: sign up via Convex Auth, save watcher prefs, read them back
// through the deployed query (the same path the UI uses after a reload).
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
const client = new ConvexHttpClient(url);
const email = `verify-${Date.now()}@example.com`;

const { tokens } = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password: "hunter2hunter2", flow: "signUp" },
});
if (!tokens?.token) throw new Error("sign-up returned no token");
console.log("auth: signed up", email);

client.setAuth(tokens.token);
const prefs = {
  email,
  zip: "94103",
  maxMiles: 50,
  coats: ["long"],
  ages: ["kitten", "young"],
};
await client.mutation(api.watchers.save, prefs);

// Fresh client simulates a page reload: only the JWT survives.
const reloaded = new ConvexHttpClient(url);
reloaded.setAuth(tokens.token);
const watcher = await reloaded.query(api.watchers.mine, {});
if (!watcher) throw new Error("watcher not found after reload");
for (const [k, v] of Object.entries(prefs)) {
  const got = JSON.stringify(watcher[k]);
  const want = JSON.stringify(v);
  if (got !== want) throw new Error(`prefs mismatch on ${k}: ${got} != ${want}`);
}
console.log("prefs: persisted and re-read via convex query", {
  zip: watcher.zip,
  maxMiles: watcher.maxMiles,
  coats: watcher.coats,
  ages: watcher.ages,
});

const anon = new ConvexHttpClient(url);
const anonWatcher = await anon.query(api.watchers.mine, {});
if (anonWatcher !== null) throw new Error("unauthenticated client saw a watcher");
console.log("auth: unauthenticated client correctly sees no watcher");
console.log("VERIFY AUTH+PREFS: PASS");
