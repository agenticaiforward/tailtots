import { AiInsightsDashboard } from "./dashboard";
import { FounderGate } from "./gate";

export const metadata = {
  title: "AI Insights — TailTots",
  description: "Founder-only working page.",
  robots: { index: false, follow: false },
};

export default function AiInsightsPage() {
  return (
    <FounderGate>
      <AiInsightsDashboard />
    </FounderGate>
  );
}
