import { AiInsightsDashboard } from "./dashboard";

export const metadata = {
  title: "AI Insights — TailTots Live Algorithm Demo",
  description:
    "See exactly how TailTots' AI personalizes missions, detects patterns, and calibrates difficulty — every number computed live from synthetic family data.",
};

export default function AiInsightsPage() {
  return <AiInsightsDashboard />;
}
