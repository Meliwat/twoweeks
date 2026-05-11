import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Session } from "./db.ts";
import { computeRatio, formatRatio, humanDuration, humanDurationSpoken } from "./format.ts";
import { milestoneFor } from "./flair.ts";

function fontsDir(): string {
  try {
    // @ts-ignore - bun specific
    if (typeof import.meta.dir === "string") return join(import.meta.dir, "..", "assets", "fonts");
  } catch {}
  return join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "fonts");
}

function loadFonts() {
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

// Catppuccin Mocha palette, with `dim` bumped from #6c7086 (3.4:1) to overlay2
// (#9399b2, ~7:1) so labels pass WCAG AA contrast against the bg.
const COLORS = {
  bg: "#1e1e2e",
  surface: "#313244",
  text: "#cdd6f4",
  subtext: "#a6adc8",
  dim: "#9399b2",
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
  slug?: string;
}

function truncate(s: string, n = 48): string {
  const chars = [...s];
  return chars.length > n ? chars.slice(0, n - 1).join("") + "…" : s;
}

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

// Short deterministic slug from a session for the footer stamp. NOT a security
// primitive; just helps a viewer correlate a screenshot with the user's CLI run.
export function sessionSlug(session: Session): string {
  const seed = `${session.id}|${session.task}|${session.started_at}|${session.shipped_at ?? 0}`;
  const h = createHash("sha256").update(seed).digest("hex");
  return h.slice(0, 6);
}

function cardTree(ctx: CardContext) {
  const ratioColor = brandStyle(ctx.ratio);
  const overBudget = ctx.ratio < 1;
  const savedMs = overBudget ? ctx.actualMs - ctx.etaMs : ctx.etaMs - ctx.actualMs;
  const savedLabel = overBudget ? "Cost" : "Saved";
  const savedSign = overBudget ? "−" : "+";

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
        // header row
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center" },
            children: [
              {
                type: "div",
                props: {
                  style: { color: COLORS.subtext, fontSize: "26px", fontWeight: 400 },
                  children: "twoweeks",
                },
              },
              {
                type: "div",
                props: {
                  style: { color: COLORS.subtext, fontSize: "20px", fontWeight: 400, letterSpacing: "3px" },
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
              marginTop: "28px",
              marginBottom: "28px",
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
              marginBottom: "24px",
            },
          },
        },
        // stats grid
        {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: "space-between", gap: "32px" },
            children: [
              statBlock("Task", truncate(ctx.task, 36), COLORS.text),
              statBlock("Estimated", ctx.etaText, COLORS.subtext),
              statBlock("Actual", humanDuration(ctx.actualMs), COLORS.yellow),
              statBlock(savedLabel, `${savedSign}${humanDuration(savedMs)}`, overBudget ? COLORS.red : COLORS.green),
            ],
          },
        },
        // milestone
        ctx.milestone
          ? {
              type: "div",
              props: {
                style: {
                  marginTop: "28px",
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
        // footer stamp (github URL + slug) so retweeted screenshots still point home
        {
          type: "div",
          props: {
            style: {
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: COLORS.dim,
              fontSize: "16px",
              fontWeight: 400,
            },
            children: [
              {
                type: "div",
                props: { children: "github.com/Meliwat/twoweeks" },
              },
              {
                type: "div",
                props: {
                  style: { letterSpacing: "1px" },
                  children: ctx.slug ? `#${ctx.slug}` : "",
                },
              },
            ],
          },
        },
      ],
    },
  };
}

function statBlock(label: string, value: string, valueColor: string) {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: "16px", color: COLORS.subtext, marginBottom: "6px", letterSpacing: "1px" },
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
    slug: sessionSlug(session),
  });
}

export async function renderSocialPreview(): Promise<Uint8Array> {
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

export function altTextPath(pngPath: string): string {
  return pngPath.replace(/\.png$/i, ".alt.txt");
}

/** Plain-text alt text for the PNG. Written as a sibling so screen-reader users
 *  who share the brag have something to paste as alt. */
export function altTextForSession(session: Session): string {
  if (session.shipped_at === null) return "";
  const actualMs = session.shipped_at - session.started_at;
  const ratio = computeRatio(session);
  const overBudget = ratio < 1;
  const verdict = overBudget ? "slower" : "faster";
  return [
    `twoweeks brag card.`,
    `Task: ${session.task}.`,
    `The AI estimated ${session.eta_text}.`,
    `Actually shipped in ${humanDurationSpoken(actualMs)}.`,
    `That is ${formatRatio(ratio)} ${verdict} than the AI estimated.`,
    `Source: github.com/Meliwat/twoweeks`,
  ].join(" ");
}

export function writeScreenshot(path: string, png: Uint8Array): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, png);
}

export function writeAltText(pngPath: string, altText: string): void {
  writeFileSync(altTextPath(pngPath), altText + "\n");
}
