import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "ingest petfinder",
  { minutes: 30 },
  api.ingest.run,
  { source: "petfinder" },
);

crons.interval(
  "ingest petsmart",
  { minutes: 30 },
  api.ingest.run,
  { source: "petsmart" },
);

export default crons;
