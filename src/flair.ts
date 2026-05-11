const STATUS_MESSAGES = [
  "Your AI is sure of it.",
  "Plenty of time.",
  "The estimate stands.",
  "Trust the process. The AI did the math.",
  "Still cooking time. The AI nods.",
  "The countdown continues.",
  "Confidence intact.",
  "Just give it time. The AI knows.",
  "Plenty of runway. The AI is rarely wrong about timelines.",
  "Bless the AI's heart.",
  "Still on schedule. According to the AI.",
  "The AI assistant has not yet questioned its estimate.",
  "Patience. Your AI did the math.",
  "The estimate is firm. The AI insists.",
  "The AI is calm.",
  "Day 5: your AI assistant has not been notified of recent developments.",
  "The AI is committed to this timeline.",
  "The AI did not factor in the existence of itself.",
  "Vibes-wise, the AI is unbothered.",
  "The AI has high conviction. Source: trust.",
  "The model card did not mention this scenario.",
  "Plenty of token budget for the wait.",
  "Worst case, the AI is right. Best case, you ship.",
  "The AI's training data did not include your laptop.",
  "Estimation is a hard problem. The AI nods regardless.",
];

export function randomFlair(): string {
  return STATUS_MESSAGES[Math.floor(Math.random() * STATUS_MESSAGES.length)];
}

export function milestoneFor(ratio: number): string | undefined {
  if (!isFinite(ratio)) {
    return "🌌  Time itself bent. Submit this to Nature.";
  }
  if (ratio >= 1_000_000) {
    return "💥  Million-x compression. Send screenshot to your AI's emergency contact.";
  }
  if (ratio >= 100_000) {
    return "🔥  Six-figure compression. Your AI is in stage one of grief.";
  }
  if (ratio >= 10_000) {
    return "🚀  Five-figure compression. The leaderboard called; you're on it.";
  }
  if (ratio >= 1_000) {
    return "✨  Four-figure compression. Frame this card.";
  }
  if (ratio >= 100) {
    return "🎯  Triple-digit compression. Your AI is recalibrating.";
  }
  if (ratio >= 10) {
    return "👍  Double-digit compression. Solid Tuesday.";
  }
  if (ratio >= 2) {
    return "📈  Faster than estimated. The AI quietly updates its priors.";
  }
  if (ratio >= 1) {
    return "🤝  Within a hair of the estimate. The AI feels seen.";
  }
  if (ratio >= 0.5) {
    return "🐢  Slower than estimated, but not by much. The AI was almost right.";
  }
  return "🦥  Significantly slower than estimated. The AI was, against all odds, correct.";
}
