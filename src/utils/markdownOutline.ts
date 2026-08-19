export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface MarkdownHeading {
  index: number;
  level: MarkdownHeadingLevel;
  text: string;
}

const ATX_HEADING_PATTERN = /^\s{0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/;
const SETEXT_HEADING_PATTERN = /^\s{0,3}(=+|-+)\s*$/;
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,})/;

function cleanHeadingText(value: string) {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSetextCandidate(line: string) {
  return line.trim().length > 0
    && !/^\s{0,3}#/.test(line)
    && !/^\s{0,3}(?:[-*+]|\d+[.)])\s/.test(line)
    && !/^\s{0,3}>/.test(line);
}

function addHeading(headings: MarkdownHeading[], level: MarkdownHeadingLevel, rawText: string) {
  const text = cleanHeadingText(rawText);
  if (!text) return;
  headings.push({ index: headings.length, level, text });
}

export function parseMarkdownOutline(markdown: string): MarkdownHeading[] {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  let fenceChar: "`" | "~" | null = null;
  let fenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(FENCE_PATTERN);

    if (fence) {
      const marker = fence[1];
      const markerChar = marker[0] as "`" | "~";
      if (!fenceChar) {
        fenceChar = markerChar;
        fenceLength = marker.length;
      } else if (markerChar === fenceChar && marker.length >= fenceLength) {
        fenceChar = null;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceChar) continue;

    const atx = line.match(ATX_HEADING_PATTERN);
    if (atx) {
      addHeading(headings, atx[1].length as MarkdownHeadingLevel, atx[2] ?? "");
      continue;
    }

    const underline = lines[index + 1]?.match(SETEXT_HEADING_PATTERN);
    if (underline && isSetextCandidate(line)) {
      addHeading(headings, underline[1][0] === "=" ? 1 : 2, line);
      index += 1;
    }
  }

  return headings;
}
