"use client";

import { useState } from "react";
import type {
  BankCategory,
  BankTransaction,
  Child,
  SavingsGoal,
} from "@/lib/types";
import { getChildLook } from "../avatar-looks";
import { goalProgress } from "@/lib/domain/bank";
import { summarizeKidBank } from "@/lib/domain/bank";
import { ProfilePhoto } from "../ui";
export function BankPanel(props: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  transactions: BankTransaction[];
  goals: SavingsGoal[];
  requestBankMove: (category: BankCategory, amount?: number, description?: string, goalId?: string) => void;
  newGoal: { title: string; target: string };
  setNewGoal: (value: { title: string; target: string }) => void;
  addSavingsGoal: () => void;
  setActiveTab: (tab: string) => void;
}) {
  type KidMoneyCategory = Exclude<BankCategory, "earn" | "spend">;
  const childTransactions = props.transactions.filter((item) => item.childId === props.child?.id);
  const childGoals = props.goals.filter((item) => item.childId === props.child?.id);
  const childLook = getChildLook(props.child?.id);
  const { savedForGoals, availableBalance } = summarizeKidBank(
    props.transactions,
    props.goals,
    props.child?.id,
  );
  const earnedActivityTransactions = childTransactions.filter((tx) => tx.category === "earn" && tx.status === "approved").slice(0, 4);
  const givePurposes = ["Animal shelter", "Classroom cause", "Neighborhood helper fund", "Pet rescue", "Other kindness"];
  const [moneyDraft, setMoneyDraft] = useState({
    category: "save" as KidMoneyCategory,
    amount: "3",
    reason: "",
    goalId: childGoals[0]?.id ?? "",
  });
  const selectedGoalId = childGoals.some((goal) => goal.id === moneyDraft.goalId) ? moneyDraft.goalId : childGoals[0]?.id ?? "";
  const requestedAmount = Math.max(1, Number(moneyDraft.amount) || 1);
  const submitMoneyRequest = () => {
    if (requestedAmount > availableBalance) return;
    const selectedGoal = childGoals.find((goal) => goal.id === selectedGoalId);
    if (moneyDraft.category === "save" && !selectedGoal) return;
    const defaultReason =
      moneyDraft.category === "save"
          ? `Save for ${selectedGoal?.title}`
        : "Give money for kindness";
    const actionLabel = moneyDraft.category === "save" ? "Save" : "Give";
    props.requestBankMove(
      moneyDraft.category,
      requestedAmount,
      `${actionLabel} $${requestedAmount}: ${moneyDraft.reason.trim() || defaultReason}`,
      moneyDraft.category === "save" ? selectedGoal?.id : undefined,
    );
    setMoneyDraft({ ...moneyDraft, amount: "3", reason: "" });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          Back to Today
        </button>
        <button onClick={() => props.setActiveTab("pets")} className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]">
          Pet Passports
        </button>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Choose kid bank</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {props.childProfiles.map((childProfile) => {
            const look = getChildLook(childProfile.id);
            const isSelected = childProfile.id === props.child?.id;
            return (
              <button
                key={childProfile.id}
                onClick={() => props.setActiveChildId(childProfile.id)}
                className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black ${
                  isSelected ? "border-[#f47b20] bg-[#fff4d8] text-[#17231f] ring-2 ring-[#f47b20]/20" : "border-[#ded8c7] bg-[#f8f6ed] text-[#53615b]"
                }`}
              >
                <ProfilePhoto label={childProfile.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={childProfile.photoUrl} />
                <span className="min-w-0 flex-1 truncate">{childProfile.name}</span>
                {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <ProfilePhoto
              label={props.child?.name ?? "Kid"}
              initial={childLook.initial}
              colors={childLook.colors}
              size="lg"
              variant="kid"
              hair={childLook.hair}
              photoUrl={props.child?.photoUrl}
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Kid Bank</p>
              <h2 className="mt-1 text-3xl font-black">{props.child?.name ?? "Kid"}&apos;s money choices</h2>
              <p className="mt-1 text-sm font-semibold text-[#5f6a65]">Coins are app rewards. Dollars are parent-approved allowance money.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#fff4d8] px-4 py-3">
              <p className="text-2xl font-black">${availableBalance}</p>
              <p className="text-xs font-black text-[#7a4b12]">dollars available</p>
            </div>
            <div className="rounded-lg bg-[#e7f4ef] px-4 py-3">
              <p className="text-2xl font-black">${savedForGoals}</p>
              <p className="text-xs font-black text-[#0f766e]">dollars in goals</p>
            </div>
            <div className="rounded-lg bg-[#eef2ff] px-4 py-3">
              <p className="text-2xl font-black">{props.child?.coins ?? 0}</p>
              <p className="text-xs font-black text-[#2563eb]">reward coins</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">My goals</p>
          <h3 className="mt-2 text-2xl font-black">What are you saving for?</h3>
          <div className="mt-4 grid gap-3">
            {!childGoals.length && (
              <div className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">Add one goal first, then move allowance dollars toward it.</div>
            )}
            {childGoals.map((goal) => {
              const percent = goalProgress(goal);
              return (
                <article key={goal.id} className="rounded-lg bg-[#f8f6ed] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{goal.title}</p>
                      <p className="text-sm font-bold text-[#5f6a65]">${goal.target - goal.saved} left to go</p>
                      <p className="mt-1 text-xs font-bold text-[#69736f]">
                        {goal.sharedWithTrustedFamilies ? "Shared with trusted families as a cause" : "Private goal"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black">${goal.saved}/${goal.target}</span>
                  </div>
                  <div className="mt-3 h-4 rounded-full bg-white">
                    <div className="h-4 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">
                    Use the choices panel to move available dollars into this goal.
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Start a new goal</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold"
                placeholder="Example: Captain treats"
                value={props.newGoal.title}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, title: event.target.value })}
              />
              <input
                className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold"
                inputMode="numeric"
                placeholder="$ target"
                value={props.newGoal.target}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, target: event.target.value })}
              />
              <button onClick={props.addSavingsGoal} className="min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Add goal</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f47b20]">Use available dollars</p>
            <h3 className="mt-2 text-3xl font-black">Choose a money jar</h3>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#5f6a65]">Dollars come from parent-assigned tasks. Kids can save for a goal or give to a parent-approved cause.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["save", "give"] as KidMoneyCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setMoneyDraft({ ...moneyDraft, category, reason: "" })}
                  className={`min-h-16 rounded-lg px-4 py-3 text-lg font-black ${
                    moneyDraft.category === category ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-[#f8f6ed] text-[#17231f]"
                  }`}
                >
                  {category === "save" ? "Save to goal" : "Give/help"}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-lg font-black">
              Amount
              <div className="mt-3 grid grid-cols-4 gap-3">
                {["1", "2", "5", "10"].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setMoneyDraft({ ...moneyDraft, amount })}
                    className={`min-h-14 rounded-lg px-3 py-2 text-lg font-black ${
                      moneyDraft.amount === amount ? "bg-[#f47b20] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <input
                className="mt-3 w-full rounded-lg border border-[#ded8c7] px-4 py-4 text-lg font-semibold"
                inputMode="numeric"
                value={moneyDraft.amount}
                onChange={(event) => setMoneyDraft({ ...moneyDraft, amount: event.target.value })}
                placeholder="Other amount"
              />
            </label>
            <label className="mt-5 block text-lg font-black">
              {moneyDraft.category === "save" ? "Which goal?" : "Which cause?"}
              {moneyDraft.category === "save" ? (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={selectedGoalId}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, goalId: event.target.value })}
                >
                  {childGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} (${goal.saved}/${goal.target})</option>)}
                </select>
              ) : (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={moneyDraft.reason}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, reason: event.target.value })}
                >
                  <option value="">Choose a purpose</option>
                  {givePurposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
                </select>
              )}
            </label>
            <button
              onClick={submitMoneyRequest}
              disabled={requestedAmount > availableBalance || (moneyDraft.category === "save" && !childGoals.length)}
              className="mt-5 min-h-14 w-full rounded-lg bg-[#165a4b] px-5 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8c4bf]"
            >
              Ask parent to approve {moneyDraft.category} ${requestedAmount}
            </button>
            {moneyDraft.category === "save" && !childGoals.length && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">Add a goal before saving dollars.</p>
            )}
            {requestedAmount > availableBalance && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">That is more than the available dollars.</p>
            )}
            <div className="mt-4 rounded-lg bg-[#f8f6ed] p-4 text-base font-bold leading-6 text-[#5f6a65]">
              To earn dollars, finish parent-assigned tasks. This panel only moves approved dollars into savings or giving.
            </div>
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="font-black">Allowance approved for activities</h3>
            {earnedActivityTransactions.map((tx) => (
              <p key={tx.id} className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-sm font-semibold">
                <b>+${tx.amount}</b>
                <span className="mt-1 block">{tx.description}</span>
              </p>
            ))}
            {!earnedActivityTransactions.length && <p className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold text-[#5f6a65]">Approved allowance tied to activities will show here.</p>}
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <h3 className="font-black">Waiting and history</h3>
          {childTransactions.map((tx) => (
            <p key={tx.id} className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold">
              <b className="capitalize">{tx.category}</b> ${tx.amount}
              <span className="mt-1 block">{tx.description}</span>
              <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-[#5f6a65]">{tx.status}</span>
            </p>
          ))}
          {!childTransactions.length && <p className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold text-[#5f6a65]">No bank moves yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-3 shadow-sm sm:hidden">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-12 w-full rounded-lg bg-[#17231f] px-4 py-3 text-sm font-black text-white">
          Back to Today
        </button>
      </div>
    </section>
  );
}
