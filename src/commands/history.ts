import { getAllShipped, getStats } from "../db.ts";
import { computeRatio, historyTable } from "../format.ts";
import type { Session } from "../db.ts";

export function history(): number {
  const shippedSessions = getAllShipped();
  const stats = getStats();

  const ratios = shippedSessions.map((s) => computeRatio(s));
  const finiteRatios = ratios.filter((r) => isFinite(r));
  const bestRatio = finiteRatios.length > 0 ? Math.max(...finiteRatios) : null;
  const avgRatio =
    finiteRatios.length > 0
      ? Math.round(finiteRatios.reduce((a, b) => a + b, 0) / finiteRatios.length)
      : null;

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
