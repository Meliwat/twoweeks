// Status flair messages. Kept small and punchy on purpose — the joke wears
// out fast if every status line tries to be clever.
const STATUS_MESSAGES = [
  "The AI was sure of it.",
  "Plenty of time.",
  "The estimate stands.",
  "The AI is still confident.",
  "Worst case, the AI is right.",
  "The countdown continues.",
  "The AI did not factor in the existence of itself.",
  "Plenty of token budget for the wait.",
  "The estimate is firm. The AI insists.",
  "Trust the process.",
];

export function randomFlair(): string {
  return STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
}

export function milestoneFor(ratio: number): string | undefined {
  if (!isFinite(ratio)) {
    return "🌌  Submit this to Nature.";
  }
  if (ratio >= 1_000_000) {
    return "💥  Million-x compression. Frame it.";
  }
  if (ratio >= 100_000) {
    return "🔥  Six-figure compression. The AI is recalibrating.";
  }
  if (ratio >= 10_000) {
    return "🚀  Five-figure compression. Solid Tuesday.";
  }
  if (ratio >= 1_000) {
    return "✨  Four-figure compression.";
  }
  if (ratio >= 100) {
    return "🎯  Triple-digit compression.";
  }
  if (ratio >= 10) {
    return "👍  Double-digit compression.";
  }
  if (ratio >= 2) {
    return "📈  Faster than estimated.";
  }
  if (ratio >= 1) {
    return "🤝  Within a hair of the estimate.";
  }
  return "🐢  The AI was, against all odds, correct.";
}
