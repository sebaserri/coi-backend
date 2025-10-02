import { HeaderMap, parseAcord25Table } from "./acord25.table";

export type SectionId = "general" | "auto" | "umbrella";

const SECTION_DEFS: { id: SectionId; start: RegExp }[] = [
  { id: "general",  start: /\bgeneral\s+liab(?:ility)?\b/i },
  { id: "auto",     start: /\bautomobile\s+liab(?:ility)?\b|\bauto\s+liab\b/i },
  { id: "umbrella", start: /\bumbrella\b|\bexcess\s+liab(?:ility)?\b/i },
];

// Headers esperados por sección (puedes agregar variantes locales/abreviadas)
const HEADERS_GENERAL: HeaderMap = {
  eachOccurrence:       ["each occurrence", "occurrence each", "ea occ"],
  damageToPremises:     ["damage to premises (ea occ)", "damage to premises"],
  medExp:               ["med exp (any one person)", "medical expense"],
  personalAdvInjury:    ["personal & adv injury", "personal and advertising injury", "personal / advertising injury"],
  generalAggregate:     ["general aggregate", "policy general aggregate", "gen aggregate", "gen agg"],
  productsCompOpAgg:    ["products - comp/op agg","products completed operations aggregate","prod & compl ops aggregate","products comp/op agg"],
};

const HEADERS_AUTO: HeaderMap = {
  autoCombinedSingleLimit: ["combined single limit", "each accident", "csl"],
  // agrega si quieres: "autoBodilyInjuryPerPerson", "autoBodilyInjuryPerAccident", etc.
};

const HEADERS_UMBRELLA: HeaderMap = {
  umbrellaEachOccurrence: ["each occurrence", "each occ"],
  umbrellaAggregate:      ["aggregate", "agg", "policy aggregate"],
};

function splitSections(fullText: string) {
  const lines = fullText.split(/\r?\n/);
  const hits: { idx: number; id: SectionId }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    for (const def of SECTION_DEFS) {
      if (def.start.test(l)) {
        hits.push({ idx: i, id: def.id });
      }
    }
  }
  if (!hits.length) {
    // si no detectamos secciones, devolvemos todo como "general"
    return { general: fullText, auto: "", umbrella: "" };
  }

  // ordenar por idx y cortar hasta el inicio de la siguiente
  hits.sort((a, b) => a.idx - b.idx);
  const blocks: Record<SectionId, string> = { general: "", auto: "", umbrella: "" };

  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const start = cur.idx;
    const end = next ? next.idx : lines.length;
    const slice = lines.slice(start, end).join("\n");
    blocks[cur.id] += (blocks[cur.id] ? "\n" : "") + slice;
  }

  return blocks;
}

export function parseAcord25BySections(
  fullText: string,
  options?: { generalHeaders?: HeaderMap; autoHeaders?: HeaderMap; umbrellaHeaders?: HeaderMap; minPlausibleAmount?: number; headerSimilarityMin?: number; }
) {
  const blocks = splitSections(fullText);
  const genHdrs = options?.generalHeaders || HEADERS_GENERAL;
  const autHdrs = options?.autoHeaders || HEADERS_AUTO;
  const umbHdrs = options?.umbrellaHeaders || HEADERS_UMBRELLA;

  const tableOpts = {
    headerSimilarityMin: options?.headerSimilarityMin ?? 0.55,
    minPlausibleAmount: options?.minPlausibleAmount ?? 100000,
  };

  const general = blocks.general ? parseAcord25Table(blocks.general, genHdrs, tableOpts) : {};
  const auto    = blocks.auto    ? parseAcord25Table(blocks.auto,    autHdrs, tableOpts) : {};
  const umbrella= blocks.umbrella? parseAcord25Table(blocks.umbrella,umbHdrs, tableOpts) : {};

  return { general, auto, umbrella };
}
