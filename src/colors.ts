// Minimal ANSI color helper. Strips colors when stdout is not a TTY (pipes, CI, redirects).
const TTY = process.stdout.isTTY;
const NO_COLOR = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
const ENABLED = TTY && !NO_COLOR;

function wrap(code: string): (text: string) => string {
  return (text: string) => (ENABLED ? `\x1b[${code}m${text}\x1b[0m` : text);
}

export const c = {
  bold: wrap("1"),
  dim: wrap("2"),
  italic: wrap("3"),
  underline: wrap("4"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  white: wrap("37"),
  brightRed: wrap("91"),
  brightGreen: wrap("92"),
  brightYellow: wrap("93"),
  brightCyan: wrap("96"),
  brightWhite: wrap("97"),
  bgRed: wrap("41"),
};

export const isColorEnabled = ENABLED;
