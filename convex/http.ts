import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Serve the built SPA on the deployment's .convex.site domain via the official
// static-hosting component (files live in Convex storage, uploaded by `npm run deploy`).
registerStaticRoutes(http, components.staticHosting);

export default http;
