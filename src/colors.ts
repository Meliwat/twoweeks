// Minimal ANSI color helper. Strips colors when stdout is not a TTY, when
// NO_COLOR is set (per https://no-color.org), or when --no-color was passed.
// Detection happens LAZILY on every call so flags processed after import still
// take effect.
function colorsEnabled(): boolean {
  if (!process.stdout.isTTY) return false;
  const nc = process.env.NO_COLOR;
  if (nc !== undefined && nc !== "") return false;
  return true;
}

function wrap(code: string): (text: string) => string {
  return (text: string) =>
    colorsEnabled() ? `\x1b[${code}m${text}\x1b[0m` : text;
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

export const isColorEnabled = colorsEnabled;
