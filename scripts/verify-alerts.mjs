// Proof: a new match produces an Alert with status "sent" whose body links
// the listing URL. Runs against whichever provider the deployment has
// configured (AgentMail when AGENTMAIL_* are set, logged outbox otherwise).
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";
const client = new ConvexHttpClient(url);
const email = `alerts-${Date.now()}@example.com`;

const { tokens } = await client.action(api.auth.signIn, {
  provider: "password",
  params: { email, password: "hunter2hunter2", flow: "signUp" },
});
client.setAuth(tokens.token);

await client.mutation(api.watchers.save, {
  email,
  zip: "94103",
  maxMiles: 50,
  coats: ["long"],
  ages: [],
});

let alerts = [];
for (let attempt = 0; attempt < 30 && alerts.length === 0; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  alerts = await client.query(api.alerts.myAlerts, {});
}
if (alerts.length === 0) throw new Error("no alerts created within 30s");

for (const alert of alerts) {
  if (alert.status !== "sent") {
    throw new Error(`alert ${alert._id} status=${alert.status} error=${alert.error ?? ""}`);
  }
  if (!/https?:\/\/\S+/.test(alert.body)) {
    throw new Error(`alert ${alert._id} body has no listing link`);
  }
}
console.log(
  alerts.map((a) => ({
    status: a.status,
    provider: a.provider,
    providerMessageId: a.providerMessageId,
    subject: a.subject,
    linksListing: /https?:\/\/\S+/.exec(a.body)?.[0],
  })),
);
console.log(`VERIFY ALERTS: PASS (${alerts.length} alerts, all status=sent)`);
