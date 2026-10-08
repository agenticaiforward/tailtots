import { describe, expect, it } from "vitest";

import {
  CHARACTER_TRAITS,
  CURRICULUM_LEVEL_NAMES,
  TRAIT_SKILL,
  buildCurriculumLevelBadge,
  curriculumLevelBadgeId,
  curriculumLevelBadgeTitle,
  detectNewlyCompletedCurriculumLevels,
  getChildCurriculumSummary,
  getCurriculumLevelStatus,
  instantiateCurriculumMissions,
  openCurriculumMissionKeys,
  traitByKey,
} from "../character-curriculum";
import type { Mission } from "../types";

const VALID_CATEGORIES = ["pet_care", "chore", "kindness", "money", "community"] as const;
const VALID_DIFFICULTIES = ["easy", "medium", "hard", "super_hard"] as const;

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "m-1",
    title: "Test mission",
    category: "chore",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Did it happen?",
    status: "pending",
    ...overrides,
  };
}

describe("curriculum data model", () => {
  it("has 4 traits × 3 levels with kid-friendly level names", () => {
    expect(CHARACTER_TRAITS.map((t) => t.key)).toEqual([
      "responsibility",
      "empathy",
      "kindness",
      "leadership",
    ]);
    expect([...CURRICULUM_LEVEL_NAMES]).toEqual(["Sprout", "Grow", "Flourish"]);
    for (const trait of CHARACTER_TRAITS) {
      expect(trait.levels).toHaveLength(3);
      expect(trait.levels.map((l) => l.name)).toEqual(["Sprout", "Grow", "Flourish"]);
    }
  });

  it("has 3–4 concrete missions per level with valid mission shapes", () => {
    const keys = new Set<string>();
    for (const trait of CHARACTER_TRAITS) {
      for (const level of trait.levels) {
        expect(level.missions.length).toBeGreaterThanOrEqual(3);
        expect(level.missions.length).toBeLessThanOrEqual(4);
        for (const m of level.missions) {
          expect(m.title.length).toBeGreaterThan(3);
          expect(m.question.length).toBeGreaterThan(10);
          expect(VALID_CATEGORIES).toContain(m.category);
          expect(VALID_DIFFICULTIES).toContain(m.difficulty);
          expect(m.points).toBeGreaterThan(0);
          expect(m.coins).toBeGreaterThanOrEqual(0);
          // Age-banded 5–12
          expect(m.minAge).toBeGreaterThanOrEqual(5);
          expect(m.maxAge).toBeLessThanOrEqual(12);
          expect(m.minAge).toBeLessThanOrEqual(m.maxAge);
          // Keys unique across the whole curriculum
          const scoped = `${trait.key}-l${level.index}-${m.key}`;
          expect(keys.has(scoped)).toBe(false);
          keys.add(scoped);
        }
      }
    }
    // 4 traits × 3 levels × 4 missions
    expect(keys.size).toBe(48);
  });

  it("levels get harder with age: Sprout is easiest, Flourish hardest", () => {
    const difficultyRank: Record<string, number> = { easy: 0, medium: 1, hard: 2, super_hard: 3 };
    for (const trait of CHARACTER_TRAITS) {
      const avg = (idx: number) => {
        const ms = trait.levels[idx].missions;
        return ms.reduce((s, m) => s + difficultyRank[m.difficulty], 0) / ms.length;
      };
      expect(avg(0)).toBeLessThanOrEqual(avg(1));
      expect(avg(1)).toBeLessThanOrEqual(avg(2));
    }
  });

  it("every pet-assuming mission has a no-pet alternative (readiness track)", () => {
    let petMissions = 0;
    for (const trait of CHARACTER_TRAITS) {
      for (const level of trait.levels) {
        for (const m of level.missions) {
          if (m.category === "pet_care") {
            petMissions += 1;
            expect(m.noPetTitle, `${m.key} needs a no-pet title`).toBeTruthy();
            expect(m.noPetQuestion, `${m.key} needs a no-pet question`).toBeTruthy();
          }
        }
      }
    }
    expect(petMissions).toBeGreaterThan(0);
  });

  it("each trait maps to an existing skill-meter skill", () => {
    for (const trait of CHARACTER_TRAITS) {
      expect(["responsibility", "empathy", "leadership"]).toContain(trait.skill);
      expect(TRAIT_SKILL[trait.key]).toBe(trait.skill);
    }
  });

  it("traitByKey throws on unknown traits", () => {
    expect(() => traitByKey("honesty" as never)).toThrow();
  });
});

describe("instantiateCurriculumMissions", () => {
  it("builds assignable Mission objects tagged with the curriculum", () => {
    const missions = instantiateCurriculumMissions("responsibility", 0, "kid-1", { hasPet: true });
    expect(missions).toHaveLength(4);
    for (const m of missions) {
      expect(m.assignedChildId).toBe("kid-1");
      expect(m.status).toBe("pending");
      expect(m.curriculum?.trait).toBe("responsibility");
      expect(m.curriculum?.level).toBe(0);
      expect(m.curriculum?.missionKey).toBeTruthy();
    }
    const ids = missions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("swaps in no-pet alternatives when the family has no pet", () => {
    const withPet = instantiateCurriculumMissions("responsibility", 0, "kid-1", { hasPet: true });
    const noPet = instantiateCurriculumMissions("responsibility", 0, "kid-1", { hasPet: false });
    const petCareIdx = withPet.findIndex((m) => m.curriculum?.missionKey === "resp-s1-water");
    expect(petCareIdx).toBeGreaterThanOrEqual(0);
    expect(noPet[petCareIdx].title).toBe("Plant water check");
    expect(noPet[petCareIdx].title).not.toBe(withPet[petCareIdx].title);
    // Non-pet missions are unchanged
    const choreIdx = withPet.findIndex((m) => m.curriculum?.missionKey === "resp-s1-tidy");
    expect(noPet[choreIdx].title).toBe(withPet[choreIdx].title);
  });

  it("produces unique ids across separate assignments", () => {
    const a = instantiateCurriculumMissions("empathy", 1, "kid-1", { hasPet: true, idPrefix: "a" });
    const b = instantiateCurriculumMissions("empathy", 1, "kid-1", { hasPet: true, idPrefix: "b" });
    const ids = [...a, ...b].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("curriculum progression", () => {
  const level = traitByKey("kindness").levels[0];
  const approvedLevel = (childId: string): Mission[] =>
    level.missions.map((t, i) =>
      mission({
        id: `curri-${i}`,
        status: "approved",
        assignedChildId: childId,
        completedBy: childId,
        curriculum: { trait: "kindness", level: 0, missionKey: t.key },
      }),
    );

  it("a level is not complete until every pack mission is approved", () => {
    const childId = "kid-1";
    const missions = approvedLevel(childId).slice(0, 3);
    const status = getCurriculumLevelStatus(childId, "kindness", 0, missions, []);
    expect(status.total).toBe(4);
    expect(status.approvedCount).toBe(3);
    expect(status.complete).toBe(false);
    expect(status.done).toBe(false);
  });

  it("a level completes when all pack missions are parent-approved", () => {
    const childId = "kid-1";
    const status = getCurriculumLevelStatus(childId, "kindness", 0, approvedLevel(childId), []);
    expect(status.complete).toBe(true);
    expect(status.done).toBe(true);
    expect(status.badgeAwarded).toBe(false);
  });

  it("other kids' approvals do not count", () => {
    const status = getCurriculumLevelStatus("kid-2", "kindness", 0, approvedLevel("kid-1"), []);
    expect(status.complete).toBe(false);
    expect(status.approvedCount).toBe(0);
  });

  it("repeatMission copies cannot double-count a single template mission", () => {
    const childId = "kid-1";
    const key = level.missions[0].key;
    const missions = [
      mission({ id: "a", status: "approved", completedBy: childId, curriculum: { trait: "kindness", level: 0, missionKey: key } }),
      mission({ id: "b", status: "approved", completedBy: childId, curriculum: { trait: "kindness", level: 0, missionKey: key } }),
    ];
    const status = getCurriculumLevelStatus(childId, "kindness", 0, missions, []);
    expect(status.approvedCount).toBe(1);
    expect(status.complete).toBe(false);
  });

  it("detectNewlyCompletedCurriculumLevels is idempotent once the badge exists", () => {
    const childId = "kid-1";
    const missions = approvedLevel(childId);
    const pending = detectNewlyCompletedCurriculumLevels(missions, [], [childId]);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ childId, traitKey: "kindness", levelIndex: 0 });

    const badge = buildCurriculumLevelBadge(childId, "Kid", "kindness", 0);
    expect(badge.id).toBe(curriculumLevelBadgeId(childId, "kindness", 0));
    expect(badge.title).toBe(curriculumLevelBadgeTitle("kindness", 0));
    expect(badge.skill).toBe("empathy"); // feeds the existing empathy meter

    const after = detectNewlyCompletedCurriculumLevels(missions, [badge], [childId]);
    expect(after).toHaveLength(0);

    // And status reflects the badge as the cloud-persisted signal
    const status = getCurriculumLevelStatus(childId, "kindness", 0, [], [badge]);
    expect(status.badgeAwarded).toBe(true);
    expect(status.done).toBe(true);
  });

  it("buildCurriculumLevelBadge produces kid-friendly, distinct titles", () => {
    const titles = new Set<string>();
    for (const trait of CHARACTER_TRAITS) {
      for (const lvl of trait.levels) {
        const title = curriculumLevelBadgeTitle(trait.key, lvl.index);
        expect(title).toContain(trait.label);
        expect(title).toContain(lvl.name);
        titles.add(title);
      }
    }
    expect(titles.size).toBe(12);
  });

  it("getChildCurriculumSummary rolls up all 4 traits", () => {
    const summary = getChildCurriculumSummary("kid-1", approvedLevel("kid-1"), []);
    expect(summary).toHaveLength(4);
    const kindness = summary.find((s) => s.traitKey === "kindness")!;
    expect(kindness.levelsDone).toBe(1);
    expect(kindness.levels[0].done).toBe(true);
    expect(kindness.levels[1].done).toBe(false);
  });

  it("openCurriculumMissionKeys skips already-open missions on re-assign", () => {
    const childId = "kid-1";
    const key = level.missions[0].key;
    const missions = [
      mission({ id: "open-1", status: "pending", assignedChildId: childId, curriculum: { trait: "kindness", level: 0, missionKey: key } }),
      mission({ id: "done-1", status: "approved", completedBy: childId, curriculum: { trait: "kindness", level: 0, missionKey: level.missions[1].key } }),
    ];
    const open = openCurriculumMissionKeys(childId, "kindness", 0, missions);
    expect(open.has(key)).toBe(true);
    expect(open.has(level.missions[1].key)).toBe(false); // approved ≠ open
  });
});
