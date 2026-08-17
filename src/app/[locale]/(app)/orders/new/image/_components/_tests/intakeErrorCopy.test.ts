import { describe, expect, it } from "vitest";
import enImageIntake from "@/i18n/locales/en/imageIntake.json";
import esImageIntake from "@/i18n/locales/es/imageIntake.json";
import { MAX_IMAGE_FILE_BYTES } from "@/lib/imageIntake/constants";
import {
  dimensionIssueMessage,
  extractErrorMessageKey,
  fileTooLargeMessage,
  serverDimensionMessage,
} from "../intakeErrorCopy";

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

  it("gives a wide crop and a small photo separate sentences, each with its own remedy", () => {
    const wide = dimensionIssueMessage(
      { code: "source-too-wide", width: 3000, height: 300, minSourceHeight: 556 },
      "Foto 2 (recorte.png)",
    );
    const small = dimensionIssueMessage(
      { code: "source-too-small", width: 150, height: 150, minDimension: 200 },
      "Foto 1 (miniatura.png)",
    );

    expect(wide.messageKey).toBe("photoTooWide");
    expect(wide.values).toEqual({ photo: "Foto 2 (recorte.png)", width: 3000, height: 300, minHeight: 556 });
    expect(small.messageKey).toBe("photoTooSmall");

    // Each sentence names the photo, quotes the measurement, and ends on something to do. Anything
    // less and the collector is back to guessing which of twenty screenshots is the problem.
    for (const message of [esErrors.photoTooWide, enErrors.photoTooWide]) {
      expect(message).toContain("{photo}");
      expect(message).toContain("{width}");
      expect(message).toContain("{height}");
      expect(message).toContain("{minHeight}");
    }
    expect(esErrors.photoTooWide).toContain("Recorta menos");
    expect(enErrors.photoTooWide).toContain("Crop less");
    expect(esErrors.photoTooSmall).toContain("Usa una captura más grande");
    expect(enErrors.photoTooSmall).toContain("Use a larger screenshot");

    // The two causes never share a sentence again: no message may hedge between small and large the
    // way the one it replaced did ("demasiado pequeña o demasiado grande para leerla").
    for (const message of [esErrors.photoTooSmall, esErrors.photoTooWide, esErrors.imageTooSmall]) {
      expect(message).not.toMatch(/pequeña o .*grande|grande o .*pequeña/);
    }
    expect(esErrors.photoTooWide).not.toContain("pequeña");
    expect(enErrors.photoTooWide).not.toContain("too small");
  });

  it("quotes a photo's real weight against the ceiling instead of naming no photo at all", () => {
    const message = fileTooLargeMessage("Foto 3 (captura.png)", 4.2 * 1024 * 1024);

    expect(message.messageKey).toBe("photoTooHeavy");
    expect(message.values).toEqual({ photo: "Foto 3 (captura.png)", size: 4.2, maxSize: 2 });
    expect(MAX_IMAGE_FILE_BYTES / (1024 * 1024)).toBe(2);
    expect(esErrors.photoTooHeavy).toContain("{size}");
    expect(esErrors.photoTooHeavy).toContain("{maxSize}");
  });

  it("resolves a server dimension refusal to the same two sentences, with the server's measurement", () => {
    expect(serverDimensionMessage("image-too-small", "Foto 1", 1080, 108)).toEqual({
      messageKey: "photoTooSmall",
      values: { photo: "Foto 1", width: 1080, height: 108, minDimension: 200 },
    });
    expect(serverDimensionMessage("image-too-large", "Foto 1", 5000, 9000).messageKey).toBe("photoTooLarge");

    // And the codes still have a fallback sentence for the case where no position came back.
    expect(extractErrorMessageKey("image-too-small")).toBe("imageTooSmall");
    expect(extractErrorMessageKey("image-too-large")).toBe("imageTooLarge");
    expect(esErrors.imageTooSmall).toContain("{minDimension}");
    expect(enErrors.imageTooLarge).toContain("{maxWidth}");
  });

  it("leaves the attachments reminder to the banner, which already states it once", () => {
    // The banner renders `errors.attachmentsKept` under every message while photos are attached, so
    // this sentence points at what to do with them instead of repeating that they are still there.
    expect(esErrors.attachmentsKept).toBe("Tus fotos siguen adjuntas.");
    expect(esErrors.noOrderFound).not.toContain(esErrors.attachmentsKept);
    expect(enErrors.noOrderFound).not.toContain(enErrors.attachmentsKept);
  });
});
