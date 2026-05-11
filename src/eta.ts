const UNITS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export function parseEta(text: string): { text: string; ms: number } {
  const match = text.trim().toLowerCase().match(/^(\d+)\s*(minute|hour|day|week|month)s?$/);
  if (!match) {
    throw new Error(
      `Could not parse ETA "${text}". Examples: "2 weeks", "3 months", "1 day", "5 hours".`
    );
  }
  const n = parseInt(match[1], 10);
  const unit = match[2];
  return { text: text.trim(), ms: n * UNITS[unit] };
}

/**
 * Sample ETA used only by the social-preview generator and the help-text
 * placeholder. Never used as a default for user-created sessions — the whole
 * point of the tool is to capture what the AI actually said.
 */
export const SAMPLE_ETA_TEXT = "2 weeks";
export const SAMPLE_ETA_MS = 14 * 24 * 60 * 60 * 1000;
