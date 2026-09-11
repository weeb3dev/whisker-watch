// Proof: the match board updates over the websocket subscription, without
// any client-initiated re-query, when a matching listing is removed and
// re-ingested (fixture cat "Mochi", long-hair kitten near 94103).
import { ConvexClient } from "convex/browser";
import { ConvexHttpClient } from "convex/browser";
import { execFileSync } from "node:child_process";
import { api } from "../convex/_generated/api.js";

const url = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
const http = new ConvexHttpClient(url);
const email = `realtime-${Date.now()}@example.com`;

const { tokens } = await http.action(api.auth.signIn, {
  provider: "password",
  params: { email, password: "hunter2hunter2", flow: "signUp" },
});
const client = new ConvexClient(url);
client.setAuth(() => Promise.resolve(tokens.token));

const updates = [];
const seen = (names) => `[${names.join(", ")}]`;
client.onUpdate(api.matches.board, {}, (rows) => {
  const names = rows.map((r) => r.listing.name).sort();
  updates.push({ at: Date.now(), names });
  console.log(`push #${updates.length} @${new Date().toISOString()} board=${seen(names)}`);
});

const waitFor = (predicate, label, timeoutMs = 90000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const hit = updates.find(predicate);
      if (hit) {
        clearInterval(timer);
        resolve(hit);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${label}`));
      }
    }, 100);
  });

http.setAuth(tokens.token);
await http.mutation(api.watchers.save, {
  email,
  zip: "94103",
  maxMiles: 50,
  coats: ["long"],
  ages: ["kitten", "young"],
});
console.log("watcher saved; waiting for matcher to populate the board...");
await waitFor((u) => u.names.includes("Mochi"), "initial Mochi match");

console.log("removing Mochi's source data (simulates the cat not yet listed)...");
execFileSync("npx", ["convex", "run", "dev:resetSource", '{"source": "petsmart"}'], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: "inherit",
});
await waitFor((u) => !u.names.includes("Mochi"), "board shrinking after reset");

console.log("re-ingesting petsmart (new listing appears at the source)...");
const t0 = Date.now();
execFileSync("npx", ["convex", "run", "ingest:run", '{"source": "petsmart"}'], {
  cwd: new URL("..", import.meta.url).pathname,
  stdio: "inherit",
});
const hit = await waitFor(
  (u) => u.at > t0 && u.names.includes("Mochi"),
  "Mochi re-appearing via push",
);
console.log(
  `Mochi appeared on the board ${hit.at - t0}ms after ingest, via websocket push (no refresh).`,
);
console.log("VERIFY REALTIME: PASS");
await client.close();
process.exit(0);
