/**
 * Shared TailTots privacy policy content, rendered both by the Next.js
 * /privacy route (the published policy URL) and by the in-app privacy
 * overlay (so the policy is reachable inside the mobile builds, which have
 * no router).
 *
 * The policy covers three products with their own sections:
 *   1. The TailTots for Parents Alexa skill ("tail tots", general audience).
 *   2. The TailTots mobile and web apps.
 *   3. The TailTots website (launch-interest form).
 *
 * Placeholders the family must fill before release: Tailtots,
 * hello@tailtots.com, June 30, 2026. Everything else is finished copy.
 */
export function PrivacyPolicyContent() {
  return (
    <div className="space-y-5 text-sm font-semibold leading-7 text-[#4f625b]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">
        Effective date: June 30, 2026
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
          &ldquo;TailTots for Parents&rdquo; (invocation: &ldquo;tail tots&rdquo;) is a <strong>general-audience,
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
          In the current version of the app, all of this information is stored <strong>only on your
          device</strong> (in the app&apos;s local storage). It is not sent to our servers, because there
          are none connected in this build. If a future version connects a secure family account backend,
          this policy will be updated before that version ships.
        </p>
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
          removing the relevant profiles or clearing the app&apos;s data on the device. To request help with
          access, correction, or deletion, contact us at hello@tailtots.com.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">What we never do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>No advertising in any TailTots product, and no behavioral advertising to children.</li>
          <li>No analytics SDKs, tracking pixels, or cross-app tracking.</li>
          <li>No precise location collection.</li>
          <li>No third-party sign-in providers and no in-app purchases.</li>
          <li>No public profiles, stranger messaging, public rankings, or open child chat.</li>
          <li>No sale or rental of family data to anyone.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Camera and photos</h2>
        <p className="mt-2">
          In the mobile and web apps, if you choose &ldquo;Take Photo&rdquo; when adding a pet or profile
          picture, the app asks for camera access solely to capture the photo you requested. If you choose a
          photo from your library, the system photo picker is used. Photos you add are stored on your device
          as part of your family&apos;s data, as described above. The Alexa skill does not use the camera.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Data security and retention</h2>
        <p className="mt-2">
          Because family data stays on the device in the current version of the apps, keeping it safe means
          keeping your device itself secure (device passcode, OS updates). We keep the information only as
          long as your family keeps using the app; deleting the app or clearing its data removes it. The
          Alexa skill in demo mode retains nothing about you or your family.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#17231f]">Changes to this policy</h2>
        <p className="mt-2">
          If we change how TailTots handles information &mdash; for example, when a secure family-account
          backend becomes available, or when a live AI service is connected to the Alexa skill &mdash; we
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
