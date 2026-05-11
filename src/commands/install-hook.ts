import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { c } from "../colors.ts";

export interface InstallHookArgs {
  uninstall?: boolean;
  scope?: "user" | "project";
  json?: boolean;
  command?: string; // Override the hook command (mostly for tests).
}

const HOOK_COMMAND = "twoweeks watch --from-hook --quiet";
const HOOK_TAG = "twoweeks-auto-capture";

interface ClaudeSettings {
  hooks?: {
    Stop?: HookGroup[];
    [k: string]: HookGroup[] | undefined;
  };
  [k: string]: unknown;
}

interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

interface HookEntry {
  type: string;
  command: string;
  // Custom marker so we can find + remove our own entries reliably.
  _twoweeks?: string;
}

function settingsPath(scope: "user" | "project"): string {
  if (scope === "user") return join(homedir(), ".claude", "settings.json");
  return join(process.cwd(), ".claude", "settings.json");
}

function load(path: string): ClaudeSettings {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    if (raw.trim().length === 0) return {};
    return JSON.parse(raw) as ClaudeSettings;
  } catch (err) {
    throw new Error(`Could not parse ${path}: ${(err as Error).message}`);
  }
}

function save(path: string, data: ClaudeSettings): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export function installHook(args: InstallHookArgs): number {
  const scope = args.scope ?? "user";
  const path = settingsPath(scope);
  const command = args.command ?? HOOK_COMMAND;

  let settings: ClaudeSettings;
  try {
    settings = load(path);
  } catch (err) {
    const msg = (err as Error).message;
    if (args.json) console.error(JSON.stringify({ ok: false, error: msg }));
    else console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }

  if (args.uninstall) {
    return doUninstall({ args, scope, path, settings });
  }

  settings.hooks ??= {};
  const stopHooks = (settings.hooks.Stop ??= []);

  // Idempotent — bail if our marker is already present.
  for (const group of stopHooks) {
    for (const h of group.hooks ?? []) {
      if (h._twoweeks === HOOK_TAG) {
        if (args.json) {
          console.log(JSON.stringify({ ok: true, already_installed: true, path }));
        } else {
          console.log(c.dim("Auto-capture is already installed at ") + path);
        }
        return 0;
      }
    }
  }

  stopHooks.push({
    matcher: "",
    hooks: [
      {
        type: "command",
        command,
        _twoweeks: HOOK_TAG,
      },
    ],
  });

  try {
    save(path, settings);
  } catch (err) {
    const msg = `Could not write ${path}: ${(err as Error).message}`;
    if (args.json) console.error(JSON.stringify({ ok: false, error: msg }));
    else console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }

  if (args.json) {
    console.log(JSON.stringify({ ok: true, installed: true, path, command }));
    return 0;
  }
  console.log("");
  console.log(`${c.brightGreen("✓")} Auto-capture installed.`);
  console.log(`   ${c.dim("Hook:")}     ${c.bold("Stop")} → ${c.italic(command)}`);
  console.log(`   ${c.dim("Settings:")} ${path}`);
  console.log("");
  console.log(c.dim("Next time Claude says \"this should take 2 weeks,\" twoweeks catches it."));
  console.log(c.dim("Run `twoweeks ship` when you're done. Or `twoweeks uninstall-hook` to undo."));
  console.log("");
  return 0;
}

function doUninstall({
  args,
  scope: _scope,
  path,
  settings,
}: {
  args: InstallHookArgs;
  scope: "user" | "project";
  path: string;
  settings: ClaudeSettings;
}): number {
  if (!settings.hooks?.Stop) {
    if (args.json) console.log(JSON.stringify({ ok: true, removed: false, path }));
    else console.log(c.dim("No twoweeks hook found at ") + path);
    return 0;
  }

  let removed = 0;
  const newGroups: HookGroup[] = [];
  for (const group of settings.hooks.Stop) {
    const keep: HookEntry[] = [];
    for (const h of group.hooks ?? []) {
      if (h._twoweeks === HOOK_TAG) {
        removed++;
      } else {
        keep.push(h);
      }
    }
    if (keep.length > 0) newGroups.push({ ...group, hooks: keep });
  }
  settings.hooks.Stop = newGroups;
  if (newGroups.length === 0) delete settings.hooks.Stop;

  try {
    save(path, settings);
  } catch (err) {
    const msg = `Could not write ${path}: ${(err as Error).message}`;
    if (args.json) console.error(JSON.stringify({ ok: false, error: msg }));
    else console.error(c.brightRed("Error:") + " " + msg);
    return 1;
  }

  if (args.json) {
    console.log(JSON.stringify({ ok: true, removed: removed > 0, count: removed, path }));
    return 0;
  }
  if (removed > 0) {
    console.log(`${c.brightGreen("✓")} Removed ${removed} twoweeks hook${removed === 1 ? "" : "s"} from ${path}.`);
  } else {
    console.log(c.dim("No twoweeks hook found at ") + path);
  }
  return 0;
}
