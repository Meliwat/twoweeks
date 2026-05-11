import { getSessionById, getMostRecentShipped } from "../db.ts";
import { renderShipCard, defaultScreenshotPath, writeScreenshot } from "../screenshot.ts";
import { c } from "../colors.ts";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { resolve } from "node:path";

export interface ScreenshotArgs {
  id?: number;
  out?: string;
  open?: boolean;
  json?: boolean;
}

export async function screenshotCmd(args: ScreenshotArgs): Promise<number> {
  const session =
    args.id !== undefined ? getSessionById(args.id) : getMostRecentShipped();
  if (!session) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_shipped_session" }));
    } else {
      console.error(c.brightRed("Error:") + " no shipped session. Ship one first.");
    }
    return 1;
  }
  if (session.shipped_at === null) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "session_not_shipped", id: session.id }));
    } else {
      console.error(c.brightRed("Error:") + ` session ${session.id} hasn't shipped yet.`);
    }
    return 1;
  }

  let png: Uint8Array;
  try {
    png = await renderShipCard(session);
  } catch (err) {
    const msg = (err as Error).message;
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "render_failed", details: msg }));
    } else {
      console.error(c.brightRed("Error:") + " failed to render screenshot: " + msg);
    }
    return 1;
  }

  const outPath = args.out ? resolve(args.out) : defaultScreenshotPath(session.id);
  writeScreenshot(outPath, png);

  if (args.json) {
    console.log(JSON.stringify({ ok: true, path: outPath, session_id: session.id, bytes: png.length }));
  } else {
    console.log("");
    console.log(c.dim("Screenshot saved: ") + c.bold(outPath));
    console.log(c.dim(`${png.length} bytes, 1200x630 (Open Graph dimensions).`));
    console.log("");
  }

  if (args.open) {
    openFile(outPath);
  }
  return 0;
}

function openFile(path: string): void {
  const cmd =
    platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [path], { detached: true, stdio: "ignore" }).unref();
  } catch {}
}
