import { describe, expect, it } from "vitest";
import enImageIntake from "@/i18n/locales/en/imageIntake.json";
import esImageIntake from "@/i18n/locales/es/imageIntake.json";
import { extractErrorMessageKey } from "../intakeErrorCopy";

type ErrorCopy = Record<string, string>;

const esErrors = esImageIntake.errors as ErrorCopy;
const enErrors = enImageIntake.errors as ErrorCopy;

/**
 * The failure-code mapping and the sentences a collector reads live two files apart, so a code can
 * point at a key that exists in one locale only, and nothing fails until someone hits that exact
 * failure and reads a raw key inside the error banner.
 */
describe("intake error copy", () => {
  it("defines every error message in both locales", () => {
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(esErrors).sort());
  });

  it("tells a collector whose photos held no order what went wrong and what to try", () => {
    expect(extractErrorMessageKey("no-order-found")).toBe("noOrderFound");
    expect(esErrors.noOrderFound).toBe(
      "No encontramos ningún pedido en esas fotos. Suele pasar cuando la foto es solo del producto: " +
        "necesitamos ver la conversación o el recibo, donde salgan los productos y los montos. " +
        "Quita la foto que no corresponde y prueba con otra.",
    );
    expect(enErrors.noOrderFound).toBeTruthy();
  });

  it("tells a collector whose photos held several purchases to upload one order at a time", () => {
    expect(extractErrorMessageKey("multiple-orders")).toBe("multipleOrders");
    // Three things this message has to carry: what we saw, the rule, and the next step. The rule
    // matters most, because "one order at a time" is not obvious on a screen that accepts twenty
    // photos, and the collector must not read it as "one product at a time".
    expect(esErrors.multipleOrders).toContain("varias compras distintas");
    expect(esErrors.multipleOrders).toContain("por separado");
    expect(esErrors.multipleOrders).toContain("varios productos");
    expect(enErrors.multipleOrders).toContain("several separate purchases");
    expect(enErrors.multipleOrders).toContain("on its own");
    expect(enErrors.multipleOrders).toContain("several products");
  });

  it("never invites a retry on a failure that is deterministic and ours", () => {
    // `provider-rejected` is a 4xx: the API refused what we build, so the next attempt fails
    // identically. The old copy for it promised "try again in a minute", which sent collectors to
    // spend their photos on something that could not work. The message has to own the failure
    // without blaming the collector and without offering a remedy that is not one.
    expect(extractErrorMessageKey("provider-rejected")).toBe("providerRejected");
    expect(esErrors.providerRejected).toContain("No se soluciona reintentando");
    expect(esErrors.providerRejected).toContain("ya estamos avisados");
    expect(esErrors.providerRejected).toContain("a mano");
    expect(enErrors.providerRejected).toContain("Trying again will not fix it");
    expect(enErrors.providerRejected).toContain("notified");
    expect(enErrors.providerRejected).toContain("by hand");

    // The retryable sibling keeps its retry, because for a 5xx or a timeout the retry is honest.
    expect(extractErrorMessageKey("provider-error")).toBe("providerError");
    expect(esErrors.providerError).toContain("Inténtalo de nuevo");
  });

  it("leaves the attachments reminder to the banner, which already states it once", () => {
    // The banner renders `errors.attachmentsKept` under every message while photos are attached, so
    // this sentence points at what to do with them instead of repeating that they are still there.
    expect(esErrors.attachmentsKept).toBe("Tus fotos siguen adjuntas.");
    expect(esErrors.noOrderFound).not.toContain(esErrors.attachmentsKept);
    expect(enErrors.noOrderFound).not.toContain(enErrors.attachmentsKept);
  });
});
