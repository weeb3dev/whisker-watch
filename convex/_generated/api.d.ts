/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as fixtures from "../fixtures.js";
import type * as geo from "../geo.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as matcher from "../matcher.js";
import type * as matches from "../matches.js";
import type * as normalize from "../normalize.js";
import type * as siteAssets from "../siteAssets.js";
import type * as watchers from "../watchers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alerts: typeof alerts;
  auth: typeof auth;
  crons: typeof crons;
  dev: typeof dev;
  fixtures: typeof fixtures;
  geo: typeof geo;
  http: typeof http;
  ingest: typeof ingest;
  matcher: typeof matcher;
  matches: typeof matches;
  normalize: typeof normalize;
  siteAssets: typeof siteAssets;
  watchers: typeof watchers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
