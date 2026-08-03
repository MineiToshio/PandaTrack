import IntlMessageFormat from "intl-messageformat";
import { describe, expect, it } from "vitest";
import esImageIntake from "@/i18n/locales/es/imageIntake.json";
import esOrders from "@/i18n/locales/es/orders.json";

/**
 * The quota copy is quoted verbatim in the feature's design record, so these are assertions about
 * the exact sentences a collector reads, not about keys. They also compile every ICU pattern the
 * quota surfaces use, which is the one class of copy defect a mocked-translation component test
 * cannot catch: a malformed plural renders as a fallback at runtime, not as a failing build.
 */
function render(pattern: string, values: Record<string, unknown> = {}): string {
  return new IntlMessageFormat(pattern, "es").format(values) as string;
}

describe("photo quota copy (es)", () => {
  it("states the passive counter with the collector's own number", () => {
    expect(render(esImageIntake.quota.counter, { count: 17 })).toBe("Te quedan 17 fotos este mes");
    expect(render(esImageIntake.quota.counter, { count: 1 })).toBe("Te quedan 1 foto este mes");
  });

  it("explains the cost once, in photos, never in credits or tokens", () => {
    expect(esImageIntake.quota.explainer).toBe("Cada foto que subes gasta una de tu bolsa mensual.");
    expect(esImageIntake.quota.helper).toBe("Sube las fotos que necesites. Cada foto gasta una de tu cuota mensual.");
  });

  it("states both numbers and both remedies on the single interruption", () => {
    expect(render(esImageIntake.quota.overflow, { attached: 5, remaining: 3, excess: 2 })).toBe(
      "Vas a subir 5 fotos y te quedan 3. Quita 2 o guarda el resto para el mes que viene.",
    );
  });

  it("states what ran out, when it renews, and that the manual route stays unlimited", () => {
    const title = render(esImageIntake.quota.exhaustedTitle, { limit: 20 });
    const body = render(esImageIntake.quota.exhausted, { renewalDate: "1 de agosto" });

    expect(`${title} ${body}`).toBe(
      "Ya usaste tus 20 fotos con IA de este mes. Se renuevan el 1 de agosto. " +
        "Puedes seguir registrando pedidos a mano, sin límite y con todas las funciones.",
    );
    expect(esImageIntake.quota.exhaustedCta).toBe("Registrar a mano");
  });

  it("says foto everywhere, never extracción, crédito, or token", () => {
    const everySentence = Object.values(esImageIntake.quota).join(" ").toLowerCase();

    expect(everySentence).toContain("foto");
    expect(everySentence).not.toMatch(/extracci[óo]n|cr[ée]dito|token/);
  });

  it("renders the selector's remaining-photo line with the same wording", () => {
    expect(render(esOrders.createEntry.fromImage.photosRemaining, { count: 6 })).toBe("Te quedan 6 fotos este mes");
  });
});
