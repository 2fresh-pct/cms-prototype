// "Kategorie akcí": the event categories, for the taxonomy of that name. Written as an
// indented list (two spaces per level). The old CMS also showed "Udělat hlavní" /
// "Hlavní" buttons beside some of them (which marks the main category of an item);
// that is not part of the terms. Ids are built from the names on the way down
// ("ka-" + the slugs joined by dashes).
import { slugify } from "./slug";

const TREE = `
akce
  festivaly a oslavy
    dny otevřených dveří
    festivaly
    oslavy a tradice
  koncerty
    hudební události
    klasická hudba
    klubová scéna
  představení
    alternativní divadlo
    balet
    černé a stínové divadlo
    činohra
    loutkové divadlo
    muzikály a hudební divadlo
    nový cirkus a fyzické divadlo
    opera
    současný tanec
  sport
  trendy a tipy
  trhy & gourmet
    gastronomické akce
    trhy
  výstavy a expozice
    architektura
    design
    fotografie
    modernistické umění
    muzejní výstavy
    současné umění
    staré umění
    tematické výstavy
`;

function parseTree(text) {
  const roots = [];
  const stack = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const depth = (line.length - line.trimStart().length) / 2;
    const name = line.trim();
    const parent = depth > 0 ? stack[depth - 1] : null;
    const term = { id: `${parent ? `${parent.id}-` : "ka-"}${slugify(name)}`, name, children: [] };
    (parent ? parent.children : roots).push(term);
    stack[depth] = term;
    stack.length = depth + 1;
  }
  return roots;
}

export const EVENT_CATEGORY_TERMS = parseTree(TREE);
