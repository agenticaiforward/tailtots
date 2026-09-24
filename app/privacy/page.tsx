import { PrivacyPolicyContent } from "../components/tailtots/PrivacyPolicyContent";

export const metadata = {
  title: "Privacy Policy — TailTots",
  description: "How TailTots handles family information, including children's privacy.",
};

/**
 * Published privacy policy URL (used in App Store Connect / Play Console).
 * The same content is reachable in-app from the landing footer, so the mobile
 * builds (which have no router) show it in an overlay instead.
 */
export default function PrivacyPage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>
        TAILTOTS
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>
        Privacy Policy
      </h1>
      <div style={{ marginTop: 16 }}>
        <PrivacyPolicyContent />
      </div>
    </main>
  );
}
