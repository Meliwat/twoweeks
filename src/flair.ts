const MESSAGES = [
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
  "Trust the system. The system is the AI.",
  "Day 0.005: your AI assistant remains confident.",
  "The AI is committed to this timeline.",
];

export function randomFlair(): string {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}
