import type { Session } from "./db.ts";
import { computeRatio } from "./format.ts";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress?: number;
  goal?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ratiosOf(sessions: Session[]): number[] {
  return sessions
    .filter((s) => s.shipped_at !== null && s.abandoned === 0)
    .map((s) => computeRatio(s));
}

function dayStreak(shipped: Session[]): number {
  if (shipped.length === 0) return 0;
  // Each shipped session contributes its "day" (UTC date). Find longest contiguous run.
  const days = new Set<string>();
  for (const s of shipped) {
    if (s.shipped_at === null) continue;
    days.add(new Date(s.shipped_at).toISOString().slice(0, 10));
  }
  const sortedDays = [...days].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1] + "T00:00:00Z").getTime();
    const here = new Date(sortedDays[i] + "T00:00:00Z").getTime();
    if (here - prev === DAY_MS) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function totalSavedMs(shipped: Session[]): number {
  let total = 0;
  for (const s of shipped) {
    if (s.shipped_at === null) continue;
    const actual = s.shipped_at - s.started_at;
    if (actual < s.eta_ms) total += s.eta_ms - actual;
  }
  return total;
}

export function computeAchievements(sessions: Session[]): Achievement[] {
  const shipped = sessions.filter((s) => s.shipped_at !== null && s.abandoned === 0);
  const ratios = ratiosOf(shipped);
  const finite = ratios.filter((r) => isFinite(r));
  const hasInfinity = ratios.some((r) => !isFinite(r));
  const has100x = finite.some((r) => r >= 100);
  const has1Kx = finite.some((r) => r >= 1000);
  const has1Mx = finite.some((r) => r >= 1_000_000);
  const overBudgets = ratios.filter((r) => r < 1).length;
  const longestStreak = dayStreak(shipped);
  const saved = totalSavedMs(shipped);

  return [
    {
      id: "first_ship",
      name: "First Ship",
      description: "Ship your first session.",
      earned: shipped.length >= 1,
      progress: Math.min(shipped.length, 1),
      goal: 1,
    },
    {
      id: "hat_trick",
      name: "Hat Trick",
      description: "Ship three sessions.",
      earned: shipped.length >= 3,
      progress: Math.min(shipped.length, 3),
      goal: 3,
    },
    {
      id: "marathon",
      name: "Marathon",
      description: "Ship ten sessions.",
      earned: shipped.length >= 10,
      progress: Math.min(shipped.length, 10),
      goal: 10,
    },
    {
      id: "centurion",
      name: "Centurion",
      description: "Ship one hundred sessions.",
      earned: shipped.length >= 100,
      progress: Math.min(shipped.length, 100),
      goal: 100,
    },
    {
      id: "100x_club",
      name: "100x Club",
      description: "Hit a triple-digit compression ratio.",
      earned: has100x,
    },
    {
      id: "1kx_club",
      name: "1000x Club",
      description: "Hit a four-figure compression ratio.",
      earned: has1Kx,
    },
    {
      id: "million_x_club",
      name: "Million-x Club",
      description: "Hit a seven-figure compression ratio.",
      earned: has1Mx,
    },
    {
      id: "time_bender",
      name: "Time Bender",
      description: "Ship in zero seconds (infinity ratio).",
      earned: hasInfinity,
    },
    {
      id: "estimation_slayer",
      name: "Estimation Slayer",
      description: "Honestly log five over-budget sessions. The AI was right; you're brave.",
      earned: overBudgets >= 5,
      progress: Math.min(overBudgets, 5),
      goal: 5,
    },
    {
      id: "streak_3",
      name: "Streak: 3 days",
      description: "Ship three days in a row.",
      earned: longestStreak >= 3,
      progress: Math.min(longestStreak, 3),
      goal: 3,
    },
    {
      id: "streak_7",
      name: "Streak: 7 days",
      description: "Ship seven days in a row.",
      earned: longestStreak >= 7,
      progress: Math.min(longestStreak, 7),
      goal: 7,
    },
    {
      id: "saved_month",
      name: "Saved a Month",
      description: "Cumulatively save 30 days of AI-estimated time.",
      earned: saved >= 30 * DAY_MS,
      progress: Math.min(saved, 30 * DAY_MS),
      goal: 30 * DAY_MS,
    },
    {
      id: "saved_year",
      name: "Saved a Year",
      description: "Cumulatively save 365 days of AI-estimated time.",
      earned: saved >= 365 * DAY_MS,
      progress: Math.min(saved, 365 * DAY_MS),
      goal: 365 * DAY_MS,
    },
  ];
}
