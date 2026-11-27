import { connection } from "next/server";
import { retellConfig } from "@/lib/retell";

/** Tells the frontend whether real phone calls are available. */
export async function GET() {
  await connection();
  const cfg = retellConfig();
  return Response.json({ enabled: Boolean(cfg), languages: cfg ? Object.keys(cfg.agents) : [] });
}
