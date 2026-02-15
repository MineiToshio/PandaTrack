export type PosthogTrackingProps = {
  posthogEvent?: string;
  posthogProps?: Record<string, unknown>;
};

type PosthogDataAttributes = Partial<Record<"data-ph-event" | "data-ph-props", string>>;

export function serializePosthogProps(posthogProps: Record<string, unknown> | undefined): string | undefined {
  if (!posthogProps) return undefined;

  try {
    return JSON.stringify(posthogProps);
  } catch {
    return undefined;
  }
}

export function getPosthogDataAttributes(
  posthogEvent: string | undefined,
  posthogProps: Record<string, unknown> | undefined,
): PosthogDataAttributes {
  if (!posthogEvent) return {};

  const serializedProps = serializePosthogProps(posthogProps);
  if (!serializedProps) {
    return { "data-ph-event": posthogEvent };
  }

  return {
    "data-ph-event": posthogEvent,
    "data-ph-props": serializedProps,
  };
}
