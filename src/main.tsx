import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { getConvexUrl } from "@convex-dev/static-hosting";
import "./index.css";
import App from "./App.tsx";

// Baked in at build time by `npm run deploy`; when served from *.convex.site the
// URL can also be derived from the hostname.
const convex = new ConvexReactClient(
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? getConvexUrl(),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
);
