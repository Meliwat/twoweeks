import { getMostRecentActive, shipSession } from "../db.ts";
import { resultCard, computeRatio, formatRatio, humanDuration, humanDurationSpoken } from "../format.ts";
import { milestoneFor } from "../flair.ts";
import { buildShareUrl, openUrl } from "./share.ts";
import type { ShareTarget } from "./share.ts";
import { c } from "../colors.ts";
import {
  renderShipCard,
  defaultScreenshotPath,
  writeScreenshot,
  writeAltText,
  altTextForSession,
  altTextPath,
  sessionSlug,
} from "../screenshot.ts";
import { spawn } from "node:child_process";
import { platform } from "node:os";

export interface ShipArgs {
  share?: boolean;
  shareTarget?: ShareTarget;
  screenshot?: boolean;
  screenshotOut?: string;
  copy?: boolean;
  plain?: boolean;
  noEmoji?: boolean;
  json?: boolean;
}

/** Copy a PNG to the macOS clipboard via osascript. Returns true on success. */
function pbcopyPng(path: string): boolean {
  if (platform() !== "darwin") return false;
  try {
    const proc = spawn(
      "osascript",
      ["-e", `set the clipboard to (read (POSIX file "${path}") as «class PNGf»)`],
      { stdio: "ignore" }
    );
    return proc.pid !== undefined;
  } catch {
    return false;
  }
}

export async function ship(args: ShipArgs): Promise<number> {
  const active = getMostRecentActive();
  if (!active) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "no_active_session" }));
    } else if (args.plain) {
      console.error('Error: no active session to ship. Start one: twoweeks "task" "2 weeks"');
    } else {
      console.error(c.brightRed("Error:") + ' no active session to ship. Start one with: ' + c.bold('twoweeks "task"'));
    }
    return 1;
  }
  const shipped = shipSession(active.id);
  if (!shipped || shipped.shipped_at === null) {
    if (args.json) {
      console.error(JSON.stringify({ ok: false, error: "ship_failed" }));
    } else {
      console.error((args.plain ? "Error: " : c.brightRed("Error:") + " ") + "failed to ship session.");
    }
    return 1;
  }

  const ratio = computeRatio(shipped);
  const milestone = milestoneFor(ratio);
  const target: ShareTarget = args.shareTarget ?? "x";
  const url = buildShareUrl(shipped, target);
  const slug = sessionSlug(shipped);

  let screenshotPath: string | undefined;
  let altPath: string | undefined;
  let copied = false;
  if (args.screenshot) {
    try {
      const png = await renderShipCard(shipped);
      screenshotPath = args.screenshotOut ?? defaultScreenshotPath(shipped.id);
      writeScreenshot(screenshotPath, png);
      altPath = altTextPath(screenshotPath);
      writeAltText(screenshotPath, altTextForSession(shipped));
      if (args.copy) {
        copied = pbcopyPng(screenshotPath);
      }
    } catch (err) {
      if (!args.json) {
        const errMsg = (err as Error).message;
        if (args.plain) console.error("Screenshot failed: " + errMsg);
        else console.error(c.brightRed("Screenshot failed:") + " " + errMsg);
      }
    }
  }

  if (args.json) {
    const actualMs = (shipped.shipped_at as number) - shipped.started_at;
    console.log(
      JSON.stringify({
        ok: true,
        session: shipped,
        slug,
        ratio,
        ratio_formatted: formatRatio(ratio),
        actual_ms: actualMs,
        actual_human: humanDuration(actualMs),
        actual_spoken: humanDurationSpoken(actualMs),
        saved_ms: Math.max(0, shipped.eta_ms - actualMs),
        milestone,
        share_url: url,
        share_target: target,
        screenshot_path: screenshotPath,
        alt_text_path: altPath,
        copied_to_clipboard: copied,
      })
    );
    if (args.share) openUrl(url);
    return 0;
  }

  console.log(resultCard(shipped, milestone, { plain: args.plain, noEmoji: args.noEmoji }));

  if (screenshotPath) {
    if (args.plain) {
      console.log(`Screenshot: ${screenshotPath}`);
      console.log(`Alt text: ${altPath}`);
      if (copied) console.log("(PNG copied to clipboard — Cmd+V into any compose box.)");
    } else {
      console.log(c.dim((args.noEmoji ? "Screenshot: " : "📸 Screenshot: ")) + c.bold(screenshotPath));
      console.log(c.dim("Alt text:   ") + c.dim(altPath ?? ""));
      if (copied) console.log(c.brightGreen("✓ PNG copied to clipboard — Cmd+V into any compose box."));
      console.log("");
    }
  }

  if (args.share) {
    const targetName = target === "x" ? "X" : target === "bluesky" ? "Bluesky" : "Mastodon";
    if (args.plain) {
      console.log(`Opening ${targetName} with your brag pre-filled. URL: ${url}`);
    } else {
      console.log(c.dim(`Opening ${targetName} with your brag pre-filled...`));
      console.log("");
      console.log(c.dim("If your browser doesn't open, here's the URL:"));
      console.log(c.cyan(url));
      console.log("");
    }
    openUrl(url);
  } else if (args.plain) {
    console.log(`Tweet it:   twoweeks share ${shipped.id}`);
    console.log(`Save PNG:   twoweeks ship --screenshot --copy`);
  } else {
    console.log(c.brightCyan("→ Tweet it:") + " " + c.bold(`twoweeks share ${shipped.id}`));
    console.log(c.dim("  Save PNG:  ") + c.bold(`twoweeks ship --screenshot --copy`));
    console.log("");
  }
  return 0;
}
