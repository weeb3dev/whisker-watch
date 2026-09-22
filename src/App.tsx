import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";

const COATS = ["short", "medium", "long", "hairless"] as const;
const AGES = ["kitten", "young", "adult", "senior"] as const;
type Coat = (typeof COATS)[number];
type Age = (typeof AGES)[number];

export default function App() {
  return (
    <div className="shell">
      <header className="header">
        <h1>
          <span className="logo">⌖</span> Whisker Watch
        </h1>
        <p className="tagline">Live cat-adoption radar. Get pinged before the cat is gone.</p>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <Unauthenticated>
        <div className="auth-view">
          <AuthForm />
        </div>
      </Unauthenticated>
      <Authenticated>
        <PrefsForm />
        <MatchBoard />
        <IngestPanel />
        <Outbox />
      </Authenticated>
      <footer className="footer">
        Coat and age are style preferences only. Whisker Watch makes no medical or
        allergy claims.
      </footer>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button className="ghost" onClick={() => void signOut()}>
      Sign out
    </button>
  );
}

function AuthForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="card auth-card">
      <h2>{flow === "signIn" ? "Sign in" : "Create account"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const formData = new FormData(e.currentTarget);
          formData.set("flow", flow);
          void signIn("password", formData)
            .catch(() => setError("Sign in failed. Check email and password (8+ chars)."))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Email
          <input name="email" type="email" required placeholder="you@example.com" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} placeholder="8+ characters" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button
        className="ghost"
        onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
      >
        {flow === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </section>
  );
}

function PrefsForm() {
  const watcher = useQuery(api.watchers.mine);
  const save = useMutation(api.watchers.save);
  const [draft, setDraft] = useState<{
    email: string;
    zip: string;
    maxMiles: number;
    coats: Coat[];
    ages: Age[];
  } | null>(null);
  const [saved, setSaved] = useState(false);

  if (watcher === undefined) return <section className="card">Loading…</section>;

  const form = draft ?? {
    email: watcher?.email ?? "",
    zip: watcher?.zip ?? "",
    maxMiles: watcher?.maxMiles ?? 50,
    coats: (watcher?.coats.filter((c) => c !== "unknown") as Coat[]) ?? [],
    ages: (watcher?.ages.filter((a) => a !== "unknown") as Age[]) ?? [],
  };

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <section className="card">
      <h2>Your watch</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(form).then(() => {
            setDraft(null);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          });
        }}
      >
        <div className="row">
          <label>
            Alert email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setDraft({ ...form, email: e.target.value })}
              placeholder="where alerts go"
            />
          </label>
          <label>
            ZIP code
            <input
              required
              pattern="\d{5}"
              value={form.zip}
              onChange={(e) => setDraft({ ...form, zip: e.target.value })}
              placeholder="94103"
            />
          </label>
        </div>
        <label>
          Max distance: <strong>{form.maxMiles} miles</strong>
          <input
            type="range"
            min={5}
            max={250}
            step={5}
            value={form.maxMiles}
            onChange={(e) => setDraft({ ...form, maxMiles: Number(e.target.value) })}
          />
        </label>
        <fieldset>
          <legend>Coat length</legend>
          <div className="chips">
            {COATS.map((c) => (
              <button
                type="button"
                key={c}
                className={form.coats.includes(c) ? "chip on" : "chip"}
                onClick={() => setDraft({ ...form, coats: toggle(form.coats, c) })}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Age</legend>
          <div className="chips">
            {AGES.map((a) => (
              <button
                type="button"
                key={a}
                className={form.ages.includes(a) ? "chip on" : "chip"}
                onClick={() => setDraft({ ...form, ages: toggle(form.ages, a) })}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit">{watcher ? "Update watch" : "Start watching"}</button>
        {saved && <span className="saved">Saved ✓</span>}
      </form>
    </section>
  );
}

function MatchBoard() {
  const rows = useQuery(api.matches.board);
  if (rows === undefined) return <section className="card">Loading matches…</section>;
  return (
    <section className="card">
      <h2>
        Match radar <span className="live-dot" title="live via Convex subscription" />
      </h2>
      {rows.length === 0 ? (
        <p className="dim">
          No matches yet. Save a watch, then run a scan below — new cats appear
          here the moment the matcher finds them, no refresh needed.
        </p>
      ) : (
        <div className="board">
          {rows.map((row) => (
            <article className="match" key={row.matchId}>
              {row.listing.photoUrl && (
                <img src={row.listing.photoUrl} alt={row.listing.name} loading="lazy" />
              )}
              <div className="match-body">
                <header>
                  <a href={row.listing.url} target="_blank" rel="noreferrer">
                    {row.listing.name}
                  </a>
                  <span className="score">{row.score}</span>
                </header>
                <p className="meta">
                  {[
                    row.listing.breed,
                    row.listing.age,
                    row.listing.city && `${row.listing.city}, ${row.listing.state}`,
                    row.listing.source,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <ul>
                  {row.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function IngestPanel() {
  const runs = useQuery(api.ingest.recentRuns);
  const runIngest = useAction(api.ingest.run);
  const [scanning, setScanning] = useState(false);
  return (
    <section className="card">
      <h2>Ingest</h2>
      <button
        type="button"
        className="scan"
        disabled={scanning}
        onClick={() => {
          setScanning(true);
          void Promise.allSettled([
            runIngest({ source: "petfinder" }),
            runIngest({ source: "petsmart" }),
          ]).finally(() => setScanning(false));
        }}
      >
        {scanning ? "Scanning…" : "Scan now"}
      </button>
      <table className="runs">
        <tbody>
          {(runs ?? []).map((run) => (
            <tr key={run._id}>
              <td>{run.source}</td>
              <td className={run.status === "failed" ? "bad" : "ok"}>{run.status}</td>
              <td>{run.mode}</td>
              <td>
                {run.listingsFound} found · {run.listingsNew} new
              </td>
              <td className="dim">{new Date(run.startedAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Outbox() {
  const alerts = useQuery(api.alerts.myAlerts);
  if (!alerts || alerts.length === 0) return null;
  return (
    <section className="card">
      <h2>Alert outbox</h2>
      <p className="dim">
        Emails sent for your matches. Provider "outbox" is the logged mock;
        set AgentMail credentials to send for real.
      </p>
      {alerts.map((alert) => (
        <details className="alert" key={alert._id}>
          <summary>
            <span className={alert.status === "sent" ? "ok" : "bad"}>{alert.status}</span>{" "}
            {alert.subject} <span className="dim">via {alert.provider}</span>
          </summary>
          <pre>{alert.body}</pre>
        </details>
      ))}
    </section>
  );
}
