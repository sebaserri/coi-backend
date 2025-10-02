/** Utils **************************************************************/
function norm(s: string) {
  return s.normalize("NFKD").replace(/\s+/g, " ").trim();
}
function onlyText(s: string) {
  return norm(s).toLowerCase().replace(/[^a-z0-9\s]/g, "");
}
function parseMoney(raw?: string): number | undefined {
  if (!raw) return;
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return;
  const n = Number(s.replace(/,/g, ""));
  if (!isFinite(n)) return;
  return n;
}
function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
function similarity(a: string, b: string) {
  const A = onlyText(a), B = onlyText(b);
  const d = levenshtein(A, B);
  return 1 - d / Math.max(A.length || 1, B.length || 1);
}

/** API de headers esperados *******************************************/
export type HeaderMap = Record<string, string[]>;

export type TableParseOptions = {
  headerSimilarityMin?: number; // 0..1 (default 0.55)
  minPlausibleAmount?: number;  // >= para evitar falsos positivos (default 100000)
};

const DEFAULTS: Required<TableParseOptions> = {
  headerSimilarityMin: 0.55,
  minPlausibleAmount: 100000,
};

/** Detección de la fila de encabezados *********************************/
function measureHeaderColumns(headerLine: string, headers: HeaderMap, opts: Required<TableParseOptions>) {
  const cols: Record<string, number> = {};
  const lower = headerLine.toLowerCase();

  function approxX(label: string) {
    const i = lower.indexOf(label.toLowerCase());
    return i >= 0 ? i : undefined;
  }

  for (const outKey of Object.keys(headers)) {
    const candidates = headers[outKey];
    let best: { sim: number; x: number } | null = null;
    for (const cand of candidates) {
      const idx = approxX(cand);
      const sim = similarity(headerLine, cand);
      const x = idx !== undefined ? idx : Math.max(0, Math.floor(headerLine.length * 0.5));
      if (!best || sim > best.sim) best = { sim, x };
    }
    if (best && best.sim >= opts.headerSimilarityMin) cols[outKey] = best.x;
  }
  return cols;
}

function detectHeaderLine(lines: string[], headers: HeaderMap, opts: Required<TableParseOptions>) {
  let bestIdx = -1;
  let bestScore = 0;
  let bestCols: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = norm(lines[i]);
    if (!line) continue;
    const cols = measureHeaderColumns(line, headers, opts);
    const score = Object.keys(cols).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestCols = cols;
    }
  }
  if (bestIdx >= 0 && bestScore >= 2) return { index: bestIdx, columns: bestCols };
  return null;
}

/** Asignar monto por proximidad horizontal **********************************/
function pickAmountForColumn(line: string, colX: number, minAmount: number): number | undefined {
  const pieces = Array.from(line.matchAll(/\S+/g)).map((m) => ({
    text: m[0],
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
  const monies = pieces
    .map((p) => ({ ...p, value: parseMoney(p.text), x: p.start }))
    .filter((p) => p.value && p.value >= minAmount) as Array<{text:string;start:number;end:number;value:number;x:number}>;
  if (!monies.length) return;

  let best = monies[0];
  let bestDist = Math.abs(best.x - colX);
  for (const m of monies) {
    const d = Math.abs(m.x - colX);
    if (d < bestDist) { best = m; bestDist = d; }
  }
  return best.value;
}

/** Parser principal **********************************************************/
export function parseAcord25Table(fullText: string, headers: HeaderMap, options?: TableParseOptions): Record<string, number> {
  const opts = { ...DEFAULTS, ...(options || {}) };

  const rawLines = fullText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const header = detectHeaderLine(rawLines, headers, opts);
  if (!header) return {};

  const { index: headerIdx, columns: colXs } = header;
  const out: Record<string, number> = {};

  const maxLookahead = 12;
  for (let i = headerIdx + 1; i < Math.min(rawLines.length, headerIdx + 1 + maxLookahead); i++) {
    const line = rawLines[i];
    if (/^\s*(producer|insured|certificate holder|policy|coverages|automobile|umbrella|excess)\b/i.test(line)) break;

    for (const key of Object.keys(colXs)) {
      const x = colXs[key];
      const amt = pickAmountForColumn(line, x, opts.minPlausibleAmount);
      if (amt && out[key] === undefined) out[key] = amt;
    }
  }

  return out;
}
