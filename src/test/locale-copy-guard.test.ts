import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

const SPANISH_LOCALES_DIR = join(process.cwd(), "src/i18n/locales/es");
const ENGLISH_LOCALES_DIR = join(process.cwd(), "src/i18n/locales/en");
// Spanish deliberately bans ítem everywhere in visible copy, including generic lists.
const GLOSSARY_AVOID_WORDS = ["ítem", "ítems", "item", "items"];
// Exclude ambiguous forms such as solo, este, mas, numero, pagina, envio, valido and codigo.
const ACCENTLESS_WORDS = [
  "ocurrio",
  "sesion",
  "paginacion",
  "telefono",
  "telefonos",
  "informacion",
  "numeracion",
  "accion",
  "direccion",
  "categoria",
  "categorias",
  "aqui",
  "tambien",
  "todavia",
  "menu",
  "menus",
  "conexion",
  "contrasena",
  "contrasenas",
  "manana",
  "espanol",
  "espana",
  "pais",
  "paises",
  "configuracion",
  "verificacion",
  "notificacion",
  "descripcion",
  "confirmacion",
  "creacion",
  "edicion",
  "eliminacion",
  "actualizacion",
  "moderacion",
  "opcion",
  "seleccion",
  "maximo",
  "maxima",
  "minimo",
  "minima",
  "proximo",
  "proxima",
  "proximos",
  "proximas",
  "despues",
  "ademas",
  "atras",
  "alli",
  "asi",
  "unico",
  "unica",
  "terminos",
  "politica",
];
const FORBIDDEN_WORDS = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${[...GLOSSARY_AVOID_WORDS, ...ACCENTLESS_WORDS].join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);
const ENGLISH_FORBIDDEN_WORDS = /(?<![\p{L}\p{N}_])(?:purchases?|shipments?)(?![\p{L}\p{N}_])/giu;
// Only this landing message describes physical shipping in marketing copy.
// The glossary exception permits shipment(s), never purchase(s) or in-app entity names.
const MARKETING_SHIPPING_PATHS = new Set(["src/i18n/locales/en/landing.json.features.cards.deliveries.description"]);

type Locale = "es" | "en";

function visibleText(elements: MessageFormatElement[]): string {
  return elements
    .map((element) => {
      if (element.type === TYPE.literal) return element.value;
      if (element.type === TYPE.tag) return visibleText(element.children);
      if (element.type === TYPE.select || element.type === TYPE.plural) {
        return Object.values(element.options)
          .map((option) => visibleText(option.value))
          .join(" ");
      }
      return " ";
    })
    .join("");
}

function collectViolations(value: unknown, path: string, locale: Locale = "es"): string[] {
  if (typeof value === "string") {
    const text = visibleText(parse(value)).normalize("NFC");
    const pattern = locale === "es" ? FORBIDDEN_WORDS : ENGLISH_FORBIDDEN_WORDS;
    return Array.from(text.matchAll(pattern))
      .filter((match) => !(locale === "en" && MARKETING_SHIPPING_PATHS.has(path) && /^shipments?$/i.test(match[0])))
      .map((match) => `${path}: ${match[0]}`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => collectViolations(child, `${path}[${index}]`, locale));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => collectViolations(child, `${path}.${key}`, locale));
  }
  return [];
}

function scanLocaleDirectory(directory: string, locale: Locale = "es"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return scanLocaleDirectory(file, locale);
    if (!entry.name.endsWith(".json")) return [];
    const messages: unknown = JSON.parse(readFileSync(file, "utf8"));
    return collectViolations(messages, relative(process.cwd(), file), locale);
  });
}

describe("Spanish locale copy guard", () => {
  it("uses canonical product terms and Spanish diacritics in every message", () => {
    expect(scanLocaleDirectory(SPANISH_LOCALES_DIR)).toEqual([]);
  });

  it("reports nested messages, array entries and ICU plural branches", () => {
    expect(
      collectViolations({ title: "Ocurrio", rows: ["{count, plural, one {# ítem} other {# items}}"] }, "fixture"),
    ).toEqual(["fixture.title: Ocurrio", "fixture.rows[0]: ítem", "fixture.rows[0]: items"]);
  });

  it("accepts corrected words, ambiguous forms and Unicode word boundaries", () => {
    expect(
      collectViolations(
        "Ocurrió, sesión, teléfono, información, producto. Solo este mas envio valido codigo. Sesiones, opciones, notificaciones. Ecosesion, sesioné, itemized.",
        "fixture",
      ),
    ).toEqual([]);
  });

  it("ignores ICU argument names and selector keys while checking visible branch text", () => {
    expect(
      collectViolations(
        "{item} {menu, select, menu {{sesion, plural, one {producto} other {productos}}} other {producto}}",
        "fixture",
      ),
    ).toEqual([]);
    expect(collectViolations("{item, select, menu {menu} other {producto}}", "fixture")).toEqual(["fixture: menu"]);
    expect(collectViolations("'{item}'", "fixture")).toEqual(["fixture: item"]);
  });
});

describe("English locale copy guard", () => {
  it("uses order and delivery terminology outside the scoped marketing exception", () => {
    expect(scanLocaleDirectory(ENGLISH_LOCALES_DIR, "en")).toEqual([]);
  });

  it("checks all forbidden word forms and ignores ICU identifiers", () => {
    expect(collectViolations("Purchase purchases SHIPMENT shipments", "fixture", "en")).toEqual([
      "fixture: Purchase",
      "fixture: purchases",
      "fixture: SHIPMENT",
      "fixture: shipments",
    ]);
    expect(
      collectViolations("{purchase} {shipment, select, purchases {order} other {delivery}}", "fixture", "en"),
    ).toEqual([]);
  });

  it("allows only shipment wording at the explicit physical-shipping marketing key", () => {
    const path = "src/i18n/locales/en/landing.json.features.cards.deliveries.description";
    expect(collectViolations("Shipment shipments", path, "en")).toEqual([]);
    expect(collectViolations("purchase", path, "en")).toEqual([`${path}: purchase`]);
    expect(collectViolations("shipment", "src/i18n/locales/en/landing.json.hero.subtitle", "en")).toEqual([
      "src/i18n/locales/en/landing.json.hero.subtitle: shipment",
    ]);
  });
});
