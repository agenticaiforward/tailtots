/**
 * R2 (neighborhood stream): pure, testable helpers for the Neighborhood tab.
 *
 * - jobVisibleInZip: zipcode-based job filtering.
 * - buildJobFamilySummary: the "share with family" job summary — a sanitized,
 *   family-safe text the parent copies into their own family chat. It carries
 *   only the job title, pet, time, reward, skill focus, and safety note.
 *   Posting-family names, kid names, ages, and addresses are never included.
 */

export interface JobFamilyShareInput {
  title: string;
  pet: string;
  time: string;
  rewardDollars: number;
  badgeTitle: string;
  skillLabel: string;
  safety: string;
}

/**
 * Whether a neighborhood job should be shown for the family's ZIP.
 * - No ZIP set (not 5 digits): no filtering, show everything.
 * - Job without a ZIP (the family's own posts / legacy demo data): always show.
 * - Otherwise: only jobs in the family's ZIP.
 */
export function jobVisibleInZip(jobZip: string | undefined, familyZip: string): boolean {
  if (familyZip.length !== 5) return true;
  if (!jobZip) return true;
  return jobZip === familyZip;
}

/** Family-safe share text for one neighborhood job. No kid or family PII. */
export function buildJobFamilySummary(job: JobFamilyShareInput): string {
  const reward = job.rewardDollars > 0 ? `$${job.rewardDollars} allowance` : job.badgeTitle;
  return [
    `🐾 TailTots family job: ${job.title}`,
    `Pet: ${job.pet}`,
    `When: ${job.time}`,
    `Reward: ${reward}`,
    `Skill focus: ${job.skillLabel}`,
    `Safety: ${job.safety}`,
    `Shared by a TailTots parent — please chip in or cheer on through the parent. No kid details are ever shared.`,
  ].join("\n");
}
