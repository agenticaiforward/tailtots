import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendPlaydateNotifications,
  buildClaimNotification,
  markAllPlaydateNotificationsRead,
  readPlaydateNotifications,
  recordClaimReceiptFromInvite,
  recordClaimReceiptNotification,
  unreadPlaydateNotificationCount,
} from "../playdate-notifications";

function installLocalStorage() {
  const backing = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key: string, value: string) => {
      backing.set(key, String(value));
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => backing.clear(),
  });
  return backing;
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("playdate notifications", () => {
  it("starts empty and never throws on corrupted storage", () => {
    expect(readPlaydateNotifications()).toEqual([]);
    localStorage.setItem("tailtots-playdate-notifications-v1", "{not-json");
    expect(readPlaydateNotifications()).toEqual([]);
  });

  it("appends host claim notifications newest-first and dedupes by invite", () => {
    const first = appendPlaydateNotifications([
      buildClaimNotification({
        inviteId: "inv-1",
        hostName: "Naveen",
        claimedBy: "Priya",
        slotLabel: "Sat 10:00 AM",
        childName: "Aarush",
        claimedAt: 1000,
      }),
    ]);
    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe("claim");
    expect(first[0].read).toBe(false);
    expect(first[0].title).toContain("Priya");
    expect(first[0].body).toContain("Sat 10:00 AM");

    // Same invite claimed-notification is not duplicated (e.g. on re-reads).
    const second = appendPlaydateNotifications([
      buildClaimNotification({
        inviteId: "inv-1",
        hostName: "Naveen",
        claimedBy: "Priya",
        slotLabel: "Sat 10:00 AM",
        childName: "Aarush",
        claimedAt: 2000,
      }),
    ]);
    expect(second).toHaveLength(1);

    // A different invite appends on top, newest first.
    const third = appendPlaydateNotifications([
      buildClaimNotification({
        inviteId: "inv-2",
        hostName: "Naveen",
        claimedBy: "Sam",
        slotLabel: "Sun 2:00 PM",
        childName: "Sahasra",
        claimedAt: 3000,
      }),
    ]);
    expect(third.map((n) => n.inviteId)).toEqual(["inv-2", "inv-1"]);
  });

  it("records the accepting parent's claim receipt", () => {
    const receipt = recordClaimReceiptNotification({
      inviteId: "inv-9",
      hostName: "Naveen",
      familyName: "Sharma",
      slotLabel: "Sat 10:00 AM",
      childName: "Aarush",
      claimedBy: "Priya",
      claimedAt: 5000,
    });
    expect(receipt.kind).toBe("claim-receipt");
    expect(receipt.title).toContain("Sharma");
    expect(receipt.body).toContain("Sat 10:00 AM");
    expect(receipt.body).toContain("Naveen");
    expect(readPlaydateNotifications()).toHaveLength(1);
  });

  it("recordClaimReceiptFromInvite builds the receipt from a claimed invite", () => {
    const invite = {
      id: "inv-7",
      hostName: "Naveen",
      familyName: "Sharma",
      slots: [
        { childId: "k1", childName: "Aarush", slot: "Sat 10:00 AM", status: "open" as const },
        { childId: "k1", childName: "Aarush", slot: "Sun 2:00 PM", status: "claimed" as const },
      ],
      claimedAt: 7000,
    };
    const receipt = recordClaimReceiptFromInvite(invite, "Priya");
    expect(receipt.body).toContain("Sun 2:00 PM");
    expect(receipt.body).toContain("Aarush");
    expect(readPlaydateNotifications().map((n) => n.inviteId)).toEqual(["inv-7"]);
  });

  it("tracks unread counts and marks all read", () => {
    appendPlaydateNotifications([
      buildClaimNotification({
        inviteId: "a",
        hostName: "H",
        claimedBy: "P1",
        slotLabel: "Sat",
        childName: "K",
      }),
      buildClaimNotification({
        inviteId: "b",
        hostName: "H",
        claimedBy: "P2",
        slotLabel: "Sun",
        childName: "K",
      }),
    ]);
    expect(unreadPlaydateNotificationCount(readPlaydateNotifications())).toBe(2);
    const read = markAllPlaydateNotificationsRead();
    expect(unreadPlaydateNotificationCount(read)).toBe(0);
    expect(unreadPlaydateNotificationCount(readPlaydateNotifications())).toBe(0);
  });
});
