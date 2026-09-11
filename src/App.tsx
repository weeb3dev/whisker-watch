import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Authenticated,
  Unauthenticated,
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
        <AuthForm />
      </Unauthenticated>
      <Authenticated>
        <PrefsForm />
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
