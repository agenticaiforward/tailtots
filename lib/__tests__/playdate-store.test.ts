import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LocalStoragePlaydateStore,
  PlaydateStoreError,
  SupabasePlaydateStore,
  configurePlaydateStore,
  parsePlaydateHash,
  playdateClaimUrl,
  playdateStore,
  type PlaydateInvite,
  type PlaydateSlotInput,
  type PlaydateStore,
} from "../playdate-store";

/* ------------------------------------------------------------------ */
/* Test doubles                                                        */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function installLocalStorage() {
  const backing = new Map<string, string>();
  const listeners = new Map<string, Array<(event: { key: string | null }) => void>>();
  const localStorageStub = {
    getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
    setItem: (key: string, value: string) => {
      backing.set(key, String(value));
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => backing.clear(),
  };
  const windowStub = {
    addEventListener: (type: string, cb: (event: { key: string | null }) => void) => {
      const arr = listeners.get(type) ?? [];
      arr.push(cb);
      listeners.set(type, arr);
    },
    removeEventListener: () => {},
    location: { origin: "https://app.example", pathname: "/" },
  };
  vi.stubGlobal("localStorage", localStorageStub);
  vi.stubGlobal("window", windowStub);
  // Browsers only fire `storage` in *other* tabs — the test fires it manually
  // to simulate a second tab writing.
  const fireStorageEvent = (key: string) => {
    for (const cb of listeners.get("storage") ?? []) cb({ key });
  };
  return { localStorageStub, fireStorageEvent };
}

class FakeChannel {
  handlers: Array<() => void> = [];
  unsubscribed = false;
  constructor(private status: string) {}
  on(_event: string, _filter: object, cb: () => void) {
    this.handlers.push(cb);
    return this;
  }
  subscribe(cb?: (status: string) => void) {
    cb?.(this.status);
    return this;
  }
  unsubscribe() {
    this.unsubscribed = true;
  }
  /** Simulate a postgres_changes event arriving on the channel. */
  fire() {
    for (const h of this.handlers) h();
  }
}

/** Minimal in-memory stand-in for the Supabase query builder chains used by
 *  SupabasePlaydateStore. Filters (.eq) are evaluated at execution time, so
 *  the `.eq("status", "open")` atomic claim guard behaves like Postgres:
 *  only the first concurrent claim matches a row. */
function makeFakeSupabaseClient(options?: {
  failInsert?: boolean;
  channelStatus?: string;
  brokenRealtime?: boolean;
}) {
  const rows = new Map<string, Row>();
  const channels: FakeChannel[] = [];
  const calls = { insert: 0, update: 0, select: 0 };
  let idCounter = 0;

  const runSelect = (filters: Array<[string, unknown]>, order?: { col: string; ascending: boolean }) => {
    let out = [...rows.values()];
    for (const [col, val] of filters) out = out.filter((row) => row[col] === val);
    if (order) {
      out = out.sort((a, b) => {
        const av = String(a[order.col] ?? "");
        const bv = String(b[order.col] ?? "");
        return order.ascending ? (av < bv ? -1 : av > bv ? 1 : 0) : av > bv ? -1 : av < bv ? 1 : 0;
      });
    }
    return out;
  };

  const selectChain = (filters: Array<[string, unknown]> = []) => {
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => selectChain([...filters, [col, val]]),
      order: (col: string, opts?: { ascending?: boolean }) => {
        const ordered = {
          then: (resolve: (v: { data: Row[]; error: null }) => void) => {
            calls.select += 1;
            resolve({ data: runSelect(filters, { col, ascending: opts?.ascending ?? true }), error: null });
          },
        };
        return ordered;
      },
      maybeSingle: async () => {
        calls.select += 1;
        const found = runSelect(filters)[0] ?? null;
        return { data: found, error: null };
      },
      single: async () => {
        calls.select += 1;
        const found = runSelect(filters)[0] ?? null;
        return found ? { data: found, error: null } : { data: null, error: new Error("no rows") };
      },
    };
    return chain;
  };

  const client = {
    __rows: rows,
    __channels: channels,
    __calls: calls,
    from: (_table: string) => ({
      insert: (payload: Row) => {
        calls.insert += 1;
        if (options?.failInsert) {
          return {
            select: () => ({
              single: async () => ({ data: null, error: new Error("db is down") }),
            }),
          };
        }
        idCounter += 1;
        const row: Row = {
          id: `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`,
          created_at: new Date(Date.now() + idCounter).toISOString(),
          claimed_by: null,
          claimed_at: null,
          ...payload,
        };
        rows.set(String(row.id), row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
      select: (_cols?: string) => selectChain(),
      update: (patch: Row) => {
        const filters: Array<[string, unknown]> = [];
        const chain: Record<string, unknown> = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return chain;
          },
          select: () => ({
            single: async () => {
              calls.update += 1;
              const matched = runSelect(filters)[0];
              if (!matched) return { data: null, error: new Error("no rows matched") };
              Object.assign(matched, patch);
              return { data: matched, error: null };
            },
          }),
        };
        return chain;
      },
    }),
    channel: (_name: string) => {
      if (options?.brokenRealtime) throw new Error("realtime unavailable");
      const channel = new FakeChannel(options?.channelStatus ?? "SUBSCRIBED");
      channels.push(channel);
      return channel;
    },
  };
  return client;
}

type FakeClient = ReturnType<typeof makeFakeSupabaseClient>;

const slots = (n = 2): PlaydateSlotInput[] =>
  Array.from({ length: n }, (_, i) => ({
    childId: `kid-${i}`,
    childName: `Kid${i} Lastname`,
    slot: `Sat 10:${i}0 AM`,
  }));

/** Must match POLL_FALLBACK_MS in ../playdate-store.ts. */
const POLL_MS_TEST = 8000;

let fireStorageEvent: (key: string) => void = () => {};

beforeEach(() => {
  fireStorageEvent = installLocalStorage().fireStorageEvent;
  vi.useFakeTimers();
  configurePlaydateStore({ client: null, signedIn: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  configurePlaydateStore({ client: null, signedIn: false });
});

async function awaited<T>(value: T | Promise<T>): Promise<T> {
  return value as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* URL helpers                                                         */
/* ------------------------------------------------------------------ */

describe("parsePlaydateHash / playdateClaimUrl", () => {
  it("parses #playdate/<id> hashes", () => {
    expect(parsePlaydateHash("#playdate/abc-123")).toBe("abc-123");
    expect(parsePlaydateHash("#playdate/abc-123/")).toBe("abc-123");
    expect(parsePlaydateHash("  #playdate/abc-123  ")).toBe("abc-123");
  });

  it("rejects non-playdate hashes", () => {
    expect(parsePlaydateHash("#schedule")).toBeNull();
    expect(parsePlaydateHash("#playdate/")).toBeNull();
    expect(parsePlaydateHash("#playdate/a b")).toBeNull();
    expect(parsePlaydateHash("")).toBeNull();
  });

  it("builds a claim URL on the current origin", () => {
    expect(playdateClaimUrl("invite-1")).toBe("https://app.example/#playdate/invite-1");
  });
});

/* ------------------------------------------------------------------ */
/* LocalStoragePlaydateStore                                           */
/* ------------------------------------------------------------------ */

describe("LocalStoragePlaydateStore", () => {
  it("creates, reads, and lists invites", async () => {
    const store = new LocalStoragePlaydateStore();
    const invite = await awaited(store.createInvite("  ", "  ", slots(2)));
    expect(invite.id).toBeTruthy();
    expect(invite.familyName).toBe("Your");
    expect(invite.hostName).toBe("A TailTots parent");
    expect(invite.status).toBe("open");
    expect(invite.slots.every((s) => s.status === "open")).toBe(true);

    expect(await awaited(store.getInvite(invite.id))).toEqual(invite);
    expect(await awaited(store.getInvite("nope"))).toBeNull();
    expect((await awaited(store.listInvites())).map((i) => i.id)).toEqual([invite.id]);
  });

  it("lists newest first", async () => {
    const store = new LocalStoragePlaydateStore();
    vi.setSystemTime(1_700_000_000_000);
    const first = await awaited(store.createInvite("A", "Host", slots(1)));
    vi.setSystemTime(1_700_000_001_000);
    const second = await awaited(store.createInvite("B", "Host", slots(1)));
    const listed = await awaited(store.listInvites());
    expect(listed.map((i) => i.id)).toEqual([second.id, first.id]);
  });

  it("claims a slot and books the invite", async () => {
    const store = new LocalStoragePlaydateStore();
    const invite = await awaited(store.createInvite("Fam", "Host", slots(2)));
    const updated = await awaited(store.claimSlot(invite.id, 1, " Priya "));
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("booked");
    expect(updated!.claimedBy).toBe("Priya");
    expect(updated!.claimedAt).toBeGreaterThan(0);
    expect(updated!.slots[1].status).toBe("claimed");
    expect(updated!.slots[0].status).toBe("open");
  });

  it("second claim on the same invite loses the race (null = just taken)", async () => {
    const store = new LocalStoragePlaydateStore();
    const invite = await awaited(store.createInvite("Fam", "Host", slots(2)));
    const [first, second] = await Promise.all([
      awaited(store.claimSlot(invite.id, 0, "Priya")),
      awaited(store.claimSlot(invite.id, 1, "Sam")),
    ]);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const final = await awaited(store.getInvite(invite.id));
    expect(final!.status).toBe("booked");
    expect(final!.claimedBy).toBe("Priya");
  });

  it("rejects invalid claims", async () => {
    const store = new LocalStoragePlaydateStore();
    const invite = await awaited(store.createInvite("Fam", "Host", slots(1)));
    expect(await awaited(store.claimSlot("missing", 0, "Priya"))).toBeNull();
    expect(await awaited(store.claimSlot(invite.id, 9, "Priya"))).toBeNull();
    expect(await awaited(store.claimSlot(invite.id, 0, "   "))).toBeNull();
  });

  it("emits to subscribers on write and on cross-tab storage events", async () => {
    const store = new LocalStoragePlaydateStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    await awaited(store.createInvite("Fam", "Host", slots(1)));
    expect(calls).toBe(1);
    // Simulate another tab writing directly to localStorage.
    const raw = localStorage.getItem("tailtots-playdate-invites-v1")!;
    const all = JSON.parse(raw) as Record<string, PlaydateInvite>;
    all["other-tab-invite"] = {
      id: "other-tab-invite",
      familyName: "Other",
      hostName: "Host",
      slots: [],
      status: "open",
      createdAt: 1,
    };
    localStorage.setItem("tailtots-playdate-invites-v1", JSON.stringify(all));
    fireStorageEvent("tailtots-playdate-invites-v1");
    expect(calls).toBe(2);
    unsubscribe();
    await awaited(store.createInvite("Fam", "Host", slots(1)));
    fireStorageEvent("tailtots-playdate-invites-v1");
    expect(calls).toBe(2);
  });

  it("survives corrupted localStorage without throwing", async () => {
    localStorage.setItem("tailtots-playdate-invites-v1", "{not-json");
    const store = new LocalStoragePlaydateStore();
    expect(await awaited(store.listInvites())).toEqual([]);
    expect(await awaited(store.getInvite("x"))).toBeNull();
    const invite = await awaited(store.createInvite("Fam", "Host", slots(1)));
    expect(invite.id).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* SupabasePlaydateStore (fake client)                                 */
/* ------------------------------------------------------------------ */

function supabaseStore(client: FakeClient): PlaydateStore {
  return new SupabasePlaydateStore(client as never);
}

describe("SupabasePlaydateStore", () => {
  it("creates an invite and maps the row back", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Sharma", "Naveen", slots(2)));
    expect(invite.id).toMatch(/^00000000-0000-4000-8000-/);
    expect(invite.familyName).toBe("Sharma");
    expect(invite.hostName).toBe("Naveen");
    expect(invite.status).toBe("open");
    expect(invite.slots).toHaveLength(2);
    // Only first names are persisted.
    const row = client.__rows.get(invite.id)!;
    expect(row.family_name).toBe("Sharma");
    expect((row.slots as Array<{ childName: string }>)[0].childName).toBe("Kid0");
    expect(client.__calls.insert).toBe(1);
  });

  it("throws PlaydateStoreError when the insert fails", async () => {
    const client = makeFakeSupabaseClient({ failInsert: true });
    const store = supabaseStore(client);
    await expect(awaited(store.createInvite("Fam", "Host", slots(1)))).rejects.toBeInstanceOf(PlaydateStoreError);
  });

  it("getInvite maps dates and returns null for unknown ids", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Fam", "Host", slots(1)));
    const found = await awaited(store.getInvite(invite.id));
    expect(found).not.toBeNull();
    expect(found!.createdAt).toBeGreaterThan(0);
    expect(found!.claimedBy).toBeUndefined();
    expect(await awaited(store.getInvite("00000000-0000-4000-8000-999999999999"))).toBeNull();
    expect(await awaited(store.getInvite(""))).toBeNull();
  });

  it("sanitizes malformed slot payloads instead of crashing", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Fam", "Host", slots(1)));
    const row = client.__rows.get(invite.id)!;
    row.slots = [{ nope: true }, "junk", { childId: "k", childName: "A B", slot: "Sat", status: "claimed" }];
    const found = await awaited(store.getInvite(invite.id));
    expect(found!.slots).toEqual([{ childId: "k", childName: "A", slot: "Sat", status: "claimed" }]);
  });

  it("claims a slot and books the invite", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Fam", "Host", slots(2)));
    const updated = await awaited(store.claimSlot(invite.id, 0, "Priya"));
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("booked");
    expect(updated!.claimedBy).toBe("Priya");
    expect(updated!.claimedAt).toBeGreaterThan(0);
    const row = client.__rows.get(invite.id)!;
    expect(row.status).toBe("booked");
    expect(row.claimed_by).toBe("Priya");
  });

  it("only the first of two concurrent claims wins (atomic status guard)", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Fam", "Host", slots(2)));
    const [first, second] = await Promise.all([
      awaited(store.claimSlot(invite.id, 0, "Priya")),
      awaited(store.claimSlot(invite.id, 1, "Sam")),
    ]);
    const winners = [first, second].filter(Boolean);
    expect(winners).toHaveLength(1);
    const final = await awaited(store.getInvite(invite.id));
    expect(final!.status).toBe("booked");
    expect([first?.claimedBy, second?.claimedBy].filter(Boolean)).toEqual([final!.claimedBy]);
  });

  it("returns null when claiming an already-booked invite or bad input", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    const invite = await awaited(store.createInvite("Fam", "Host", slots(1)));
    await awaited(store.claimSlot(invite.id, 0, "Priya"));
    expect(await awaited(store.claimSlot(invite.id, 0, "Sam"))).toBeNull();
    expect(await awaited(store.claimSlot(invite.id, 5, "Sam"))).toBeNull();
    expect(await awaited(store.claimSlot(invite.id, 0, "  "))).toBeNull();
    expect(await awaited(store.claimSlot("missing-id", 0, "Sam"))).toBeNull();
  });

  it("listInvites returns this device's cloud invites, newest first", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    expect(await awaited(store.listInvites())).toEqual([]);
    const first = await awaited(store.createInvite("A", "Host", slots(1)));
    const second = await awaited(store.createInvite("B", "Host", slots(1)));
    const listed = await awaited(store.listInvites());
    expect(listed.map((i) => i.id)).toEqual([second.id, first.id]);
    // A cloud row this device didn't create is not listed (no enumeration).
    client.__rows.set("00000000-0000-4000-8000-999999999999", {
      id: "00000000-0000-4000-8000-999999999999",
      family_name: "Stranger",
      host_name: "X",
      slots: [],
      status: "open",
      created_at: new Date().toISOString(),
    });
    expect((await awaited(store.listInvites())).map((i) => i.id)).toEqual([second.id, first.id]);
  });

  it("uses realtime for live updates and falls back to polling on channel error", async () => {
    const client = makeFakeSupabaseClient({ channelStatus: "CHANNEL_ERROR" });
    const store = supabaseStore(client);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    // Realtime channel opened once for the first subscriber…
    expect(client.__channels).toHaveLength(1);
    // …then the error status switched to polling fallback.
    await vi.advanceTimersByTimeAsync(POLL_MS_TEST);
    expect(calls).toBeGreaterThanOrEqual(1);
    // A second subscriber reuses the same live sync.
    const unsubscribe2 = store.subscribe(() => {});
    expect(client.__channels).toHaveLength(1);
    unsubscribe();
    unsubscribe2();
    await vi.advanceTimersByTimeAsync(POLL_MS_TEST * 2);
    const frozen = calls;
    await vi.advanceTimersByTimeAsync(POLL_MS_TEST * 2);
    expect(calls).toBe(frozen);
  });

  it("realtime events emit to subscribers", async () => {
    const client = makeFakeSupabaseClient();
    const store = supabaseStore(client);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    client.__channels[0].fire();
    expect(calls).toBe(1);
    unsubscribe();
  });
});

/* ------------------------------------------------------------------ */
/* Routing facade: playdateStore + configurePlaydateStore              */
/* ------------------------------------------------------------------ */

describe("playdateStore routing", () => {
  it("defaults to localStorage when no client is configured", async () => {
    const invite = await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    expect(localStorage.getItem("tailtots-playdate-invites-v1")).toContain(invite.id);
    expect(await awaited(playdateStore.getInvite(invite.id))).not.toBeNull();
  });

  it("signed-out parents still create local invites when a client is configured", async () => {
    const client = makeFakeSupabaseClient();
    configurePlaydateStore({ client: client as never, signedIn: false });
    const invite = await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    expect(client.__calls.insert).toBe(0);
    expect(localStorage.getItem("tailtots-playdate-invites-v1")).toContain(invite.id);
    // …and they list local invites.
    expect((await awaited(playdateStore.listInvites())).map((i) => i.id)).toContain(invite.id);
  });

  it("signed-in parents create cloud invites", async () => {
    const client = makeFakeSupabaseClient();
    configurePlaydateStore({ client: client as never, signedIn: true });
    const invite = await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    expect(client.__calls.insert).toBe(1);
    expect(localStorage.getItem("tailtots-playdate-invites-v1") ?? "").not.toContain(invite.id);
    expect(await awaited(playdateStore.listInvites())).toHaveLength(1);
  });

  it("signed-in create surfaces cloud failures as PlaydateStoreError (no silent local fallback)", async () => {
    const client = makeFakeSupabaseClient({ failInsert: true });
    configurePlaydateStore({ client: client as never, signedIn: true });
    await expect(awaited(playdateStore.createInvite("Fam", "Host", slots(1)))).rejects.toBeInstanceOf(
      PlaydateStoreError,
    );
    expect(await awaited(playdateStore.listInvites())).toEqual([]);
  });

  it("a signed-out claimer on another device can read and claim a cloud invite", async () => {
    const client = makeFakeSupabaseClient();
    // Host device: signed in, creates a cloud invite.
    configurePlaydateStore({ client: client as never, signedIn: true });
    const invite = await awaited(playdateStore.createInvite("Fam", "Host", slots(2)));

    // Other parent's device: client configured (same build) but signed out.
    configurePlaydateStore({ client: client as never, signedIn: false });
    const seen = await awaited(playdateStore.getInvite(invite.id));
    expect(seen).not.toBeNull();
    expect(seen!.status).toBe("open");

    const claimed = await awaited(playdateStore.claimSlot(invite.id, 1, "Priya"));
    expect(claimed).not.toBeNull();
    expect(claimed!.status).toBe("booked");
    expect(claimed!.claimedBy).toBe("Priya");
  });

  it("claim on a cloud invite already taken returns null (just-taken message path)", async () => {
    const client = makeFakeSupabaseClient();
    const cloud = supabaseStore(client);
    const invite = await awaited(cloud.createInvite("Fam", "Host", slots(1)));
    await awaited(cloud.claimSlot(invite.id, 0, "Priya"));

    configurePlaydateStore({ client: client as never, signedIn: false });
    expect(await awaited(playdateStore.claimSlot(invite.id, 0, "Sam"))).toBeNull();
  });

  it("claims on local invites still work when a client is configured (same-browser demo)", async () => {
    const client = makeFakeSupabaseClient();
    configurePlaydateStore({ client: client as never, signedIn: false });
    const invite = await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    const claimed = await awaited(playdateStore.claimSlot(invite.id, 0, "Priya"));
    expect(claimed).not.toBeNull();
    expect(claimed!.claimedBy).toBe("Priya");
    expect(client.__calls.update).toBe(0);
  });

  it("subscribe wires both backends and unsubscribes cleanly", async () => {
    const client = makeFakeSupabaseClient();
    configurePlaydateStore({ client: client as never, signedIn: false });
    let calls = 0;
    const unsubscribe = playdateStore.subscribe(() => {
      calls += 1;
    });
    // Local write emits…
    await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    expect(calls).toBe(1);
    // …and a cloud realtime event emits too.
    client.__channels[0].fire();
    expect(calls).toBe(2);
    unsubscribe();
    await awaited(playdateStore.createInvite("Fam", "Host", slots(1)));
    client.__channels[0].fire();
    expect(calls).toBe(2);
    expect(client.__channels[0].unsubscribed).toBe(true);
  });

  it("signing out switches back to localStorage", async () => {
    const client = makeFakeSupabaseClient();
    configurePlaydateStore({ client: client as never, signedIn: true });
    await awaited(playdateStore.createInvite("CloudFam", "Host", slots(1)));
    configurePlaydateStore({ client: client as never, signedIn: false });
    const invite = await awaited(playdateStore.createInvite("LocalFam", "Host", slots(1)));
    expect(client.__calls.insert).toBe(1);
    const listed = await awaited(playdateStore.listInvites());
    expect(listed.map((i) => i.familyName)).toEqual(["LocalFam"]);
    expect(invite.familyName).toBe("LocalFam");
  });
});
