// "Kategorie objevů": the discovery categories of the previous CMS, copied from
// its category tree. The Czech names are kept exactly as they were there. (The
// old CMS also showed "Udělat hlavní" / "Hlavní" buttons beside some of them; that
// marks which category is the main one on an item, so it is not part of the
// terms.)
//
// Written as an indented list (two spaces per level) so it can be compared with
// the old CMS by eye; `parseTree` turns it into the { id, name, children } terms
// a taxonomy holds. An id is built from the names on the way down ("dc-" +
// the slugs joined by dashes), so "bary" under food and under nightlife get
// different ids, and an id never changes when the order does.
import { slugify } from "./slug";

export const DISCOVERY_CATEGORIES_ID = "discovery-categories";

const TREE = `
jídlo a pití
  bary
  bistra
  cukrárny
  delikatesy
  kavárny a čajovny
    čajovny
    kavárny
  pekařství
  pivní kultura
  restaurace
    afrika
    amerika
      severní amerika
      střední a jižní amerika
    asie
      asian fusion
      blízký východ
      jihovýchodní asie
      jižní asie
      střední asie
      východní asie
    austrálie
    česká tradiční kuchyně
    evropa
      jižní evropa
      severní evropa
      střední evropa
      východní evropa
      západní evropa
    smíšená kuchyně
  street food
  vinná kultura
    vinárny a vinotéky
    vinice
kultura
  divadla a operní scény
  galerie
  kina
    letní kina
  knihovny
  koncertní sály
  kulturní centra
  muzea
místa
  památky a architektura
    domy a vily
    hrady a zámky
    hřbitovy
    náměstí a ulice
    paláce
    sakrální stavby
    sochy a pomníky
    technické památky
    věže a rozhledny
  pražské věže
pěší trasy
q prague
trasy bez bariér
volný čas a zábava
  dobrodružství a zážitky
  nakupování
    dárky
    design
    knihy a antikvariáty
    móda
    obchodní centra
    šperky a hodinky
    starožitnosti
    trhy
    umělecká řemesla
  noční život
    bary
    kluby
  parky a zahrady
    botanické zahrady
    parky
    přírodní lokality
    zahrady
  relax a wellness
    lázně
    masáže
    sauny
  sport a pohyb
    bazény a koupaliště
    fitness a jóga
    golf
    skateparky a street spoty
    sportovní centra
    stadiony
    vodní sporty
  volnočasové areály
`;

function parseTree(text) {
  const roots = [];
  const stack = []; // the open term at each depth
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const depth = (line.length - line.trimStart().length) / 2;
    const name = line.trim();
    const parent = depth > 0 ? stack[depth - 1] : null;
    const term = { id: `${parent ? `${parent.id}-` : "dc-"}${slugify(name)}`, name, children: [] };
    (parent ? parent.children : roots).push(term);
    stack[depth] = term;
    stack.length = depth + 1;
  }
  return roots;
}

export const DISCOVERY_CATEGORIES_TAXONOMY = {
  id: DISCOVERY_CATEGORIES_ID,
  name: "Kategorie objevů",
  description: "Kategorie objevů ze starého CMS: jídlo a pití, kultura, místa, trasy, volný čas a zábava.",
  terms: parseTree(TREE),
};
