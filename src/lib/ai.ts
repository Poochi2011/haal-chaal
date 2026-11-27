import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";

export function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key.startsWith("your-")) return null;
  return new Anthropic({ apiKey: key });
}

/** Pulls the first JSON object out of a model reply. */
export function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function textOf(msg: Anthropic.Message): string {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/**
 * Calls the model with a single forced tool so the answer always comes back as
 * schema-shaped JSON (no fragile text parsing).
 */
export async function structured<T>(
  client: Anthropic,
  opts: { system?: string; messages: Anthropic.MessageParam[]; maxTokens: number; schema: Record<string, unknown> },
): Promise<T> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    ...(opts.system ? { system: opts.system } : {}),
    messages: opts.messages,
    tools: [{ name: "respond", description: "Return the answer.", input_schema: opts.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "respond" },
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (block && block.type === "tool_use") return block.input as T;
  const parsed = parseJson<T>(textOf(msg));
  if (parsed) return parsed;
  throw new Error("no structured output");
}
