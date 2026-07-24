import { prisma } from "@/lib/prisma";
import {
  getEditableStoreForRebase,
  type EditableStore,
  type EditableStoreDiff,
} from "@/lib/data/stores/storeGovernanceQueries";
import { rebaseChangeRequestDiff } from "@/lib/data/stores/storeGovernanceMutations";

/**
 * A single scalar field value, shaped for display. Booleans are kept as a tri-state so the client can
 * render localized yes / no / unset copy; text values pass through (null renders as an empty
 * placeholder).
 */
export type AdminChangeRequestScalarValue =
  { kind: "text"; value: string | null } | { kind: "bool"; value: boolean | null };

/**
 * One item of a list-valued field (channels, addresses, product types, countries, sales channels),
 * with its per-item delta against the current store. The stored diff replaces the whole list, so the
 * added / removed / kept split is derived server-side and the client only renders it.
 */
export type AdminChangeRequestListItem = {
  /** Stable token for React keys and equality (composed for object lists, the raw value otherwise). */
  token: string;
  /** Server-derived human label for the item. */
  label: string;
  delta: "added" | "removed" | "kept";
};

/**
 * A presentation-ready diff row for one changed field. Scalars carry the current and proposed value;
 * lists carry the itemized deltas. `alreadyApplied` is true when the current value already equals the
 * proposal (the rebase drops it and it is never re-written).
 */
export type AdminChangeRequestFieldRow =
  | {
      fieldKey: string;
      type: "scalar";
      current: AdminChangeRequestScalarValue;
      proposed: AdminChangeRequestScalarValue;
      alreadyApplied: boolean;
    }
  | {
      fieldKey: string;
      type: "list";
      items: AdminChangeRequestListItem[];
      alreadyApplied: boolean;
    };

/**
 * A pending change request as seen by an administrator: requester identity, comment, timestamps, the
 * rebased per-field diff, and the two diff-only drift signals. This is the only read path that
 * exposes the requester identity and the shaped diff; the public governance read model
 * (`getStoreGovernanceSummary`) returns counts only and is never widened. Callers must gate with
 * `requireAdmin()` (or the page-level admin check) before reading.
 */
export type AdminPendingStoreChangeRequest = {
  id: string;
  requester: { id: string; username: string; name: string };
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  fieldRows: AdminChangeRequestFieldRow[];
  /** Store-level drift signal: the store was written after this request was authored. */
  storeDriftedSinceSubmission: boolean;
  /** True when every proposed value already matches the store, so approval would supersede it. */
  effectiveDiffEmpty: boolean;
};

const TEXT_FIELDS = new Set(["name", "description", "logoUrl"]);
const BOOL_FIELDS = new Set(["hasStock", "receivesOrders", "isPrivate", "isActive"]);

type ObjectListEntry = { token: string; label: string };

function buildStringListItems(current: string[], proposed: string[]): AdminChangeRequestListItem[] {
  const currentSet = new Set(current);
  const proposedSet = new Set(proposed);
  const tokens = [...new Set([...current, ...proposed])].sort((left, right) => left.localeCompare(right));
  return tokens.map((token) => ({
    token,
    label: token,
    delta: proposedSet.has(token) ? (currentSet.has(token) ? "kept" : "added") : "removed",
  }));
}

function buildObjectListItems(current: ObjectListEntry[], proposed: ObjectListEntry[]): AdminChangeRequestListItem[] {
  const currentTokens = new Set(current.map((entry) => entry.token));
  const proposedTokens = new Set(proposed.map((entry) => entry.token));
  const labelByToken = new Map<string, string>();
  for (const entry of [...current, ...proposed]) {
    if (!labelByToken.has(entry.token)) labelByToken.set(entry.token, entry.label);
  }
  return [...labelByToken.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([token, label]) => ({
      token,
      label,
      delta: proposedTokens.has(token) ? (currentTokens.has(token) ? "kept" : "added") : "removed",
    }));
}

function contactChannelEntries(channels: EditableStore["contactChannels"]): ObjectListEntry[] {
  return channels.map((channel) => ({
    token: `${channel.type}|${channel.value}|${channel.label ?? ""}`,
    label: channel.label ? `${channel.label}: ${channel.value}` : channel.value,
  }));
}

function addressEntries(addresses: EditableStore["addresses"]): ObjectListEntry[] {
  return addresses.map((address) => ({
    token: `${address.city ?? ""}|${address.addressLine}|${address.reference ?? ""}`,
    label: address.city ? `${address.addressLine}, ${address.city}` : address.addressLine,
  }));
}

/** Builds one presentation-ready row per field present in the stored diff. */
function buildFieldRows(
  store: EditableStore,
  storedDiff: EditableStoreDiff,
  alreadyAppliedKeys: Set<string>,
): AdminChangeRequestFieldRow[] {
  const rows: AdminChangeRequestFieldRow[] = [];

  for (const fieldKey of Object.keys(storedDiff)) {
    const alreadyApplied = alreadyAppliedKeys.has(fieldKey);

    if (TEXT_FIELDS.has(fieldKey)) {
      const current = store[fieldKey as "name" | "description" | "logoUrl"] ?? null;
      const proposed = (storedDiff[fieldKey as "name" | "description" | "logoUrl"] ?? null) as string | null;
      rows.push({
        fieldKey,
        type: "scalar",
        current: { kind: "text", value: current },
        proposed: { kind: "text", value: proposed },
        alreadyApplied,
      });
      continue;
    }

    if (BOOL_FIELDS.has(fieldKey)) {
      const key = fieldKey as "hasStock" | "receivesOrders" | "isPrivate" | "isActive";
      const current = (store[key] ?? null) as boolean | null;
      const proposed = (storedDiff[key] ?? null) as boolean | null;
      rows.push({
        fieldKey,
        type: "scalar",
        current: { kind: "bool", value: current },
        proposed: { kind: "bool", value: proposed },
        alreadyApplied,
      });
      continue;
    }

    if (fieldKey === "presenceTypes") {
      rows.push({
        fieldKey,
        type: "list",
        items: buildStringListItems(store.presenceTypes, storedDiff.presenceTypes ?? []),
        alreadyApplied,
      });
      continue;
    }

    if (fieldKey === "productTypeKeys") {
      rows.push({
        fieldKey,
        type: "list",
        items: buildStringListItems(store.productTypeKeys, storedDiff.productTypeKeys ?? []),
        alreadyApplied,
      });
      continue;
    }

    if (fieldKey === "importCountries") {
      rows.push({
        fieldKey,
        type: "list",
        items: buildStringListItems(store.importCountryCodes, storedDiff.importCountries ?? []),
        alreadyApplied,
      });
      continue;
    }

    if (fieldKey === "contactChannels") {
      rows.push({
        fieldKey,
        type: "list",
        items: buildObjectListItems(
          contactChannelEntries(store.contactChannels),
          contactChannelEntries(storedDiff.contactChannels ?? []),
        ),
        alreadyApplied,
      });
      continue;
    }

    if (fieldKey === "addresses") {
      rows.push({
        fieldKey,
        type: "list",
        items: buildObjectListItems(addressEntries(store.addresses), addressEntries(storedDiff.addresses ?? [])),
        alreadyApplied,
      });
      continue;
    }
  }

  return rows;
}

/**
 * Lists every `PENDING` change request for a store, newest first, with requester identity and a
 * rebased, presentation-ready diff for the admin review surface. Server-only and admin-only: it must
 * never be reached from a public route, and it never widens the public governance read model.
 */
export async function getAdminPendingStoreChangeRequests(storeId: string): Promise<AdminPendingStoreChangeRequest[]> {
  const [store, storeMeta, requests] = await Promise.all([
    getEditableStoreForRebase(prisma, storeId),
    prisma.store.findUnique({ where: { id: storeId }, select: { updatedAt: true } }),
    prisma.storeChangeRequest.findMany({
      where: { storeId, status: "PENDING" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        changes: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        requestedBy: { select: { id: true, username: true, name: true } },
      },
    }),
  ]);

  if (!store || !storeMeta) return [];

  return requests.map((request) => {
    const storedDiff = (request.changes as EditableStoreDiff | null) ?? {};
    const { effectiveDiff, alreadyAppliedKeys } = rebaseChangeRequestDiff(store, storedDiff);
    const fieldRows = buildFieldRows(store, storedDiff, new Set(alreadyAppliedKeys));

    return {
      id: request.id,
      requester: request.requestedBy,
      comment: request.comment,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      fieldRows,
      storeDriftedSinceSubmission: storeMeta.updatedAt.getTime() > request.updatedAt.getTime(),
      effectiveDiffEmpty: Object.keys(effectiveDiff).length === 0,
    };
  });
}
