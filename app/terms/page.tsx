/**
 * Published Terms of Use URL (used for Alexa skill submission, app stores,
 * and general reference). Same simple inline styling as the original page.
 *
 * Placeholders to fill before release: Tailtots, hello@tailtots.com,
 * June 30, 2026. Everything else is finished copy.
 */
export default function TermsPage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24, lineHeight: 1.6 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>
        TAILTOTS
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>
        Terms of Use
      </h1>
      <p style={{ fontSize: 14, color: "#4f625b" }}>
        Effective date: June 30, 2026
      </p>

      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) are an agreement between you and Tailtots
        (&ldquo;TailTots,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) for your use of the TailTots website,
        the TailTots mobile and web apps, and the &ldquo;TailTots for Parents&rdquo; Alexa skill
        (invocation: &ldquo;tail tots parent&rdquo;), together the &ldquo;Service.&rdquo; TailTots is a
        parent-guided, real-world development platform that helps children build responsibility,
        kindness, and money skills through missions and parent approval, beginning with pet care.
        By using the Service, you agree to these Terms.
      </p>

      <h2>1. Parent responsibility</h2>
      <p>
        TailTots is a tool for parents and guardians, not a replacement for supervision. A parent or
        guardian is responsible for: creating household rules, assigning or hiding missions, approving
        children&apos;s completed missions, supervising any real-world activity children undertake, and
        deciding whether the family&apos;s household is ready for a pet. Voice approvals in the Alexa
        skill use a session-based check, not strong authentication; anyone who can speak to your Alexa
        device during an open session could confirm an approval, so keep your devices and sessions under
        your control.
      </p>

      <h2>2. As-is demo</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and is currently a demo. Features, mission content,
        data storage, Kid Bank points, badges, and availability may change as TailTots is improved. Kid
        Bank points are a family motivation ledger only; they are not money, have no cash value, and are
        not redeemable outside your household. We make no guarantee about any outcome from using
        TailTots, including any change in a child&apos;s behavior or skills.
      </p>

      <h2>3. Pet readiness is a journey, not a promise</h2>
      <p>
        TailTots helps families practice pet-care responsibility through the Pet Readiness Journey, but
        the following are always true:
      </p>
      <ul>
        <li>A pet is a living commitment &mdash; <strong>never a prize</strong> for completing missions.</li>
        <li>Completing missions or a readiness journey <strong>does not guarantee adoption</strong> or mean a family is entitled to a pet.</li>
        <li><strong>Parents make the final decision</strong> about whether, when, and how to welcome a pet.</li>
        <li>TailTots readiness practice <strong>does not replace shelter screening</strong> or veterinary guidance.</li>
      </ul>

      <h2>4. Activity ideas and AI-generated suggestions</h2>
      <p>
        The Alexa skill can suggest activity ideas for building life skills (such as responsibility,
        kindness, confidence, money skills, independence, patience, teamwork, and honesty). Some
        suggestions are AI-generated. These are ideas for you to review &mdash; they are not professional
        advice, and nothing becomes a mission until you choose to save it. Always use your own judgment
        about whether an activity is safe and appropriate for your child and your household.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You agree not to misuse the Service. You will not: attempt to access other families&apos; data;
        upload unlawful, harassing, or harmful content; use TailTots to arrange unsupervised contact
        between children and strangers; reverse-engineer the Service for harmful purposes; or use the
        Service in violation of any applicable law. There is no stranger messaging, public ranking, or
        open child chat in TailTots, and you will not use the Service to facilitate any.
      </p>

      <h2>6. Children</h2>
      <p>
        The apps and website are designed for children to use with a parent or guardian&apos;s permission
        and involvement. The &ldquo;TailTots for Parents&rdquo; Alexa skill is a general-audience,
        parent-facing skill and is not directed at children. Parent-only areas of the apps sit behind a
        parent passcode gate, which is UI protection and not strong authentication.
      </p>

      <h2>7. Privacy</h2>
      <p>
        How we handle information is described in our Privacy Policy, published at
        https://tailtots.com/privacy. That policy is part of these Terms.
      </p>

      <h2>8. Changes to these terms</h2>
      <p>
        We may update these Terms as TailTots evolves. When we do, we will note the new effective date.
        Continued use of the Service after the updated date means you accept the revised Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms: contact Tailtots at hello@tailtots.com.
      </p>
    </main>
  );
}
