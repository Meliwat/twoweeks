import { getAllShipped, getStats } from "../db.ts";
import { computeRatio, historyTable, formatRatio, humanDuration, humanDurationSpoken } from "../format.ts";
import { computeAchievements } from "../achievements.ts";
import type { Session } from "../db.ts";
import { c } from "../colors.ts";

export interface HistoryArgs {
  json?: boolean;
  plain?: boolean;
  noEmoji?: boolean;
}

export function history(args: HistoryArgs = {}): number {
  const shippedSessions = getAllShipped();
  const stats = getStats();
  const achievements = computeAchievements(shippedSessions);

  const ratios = shippedSessions.map((s) => computeRatio(s));
  const finiteRatios = ratios.filter((r) => isFinite(r));
  const bestRatio = finiteRatios.length > 0 ? Math.max(...finiteRatios) : null;
  const avgRatio =
    finiteRatios.length > 0
      ? finiteRatios.reduce((a, b) => a + b, 0) / finiteRatios.length
      : null;

  if (args.json) {
    console.log(
      JSON.stringify({
        ok: true,
        stats: {
          ...stats,
          bestRatio,
          avgRatio,
          totalSavedHuman: humanDuration(stats.totalSavedMs),
          totalSavedSpoken: humanDurationSpoken(stats.totalSavedMs),
        },
        achievements,
        shipped: shippedSessions.map((s, i) => ({
          ...s,
          ratio: ratios[i],
          ratio_formatted: formatRatio(ratios[i]),
        })),
      })
    );
    return 0;
  }

  const rows: Array<Session & { ratio: number }> = shippedSessions.map((s, i) => ({
    ...s,
    ratio: ratios[i],
  }));

  console.log(
    historyTable(
      rows,
      { ...stats, bestRatio, avgRatio },
      { plain: args.plain, noEmoji: args.noEmoji }
    )
  );

  // Achievements section
  const earned = achievements.filter((a) => a.earned);
  const inProgress = achievements.filter(
    (a) => !a.earned && a.progress !== undefined && a.progress > 0
  );

  if (shippedSessions.length === 0) {
    return 0;
  }

  if (args.plain) {
    console.log("Achievements:");
    if (earned.length === 0) {
      console.log("  Ship your first session to start earning these.");
    } else {
      for (const a of earned) {
        console.log(`  [x] ${a.name}: ${a.description}`);
      }
    }
    if (inProgress.length > 0) {
      console.log("\n  In progress:");
      for (const a of inProgress) {
        const pct = a.goal && a.progress !== undefined ? `${a.progress}/${a.goal}` : "";
        console.log(`  [ ] ${a.name} (${pct})`);
      }
    }
    console.log("");
    return 0;
  }

  const trophy = args.noEmoji ? "" : "🏆 ";
  console.log(c.brightYellow(c.bold(`${trophy}ACHIEVEMENTS`)));
  console.log(c.dim("─".repeat(74)));
  if (earned.length === 0) {
    console.log("  " + c.dim("Ship your first session to start earning these."));
  } else {
    for (const a of earned) {
      console.log(`  ${c.brightGreen("✓")} ${c.bold(a.name)}  ${c.dim(a.description)}`);
    }
  }
  if (inProgress.length > 0) {
    console.log("");
    console.log("  " + c.dim("In progress:"));
    for (const a of inProgress) {
      const pct = a.goal && a.progress !== undefined ? `${a.progress}/${a.goal}` : "—";
      console.log(`  ${c.dim("○")} ${c.dim(a.name)}  ${c.dim(`(${pct})`)}`);
    }
  }
  console.log("");
  return 0;
}
