/**
 * Shared TailTots privacy policy content, rendered both by the Next.js
 * /privacy route (the published policy URL) and by the in-app privacy
 * overlay (so the policy is reachable inside the mobile builds, which have
 * no router).
 *
 * The policy covers three products with their own sections:
 *   1. The TailTots for Parents Alexa skill ("tail tots parent", general audience).
 *   2. The TailTots mobile and web apps.
 *   3. The TailTots website (launch-interest form).
 *
 * Placeholders the family must fill before release: Tailtots,
 * hello@tailtots.com, September 24, 2026. Everything else is finished copy.
 */
export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5 text-sm font-semibold leading-7 text-[#4f625b]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">
        Effective date: September 24, 2026
      </p>
      <p>
        This Privacy Policy describes how Tailtots (&ldquo;TailTots,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
        handles information in our products: the TailTots website, the TailTots mobile apps, and the
        &ldquo;TailTots for Parents&rdquo; Alexa skill. TailTots is a parent-guided platform that helps
        children build responsibility, kindness, and money skills through real-world missions. Parents
        stay in control of every step.
      </p>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">The TailTots for Parents Alexa skill</h2>
        <p className="mt-2">
          &ldquo;TailTots for Parents&rdquo; (invocation: &ldquo;tail tots parent&rdquo;) is a <strong>general-audience,
          parent-facing</strong> Alexa skill. It is not directed at children. It helps a parent or guardian
          hear which missions are awaiting approval, approve missions by voice, add parent-assigned
          missions, review children&apos;s progress and Kid Bank balances, and ask for activity ideas that
          help children build life skills such as responsibility, kindness, confidence, money skills,
          independence, patience, teamwork, and honesty.
        </p>
        <p className="mt-2">
          In demo mode &mdash; the mode the skill ships in &mdash; <strong>the skill collects no personal
          data through Alexa</strong>:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>No account linking. You never sign in to a TailTots account from the skill.</li>
          <li>No Alexa permissions are requested. The skill does not ask for your name, email address, phone number, or location.</li>
          <li>No voice recordings are stored by us. We receive only the text of your requests through the Alexa platform; we do not record or keep audio.</li>
          <li>Mission, approval, and Kid Bank data in demo mode is sample data and is not tied to your identity.</li>
        </ul>
        <p className="mt-2">
          If the AI activity-idea feature is ever connected to a live AI service, the only information sent
          to that service with a request is the <strong>child&apos;s first name, age band, and the requested
          life skill</strong> (for example, &ldquo;kindness&rdquo;). Nothing identifying is sent, no family
          profile is transmitted, and the skill always shows you the suggested ideas and asks before saving
          anything as a mission. AI-generated suggestions are disclosed to you when they are offered. The
          skill never offers an open-ended chat with a child &mdash; the AI feature is parent-facing only.
        </p>
        <p className="mt-2">
          The Alexa skill has no advertising, no in-app purchases, no paid content, and no links to external
          sites.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">The TailTots mobile and web apps</h2>
        <p className="mt-2">
          TailTots collects only what a family types or uploads itself:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Parent-provided contact details (for example, an email address and city on the launch-interest form).</li>
          <li>Family profile information a parent enters: household name, parent names, children&apos;s names and ages, and pet details.</li>
          <li>Photos a family chooses to add, such as pet passport photos and family profile pictures.</li>
          <li>App activity a family creates: missions, Kid Bank ledger entries, badges, growth-log moments, and parent approvals.</li>
        </ul>
        <p className="mt-2">
          Where this information is stored depends on which side of the app you are using. The
          <strong>kids&apos; side of the app always stores everything only on your device</strong> (in the
          app&apos;s local storage) &mdash; it has no account, no sign-in, and no cloud sync, and it never
          sends family data anywhere on its own. Parents can also create an <strong>optional parent
          account</strong>: sign-in is by email magic link only, and we never store a password for you.
          When a parent is signed in, the family&apos;s account data &mdash; the family profile, missions,
          Kid Bank ledger entries, badges, growth-log moments, approvals, and photos a parent adds &mdash;
          is stored in our secure backend database (<strong>Supabase</strong> Postgres). That database is
          protected by <strong>row-level security</strong>, so one family&apos;s data can never be read or
          changed by another family.
        </p>
        <p className="mt-2">
          The parent-gated AI section of the web app includes an activity-idea helper for parents, powered
          by Cloudflare Workers AI. When a parent asks for ideas, the only information sent with the
          request is the <strong>child&apos;s first name, age band, and the requested life skill</strong>
          (for example, &ldquo;kindness&rdquo;). Suggestions are disclosed as AI-generated when they are
          offered, and a parent reviews every suggestion before anything is saved as a mission. The helper
          does not engage in open-ended chat, gives no medical, mental-health, financial, or other
          professional advice, and is never shown to children &mdash; it lives behind the parent passcode
          gate.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Pet readiness</h2>
        <p className="mt-2">
          TailTots helps families practice pet-care responsibility through the Pet Readiness Journey. The
          following are always true:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A pet is a living commitment &mdash; <strong>never a prize</strong> for completing missions.</li>
          <li>Completing missions or a readiness journey <strong>does not guarantee adoption</strong> or mean a family is entitled to a pet.</li>
          <li><strong>Parents make the final decision</strong> about whether, when, and how to welcome a pet.</li>
          <li>TailTots readiness practice <strong>does not replace shelter screening</strong> or veterinary guidance.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Children&apos;s privacy</h2>
        <p className="mt-2">
          TailTots is designed for children to use <strong>with a parent or guardian&apos;s permission and
          involvement</strong>. Parent-only areas of the app &mdash; family setup, approvals, and account
          features &mdash; sit behind a parent passcode gate. The Alexa skill is parent-facing and is not
          directed at children. We do not knowingly collect personal information directly from children
          without a parent&apos;s involvement, and we never sell children&apos;s data.
        </p>
        <p className="mt-2">
          Parents may review their children&apos;s information in the app at any time, and may delete it by
          removing the relevant profiles or clearing the app&apos;s data on the device. For a signed-in
          parent account, parents may also request deletion of the family&apos;s account data stored in
          Supabase. To request help with access, correction, or deletion, contact us at hello@tailtots.com.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">What we never do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>No advertising in any TailTots product, and no behavioral advertising to children.</li>
          <li>No analytics SDKs, tracking pixels, or cross-app tracking.</li>
          <li>No precise location collection.</li>
          <li>No social sign-in providers and no in-app purchases. Parent sign-in is by email magic link only, and we never store a password for you.</li>
          <li>No public profiles, stranger messaging, public rankings, or open child chat.</li>
          <li>No sale or rental of family data to anyone.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Camera and photos</h2>
        <p className="mt-2">
          In the mobile and web apps, if you choose &ldquo;Take Photo&rdquo; when adding a pet or profile
          picture, the app asks for camera access solely to capture the photo you requested. If you choose a
          photo from your library, the system photo picker is used. Photos added on the kids&apos; side stay
          on your device as part of your family&apos;s local data; photos a signed-in parent adds are stored
          with the family account in Supabase, as described above. The Alexa skill does not use the camera.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Data security and retention</h2>
        <p className="mt-2">
          Data on the kids&apos; side of the apps stays on the device, so keeping it safe means keeping
          your device itself secure (device passcode, OS updates); deleting the app or clearing its data
          removes it. Data in a signed-in parent account is stored in Supabase with row-level security so
          families are isolated from one another, and is protected in transit with encryption. We keep
          parent-account information only while the account is active; a parent may ask us to delete the
          family&apos;s account data at any time by contacting hello@tailtots.com. The
          Alexa skill in demo mode retains nothing about you or your family.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Changes to this policy</h2>
        <p className="mt-2">
          If we change how TailTots handles information &mdash; for example, if the kids&apos; side of the
          apps ever gains cloud features, or when a live AI service is connected to the Alexa skill &mdash; we
          will update this policy and note the new effective date before the change takes effect.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Contact us</h2>
        <p className="mt-2">
          Questions about this policy or about your family&apos;s information: contact Tailtots
          at hello@tailtots.com.
        </p>
      </section>
    </div>
  );
}
