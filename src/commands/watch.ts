import { readFileSync } from "node:fs";
import { bestEstimate, inferTaskFromUserMessage, readTranscript } from "../parser.ts";
import { createSession, getMostRecentActive } from "../db.ts";
import { c } from "../colors.ts";

export interface WatchArgs {
  fromPath?: string;
  fromStdin?: boolean;
  fromHook?: boolean;
  task?: string;
  quiet?: boolean;
  json?: boolean;
  plain?: boolean;
}

interface HookStdinPayload {
  transcript_path?: string;
  session_id?: string;
  stop_hook_active?: boolean;
}

/**
 * Read a chunk of text from stdin or a hook JSON payload, scan for the AI's
 * estimate, and (if found, and no session is already active) create a session.
 * Silent on no-match in --quiet mode, friendly otherwise.
 */
export async function watch(args: WatchArgs): Promise<number> {
  let assistantText = "";
  let userText = "";

  if (args.fromHook) {
    // Claude Code Stop hook hands us JSON on stdin with transcript_path.
    const stdinRaw = await readAllStdin();
    let payload: HookStdinPayload = {};
    try {
      payload = JSON.parse(stdinRaw || "{}") as HookStdinPayload;
    } catch {
      // Tolerate missing/garbled payload — treat stdin as raw text.
    }
    if (payload.transcript_path) {
      const t = readTranscript(payload.transcript_path);
      assistantText = t.lastAssistantText;
      userText = t.lastUserText;
    } else if (stdinRaw.trim().length > 0) {
      assistantText = stdinRaw;
    }
  } else if (args.fromPath) {
    if (args.fromPath.endsWith(".jsonl")) {
      const t = readTranscript(args.fromPath);
      assistantText = t.lastAssistantText;
      userText = t.lastUserText;
    } else {
      try {
        assistantText = readFileSync(args.fromPath, "utf-8");
      } catch (err) {
        return emit({ args, ok: false, error: `cannot read ${args.fromPath}: ${(err as Error).message}` });
      }
    }
  } else {
    // Default: read stdin as raw text.
    assistantText = await readAllStdin();
  }

  if (!assistantText || assistantText.trim().length === 0) {
    return emit({ args, ok: false, error: "no_text", message: "Nothing on stdin / transcript was empty." });
  }

  const match = bestEstimate(assistantText);
  if (!match) {
    return emit({ args, ok: false, error: "no_estimate", message: "No estimate phrase found in the text." });
  }

  // First-write-wins. The hook fires every assistant turn — don't spam sessions.
  const existing = getMostRecentActive();
  if (existing) {
    return emit({
      args,
      ok: false,
      error: "active_session_exists",
      message: `Already tracking "${existing.task}". Ship or abandon it first.`,
      existing,
    });
  }

  const task =
    args.task?.trim() ||
    inferTaskFromUserMessage(userText) ||
    "Claude's plan";

  const session = createSession(task, match.text, match.ms, match.quote);

  if (args.json) {
    console.log(JSON.stringify({ ok: true, session, captured: match }));
    return 0;
  }
  if (args.quiet) {
    return 0;
  }
  const verb = args.fromHook ? "Caught" : "Captured";
  console.log("");
  console.log(`${c.brightGreen("🎯")} ${c.bold(verb + ":")} ${c.italic('"' + match.quote + '"')}`);
  console.log(`   ${c.dim("Task:")}      ${c.bold(task)}`);
  console.log(`   ${c.dim("Estimate:")}  ${c.brightCyan(match.text)} ${c.dim("(" + Math.round(match.ms / (60 * 60 * 1000)) + "h)")}`);
  console.log("");
  console.log(c.dim("   Run `twoweeks ship` when you're done."));
  console.log("");
  return 0;
}

interface EmitArgs {
  args: WatchArgs;
  ok: boolean;
  error?: string;
  message?: string;
  existing?: unknown;
}

function emit({ args, ok, error, message, existing }: EmitArgs): number {
  if (args.json) {
    const payload: Record<string, unknown> = { ok };
    if (error) payload.error = error;
    if (message) payload.message = message;
    if (existing) payload.existing = existing;
    console.log(JSON.stringify(payload));
    return ok ? 0 : (error === "active_session_exists" ? 0 : 1);
  }
  if (args.quiet) {
    // Hook mode: never spam the user's terminal.
    return 0;
  }
  if (!ok && message) {
    // Soft failure — print to stderr so pipes stay clean.
    console.error(c.dim(message));
  }
  // Soft failures return 0 in hook contexts so Claude Code doesn't surface them.
  // CLI invocations of `twoweeks watch -` see the message and a clean exit.
  return 0;
}

async function readAllStdin(): Promise<string> {
  // No data on stdin? Return empty quickly instead of hanging forever.
  if (process.stdin.isTTY) return "";

  return await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}
