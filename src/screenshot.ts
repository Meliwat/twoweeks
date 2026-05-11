import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Session } from "./db.ts";
import { computeRatio, formatRatio, humanDuration } from "./format.ts";
import { milestoneFor } from "./flair.ts";

// Bun and Node both support import.meta.dir / import.meta.url. Build artifact
// inlines path; in dev we resolve relative to source.
function fontsDir(): string {
  // Bun-style: import.meta.dir works in both bun runtime and bun-built bundles.
  // Fallback for Node: derive from import.meta.url.
  // The dist bundle inlines the file contents at build time via the loadFonts()
  // function below using readFileSync with embedded paths.
  try {
    // @ts-ignore - bun specific
    if (typeof import.meta.dir === "string") return join(import.meta.dir, "..", "assets", "fonts");
  } catch {}
  return join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
}

function loadFonts() {
  // Try common locations for the fonts. In dev: ./assets/fonts. In a packaged
  // install: alongside the bundle.
  const candidates = [
    fontsDir(),
    join(process.cwd(), "assets", "fonts"),
    join(homedir(), ".twoweeks", "fonts"),
  ];

  for (const dir of candidates) {
    const bold = join(dir, "JetBrainsMono-Bold.ttf");
    const regular = join(dir, "JetBrainsMono-Regular.ttf");
    if (existsSync(bold) && existsSync(regular)) {
      return [
        { name: "JetBrains Mono", data: readFileSync(regular), weight: 400 as const, style: "normal" as const },
        { name: "JetBrains Mono", data: readFileSync(bold), weight: 700 as const, style: "normal" as const },
      ];
    }
  }
  throw new Error(
    "twoweeks: could not locate JetBrains Mono fonts. " +
      "Expected JetBrainsMono-Bold.ttf and JetBrainsMono-Regular.ttf in one of: " +
      candidates.join(", ")
  );
}

// Catppuccin Mocha palette
const COLORS = {
  bg: "#1e1e2e",
  surface: "#313244",
  text: "#cdd6f4",
  subtext: "#a6adc8",
  dim: "#6c7086",
  green: "#a6e3a1",
  brightGreen: "#94e2d5",
  yellow: "#f9e2af",
  red: "#f38ba8",
  blue: "#89b4fa",
  mauve: "#cba6f7",
};

interface CardContext {
  task: string;
  etaText: string;
  actualMs: number;
  etaMs: number;
  ratio: number;
  ratioText: string;
  milestone?: string;
}

function truncate(s: string, n = 48): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Strip leading emoji from text. JetBrains Mono has no emoji table; emoji glyphs
// render as boxes in satori output. We keep emoji in CLI output (terminals handle
// it natively) but remove them from PNG cards.
function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F100}-\u{1F1FF}]/gu, "")
    .trim();
}

function brandStyle(ratio: number): string {
  if (!isFinite(ratio)) return COLORS.mauve;
  if (ratio >= 1000) return COLORS.green;
  if (ratio >= 100) return COLORS.brightGreen;
  if (ratio >= 1) return COLORS.yellow;
  return COLORS.red;
}

function cardTree(ctx: CardContext) {
  const ratioColor = brandStyle(ctx.ratio);
  const overBudget = ctx.ratio < 1;
  const savedMs = overBudget ? ctx.actualMs - ctx.etaMs : ctx.etaMs - ctx.actualMs;
  const savedLabel = overBudget ? "Cost" : "Saved";

  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        padding: "56px 64px",
        fontFamily: "JetBrains Mono",
        position: "relative",
      },
      children: [
        // header
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
            children: [
              {
                type: "div",
                props: {
                  style: { color: COLORS.dim, fontSize: "26px", fontWeight: 400 },
                  children: "twoweeks",
                },
              },
              {
                type: "div",
                props: {
                  style: { color: COLORS.dim, fontSize: "20px", fontWeight: 400, letterSpacing: "3px" },
                  children: "SHIPPED",
                },
              },
            ],
          },
        },
        // hero ratio
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "32px",
              marginBottom: "32px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "176px",
                    fontWeight: 700,
                    color: ratioColor,
                    lineHeight: 1,
                  },
                  children: ctx.ratioText,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: "26px",
                    color: COLORS.subtext,
                    marginTop: "16px",
                  },
                  children: overBudget
                    ? "(the AI, against all odds, was right)"
                    : "faster than the AI thought",
                },
              },
            ],
          },
        },
        // divider
        {
          type: "div",
          props: {
            style: {
              height: "1px",
              backgroundColor: COLORS.surface,
              width: "100%",
              marginBottom: "28px",
            },
          },
        },
        // stats grid
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", gap: "32px" },
            children: [
              statBlock("Task", truncate(ctx.task, 36), COLORS.text, false),
              statBlock("Estimated", ctx.etaText, COLORS.subtext, false),
              statBlock("Actual", humanDuration(ctx.actualMs), COLORS.yellow, false),
              statBlock(savedLabel, humanDuration(savedMs), overBudget ? COLORS.red : COLORS.green, false),
            ],
          },
        },
        // milestone footer
        ctx.milestone
          ? {
              type: "div",
              props: {
                style: {
                  marginTop: "36px",
                  color: COLORS.yellow,
                  fontSize: "22px",
                  fontWeight: 700,
                  alignSelf: "center",
                  textAlign: "center",
                },
                children: stripEmoji(ctx.milestone),
              },
            }
          : { type: "div", props: { children: "" } },
      ],
    },
  };
}

function statBlock(label: string, value: string, valueColor: string, _bold: boolean) {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: "16px", color: COLORS.dim, marginBottom: "6px", letterSpacing: "1px" },
            children: label.toUpperCase(),
          },
        },
        {
          type: "div",
          props: {
            style: { fontSize: "28px", color: valueColor, fontWeight: 700 },
            children: value,
          },
        },
      ],
    },
  };
}

async function renderCard(ctx: CardContext): Promise<Uint8Array> {
  const fonts = loadFonts();
  const svg = await satori(cardTree(ctx) as any, {
    width: 1200,
    height: 630,
    fonts,
  });
  const png = new Resvg(svg, { background: COLORS.bg }).render().asPng();
  return png;
}

export async function renderShipCard(session: Session): Promise<Uint8Array> {
  if (session.shipped_at === null) throw new Error("Cannot render card for unshipped session");
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  return renderCard({
    task: session.task,
    etaText: session.eta_text,
    actualMs,
    etaMs: session.eta_ms,
    ratio,
    ratioText: formatRatio(ratio),
    milestone: milestoneFor(ratio),
  });
}

export async function renderSocialPreview(): Promise<Uint8Array> {
  // Evergreen card for GitHub social preview / og:image. Uses a sample
  // dramatic-but-plausible ratio.
  const sampleRatio = 425;
  return renderCard({
    task: "build the auth flow",
    etaText: "2 weeks",
    actualMs: 47 * 60 * 1000 + 12 * 1000,
    etaMs: 14 * 24 * 60 * 60 * 1000,
    ratio: sampleRatio,
    ratioText: formatRatio(sampleRatio),
    milestone: milestoneFor(sampleRatio),
  });
}

export function defaultScreenshotPath(sessionId: number): string {
  const dir = process.env.TWOWEEKS_HOME
    ? join(process.env.TWOWEEKS_HOME, "screenshots")
    : join(homedir(), ".twoweeks", "screenshots");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, `compression-${sessionId}.png`);
}

export function writeScreenshot(path: string, png: Uint8Array): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, png);
}
