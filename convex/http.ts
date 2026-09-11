import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { SITE_ASSETS } from "./siteAssets";

const http = httpRouter();

auth.addHttpRoutes(http);

// Serve the built SPA on the deployment's .convex.site domain.
function assetResponse(path: string): Response {
  const asset = SITE_ASSETS[path] ?? SITE_ASSETS["/index.html"];
  if (!asset) return new Response("build the site first: npm run build:site", { status: 404 });
  const bytes = Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    },
  });
}

http.route({
  path: "/",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => assetResponse("/index.html")),
});

http.route({
  pathPrefix: "/assets/",
  method: "GET",
  handler: httpAction(async (_ctx, request) =>
    assetResponse(new URL(request.url).pathname),
  ),
});

http.route({
  path: "/favicon.svg",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => assetResponse("/favicon.svg")),
});

export default http;
