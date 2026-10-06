/**
 * Stream E verification: giving-goal family share links.
 *
 * Run: node_modules/.bin/tsx scripts/verify-stream-e.ts
 *
 * Covers:
 *  1. Store unit tests: create / get / list (per-goal filter) / revoke /
 *     syncGoalProgress / hash parse / share URL builder.
 *  2. Privacy: share IDs are unguessable UUIDs; the stored record and the
 *     rendered family view contain ZERO kid PII even when the source goal
 *     is full of it.
 *  3. Revoked / unknown links render the friendly "no longer active" state
 *     and leak no goal details.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/* ---------- browser shims ---------- */
// The store mirrors the browser environment: it requires both `window`
// and `localStorage` (exactly as the real app has).
const g = globalThis as unknown as Record<string, { [k: string]: unknown } & { addEventListener?: () => void }>;
g.window = {
  location: { origin: "https://app.example", pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
};
const ls = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => (ls.has(k) ? (ls.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    ls.set(k, v);
  },
  removeItem: (k: string) => {
    ls.delete(k);
  },
  clear: () => ls.clear(),
};

const {
  givingShareStore,
  buildShareInputFromGoal,
  familyShareMessage,
  givingShareUrl,
  parseGivingHash,
} = await import("@/lib/giving-share-store");
const { GivingShareContent } = await import("@/app/components/GivingShareView");
import type { SavingsGoal } from "@/lib/types";

/* ---------- helpers ---------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function render(share: Parameters<typeof GivingShareContent>[0]["share"]): string {
  return renderToStaticMarkup(createElement(GivingShareContent, { share }));
}

/* ---------- 1. store unit tests ---------- */
console.log("— store: create/get/list/revoke/sync —");

const shareA = await givingShareStore.createShare({
  goalId: "goal-1",
  goalTitle: "Save for the animal shelter",
  cause: "Animal shelter",
  saved: 12,
  target: 50,
  parentName: "Naveen",
  parentMessage: "Hi! If you'd like to chip in, just let me know.",
});
assert.match(shareA.id, UUID_RE, "share id must be an unguessable UUID");
assert.equal(shareA.status, "active");

const shareB = await givingShareStore.createShare({
  goalId: "goal-2",
  goalTitle: "New bike fund",
  cause: "A special toy",
  saved: 5,
  target: 100,
  parentName: "A TailTots parent",
  parentMessage: "Chipping in through me!",
});
assert.notEqual(shareA.id, shareB.id, "ids must be unique");
assert.match(shareB.id, UUID_RE);

assert.deepEqual(await givingShareStore.getShare(shareA.id), shareA, "getShare returns the record");
assert.equal(await givingShareStore.getShare("nope-not-real"), null, "unknown id returns null");

const all = await givingShareStore.listShares();
assert.equal(all.length, 2, "listShares returns all shares");
assert.ok(all[0].createdAt >= all[1].createdAt, "newest first");
const forGoal1 = await givingShareStore.listShares("goal-1");
assert.equal(forGoal1.length, 1, "listShares filters by goalId");
assert.equal(forGoal1[0].id, shareA.id);

// Progress sync keeps the family view fresh.
await givingShareStore.syncGoalProgress("goal-1", 30, 50);
assert.equal((await givingShareStore.getShare(shareA.id))!.saved, 30, "sync updates saved");
assert.equal((await givingShareStore.getShare(shareB.id))!.saved, 5, "other goals untouched");

// Revoke.
const revoked = await givingShareStore.revokeShare(shareA.id);
assert.equal(revoked!.status, "revoked", "revoke flips status");
assert.ok(revoked!.revokedAt, "revoke stamps revokedAt");
await givingShareStore.syncGoalProgress("goal-1", 40, 50);
assert.equal((await givingShareStore.getShare(shareA.id))!.saved, 30, "revoked shares are not re-synced");
assert.equal(await givingShareStore.revokeShare("nope-not-real"), null, "revoke of unknown id returns null");

/* ---------- hash + URL helpers ---------- */
console.log("— hash parsing + share URL —");
assert.equal(parseGivingHash(`#giving/${shareB.id}`), shareB.id);
assert.equal(parseGivingHash("#giving/"), null);
assert.equal(parseGivingHash("#playdate/abc"), null);
assert.equal(parseGivingHash(""), null);
assert.equal(parseGivingHash("#giving/abc/def"), null);
const url = givingShareUrl(shareB.id);
assert.ok(url.endsWith(`#giving/${shareB.id}`), "share URL embeds the id in the hash");
assert.equal(url, `https://app.example/#giving/${shareB.id}`, "share URL is a full absolute link");

/* ---------- 2. PII leak test ---------- */
console.log("— privacy: no kid PII in record or rendered view —");

const kidLoadedGoal: SavingsGoal = {
  id: "goal-kid-9",
  childId: "kid-aarush-9",
  title: "Aarush's shelter fundraiser",
  target: 50,
  saved: 12,
  type: "donation",
  causeNote: "Aarush's class project at Lilyana Elementary",
  sharedWithTrustedFamilies: true,
};

// Parent reviews the family-facing text; defaults must NOT smuggle raw
// causeNote / childId into the snapshot.
const input = buildShareInputFromGoal(kidLoadedGoal, {
  goalTitle: "Animal shelter fundraiser",
  parentName: "Naveen",
  parentMessage: "Hi! Our family is working toward this. Let me know to chip in!",
});
assert.equal(input.goalId, kidLoadedGoal.id);
assert.ok(!("childId" in input), "childId must not exist on the share input");
assert.ok(!JSON.stringify(input).includes("aarush"), "kid name must not be in the share input (lowercase check)");
assert.ok(!JSON.stringify(input).includes("Lilyana"), "school must not be in the share input");
assert.equal(input.cause, "Charity donation", "default cause is the generic label, not the raw causeNote");

const piiShare = await givingShareStore.createShare(input);
const recordJson = JSON.stringify(piiShare);
for (const leak of ["kid-aarush-9", "Aarush", "aarush", "Lilyana", "class project"]) {
  assert.ok(!recordJson.includes(leak), `stored record must not contain: ${leak}`);
}

const html = render(piiShare);
for (const leak of ["kid-aarush-9", "Aarush", "aarush", "Lilyana", "class project"]) {
  assert.ok(!html.includes(leak), `rendered family view must not contain: ${leak}`);
}
// …and it must still show exactly what the spec requires:
assert.ok(html.includes("Animal shelter fundraiser"), "view shows the goal name");
assert.ok(html.includes("Charity donation"), "view shows the cause");
assert.ok(html.includes("$12") && html.includes("$50"), "view shows saved of target");
assert.ok(html.includes("Our family is working toward"), "view shows the parent message");
assert.ok(html.includes("Naveen"), "view shows the parent name");
assert.ok(html.includes("Chipping in goes through the parent"), "view explains parent-handled chipping in");
assert.ok(!html.includes("<a "), "view contains no links / no navigation into the app");

/* ---------- 3. revoked / unknown link states ---------- */
console.log("— revoked / unknown link states —");

const revokedHtml = render(revoked!);
assert.ok(revokedHtml.includes("Link no longer active"), "revoked view shows the inactive eyebrow");
assert.ok(revokedHtml.includes("active anymore"), "revoked view shows the inactive headline");
assert.ok(!revokedHtml.includes("Save for the animal shelter"), "revoked view leaks no goal title");
assert.ok(!revokedHtml.includes("$30"), "revoked view leaks no progress");

const unknownHtml = render(null);
assert.ok(unknownHtml.includes("active anymore"), "unknown id shows the inactive state");

const loadingHtml = render(undefined);
assert.ok(loadingHtml.includes("Loading the family giving goal"), "loading state renders");

/* ---------- family message helper ---------- */
console.log("— family message helper —");
const msg = familyShareMessage(piiShare);
assert.ok(msg.includes(givingShareUrl(piiShare.id)), "message includes the share link");
assert.ok(msg.includes("chipping in goes through the parent"), "message sets the parent-handled expectation");
assert.ok(!msg.includes("aarush") && !msg.includes("Lilyana"), "message leaks no kid PII");

console.log("\n✅ All Stream E checks passed.");
