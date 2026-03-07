#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKETS_DIR = path.join(__dirname, "..", "docs", "product", "feature-packets");

const STATUS = {
  DONE: "done",
  IN_PROGRESS: "in_progress",
  READY: "ready",
  PLANNED: "planned",
  BLOCKED: "blocked",
  OTHER: "other",
};

function normalizeStatus(rawStatus) {
  const normalized = rawStatus.toLowerCase().trim();

  if (normalized.includes("in progress") || normalized.includes("in-progress") || normalized === "active") {
    return STATUS.IN_PROGRESS;
  }
  if (normalized.startsWith("done")) {
    return STATUS.DONE;
  }
  if (normalized.includes("ready")) {
    return STATUS.READY;
  }
  if (normalized.includes("planned")) {
    return STATUS.PLANNED;
  }
  if (normalized.includes("blocked")) {
    return STATUS.BLOCKED;
  }
  if (normalized.includes("implemented") || normalized.includes("completed") || normalized === "complete") {
    return STATUS.DONE;
  }

  return STATUS.OTHER;
}

function parseMetadataValue(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^- ${escapedKey}:\\s*\\\`([^\\\`]+)\\\``, "m"));
  return match ? match[1].trim() : null;
}

function parseSlices(content) {
  const slices = [];
  const sliceRegex =
    /### Slice\s+(\d+)\s*-\s*(.+?)\n([\s\S]*?)(?=\n### Slice\s+\d+\s*-|\n##\s+\d+\)|$)/g;

  for (const match of content.matchAll(sliceRegex)) {
    const number = Number.parseInt(match[1], 10);
    const title = match[2].trim();
    const body = match[3];

    const statusMatch = body.match(/^- Status:\s*`([^`]+)`/m);
    const rawStatus = statusMatch ? statusMatch[1].trim() : "Unknown";

    slices.push({
      number,
      title,
      rawStatus,
      normalizedStatus: normalizeStatus(rawStatus),
    });
  }

  return slices.sort((a, b) => a.number - b.number);
}

function formatSlice(slice) {
  if (!slice) {
    return "No slices";
  }

  return `Slice ${slice.number} - ${slice.title} [${slice.rawStatus}]`;
}

function firstActionableSlice(slices) {
  return slices.find((slice) => slice.normalizedStatus === STATUS.IN_PROGRESS) ??
    slices.find((slice) => slice.normalizedStatus === STATUS.BLOCKED) ??
    slices.find((slice) => slice.normalizedStatus === STATUS.PLANNED || slice.normalizedStatus === STATUS.READY) ??
    null;
}

function firstIncompleteSlice(slices) {
  return slices.find((slice) => slice.normalizedStatus !== STATUS.DONE) ?? null;
}

function inferPacketStatus(rawStatus, slices) {
  const normalizedMetadataStatus = normalizeStatus(rawStatus);
  const hasInProgressSlice = slices.some((slice) => slice.normalizedStatus === STATUS.IN_PROGRESS);
  const hasBlockedSlice = slices.some((slice) => slice.normalizedStatus === STATUS.BLOCKED);
  const hasDoneSlice = slices.some((slice) => slice.normalizedStatus === STATUS.DONE);
  const hasIncompleteSlice = slices.some((slice) => slice.normalizedStatus !== STATUS.DONE);
  const allSlicesDone = slices.length > 0 && slices.every((slice) => slice.normalizedStatus === STATUS.DONE);

  if (allSlicesDone) {
    return STATUS.DONE;
  }

  if (hasInProgressSlice) {
    return STATUS.IN_PROGRESS;
  }

  if (hasBlockedSlice) {
    return STATUS.BLOCKED;
  }

  if (hasDoneSlice && hasIncompleteSlice) {
    return STATUS.IN_PROGRESS;
  }

  return normalizedMetadataStatus;
}

async function loadPackets() {
  const entries = await fs.readdir(PACKETS_DIR, { withFileTypes: true });

  const packetFiles = entries
    .filter((entry) => entry.isFile() && /^FEAT-\d{4}-.+\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const packets = [];

  for (const fileName of packetFiles) {
    const fullPath = path.join(PACKETS_DIR, fileName);
    const content = await fs.readFile(fullPath, "utf8");

    const idMatch = fileName.match(/^(FEAT-\d{4})-/);
    const id = idMatch ? idMatch[1] : fileName;

    const headingMatch = content.match(/^#\s+Feature Packet\s*-\s*(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : fileName;

    const rawStatus = parseMetadataValue(content, "Status") ?? "Unknown";
    const slices = parseSlices(content);

    packets.push({
      id,
      fileName,
      heading,
      rawStatus,
      normalizedStatus: inferPacketStatus(rawStatus, slices),
      slices,
      currentOrNextSlice: firstActionableSlice(slices),
      firstIncompleteSlice: firstIncompleteSlice(slices),
    });
  }

  return packets;
}

function printPacketsSummary(packets) {
  const inProgress = packets.filter((packet) => packet.normalizedStatus === STATUS.IN_PROGRESS);
  const blocked = packets.filter((packet) => packet.normalizedStatus === STATUS.BLOCKED);

  console.log("Feature packets status");
  console.log("======================");
  console.log(`Total packets: ${packets.length}`);
  console.log(`In progress: ${inProgress.length}`);
  console.log(`Blocked: ${blocked.length}`);
  console.log("");

  if (inProgress.length === 0) {
    console.log("In-progress packets: none");
  } else {
    console.log("In-progress packets:");
    for (const packet of inProgress) {
      console.log(`- ${packet.id} | ${packet.heading}`);
      console.log(`  Next slice: ${formatSlice(packet.currentOrNextSlice)}`);
    }
  }

  console.log("");

  if (blocked.length > 0) {
    console.log("Blocked packets:");
    for (const packet of blocked) {
      console.log(`- ${packet.id} | ${packet.heading}`);
      console.log(`  Blocked slice: ${formatSlice(packet.currentOrNextSlice)}`);
    }
    console.log("");
  }

  const recommendedFromInProgress = inProgress
    .map((packet) => ({ packet, slice: packet.currentOrNextSlice }))
    .find((candidate) => candidate.slice !== null);

  const recommendedFromBlocked = blocked
    .map((packet) => ({ packet, slice: packet.currentOrNextSlice }))
    .find((candidate) => candidate.slice !== null);

  const readyOrPlannedPackets = packets.filter(
    (packet) => packet.normalizedStatus === STATUS.READY || packet.normalizedStatus === STATUS.PLANNED,
  );

  const recommendedFromReady = readyOrPlannedPackets
    .map((packet) => ({ packet, slice: packet.firstIncompleteSlice }))
    .find((candidate) => candidate.slice !== null);

  const recommended = recommendedFromBlocked ?? recommendedFromInProgress ?? recommendedFromReady ?? null;

  if (!recommended) {
    console.log("Recommended next slice: none (all packets/slices appear complete).");
    return;
  }

  console.log(
    `Recommended next slice: ${recommended.packet.id} | ${formatSlice(recommended.slice)} | Packet status: ${recommended.packet.rawStatus}`,
  );
}

async function main() {
  const packets = await loadPackets();
  printPacketsSummary(packets);
}

main().catch((error) => {
  console.error("Failed to read feature packets:", error);
  process.exit(1);
});
