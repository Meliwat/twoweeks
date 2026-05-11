import { getAllShipped, getStats } from "../db.ts";
import { computeRatio, historyTable, formatRatio, humanDuration } from "../format.ts";
import type { Session } from "../db.ts";

export interface HistoryArgs {
  json?: boolean;
}

export function history(args: HistoryArgs = {}): number {
  const shippedSessions = getAllShipped();
  const stats = getStats();

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
        },
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
    historyTable(rows, {
      ...stats,
      bestRatio,
      avgRatio,
    })
  );
  return 0;
}
