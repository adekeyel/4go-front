import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFooter from "@/components/PageFooter";
import TickerBanner from "@/components/TickerBanner";

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <TickerBanner />
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Privacy Policy</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 text-foreground">
        <p className="text-xs text-muted-foreground">Effective Date: 1st May, 2027</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          4GO Technology LTD ("4GO", "we", "our", or "us") is committed to protecting your privacy and ensuring transparency in how your information is collected, used, and safeguarded. This Privacy Policy explains how we handle your data when you access or use the 4GO platform, including our website and application.
        </p>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">1. Information We Collect</h2>
          <p className="text-muted-foreground text-sm">We collect information necessary to provide, improve, and secure our services.</p>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">1.1 Personal Information</h3>
            <p className="text-muted-foreground text-sm">When you create or use an account, we may collect:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Phone number</li>
              <li>Email address</li>
              <li>Username</li>
              <li>Profile picture</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">1.2 Device Information</h3>
            <p className="text-muted-foreground text-sm">We automatically collect certain technical data, including:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Device type</li>
              <li>Operating system</li>
              <li>Device identifiers</li>
              <li>IP address</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">1.3 Location Information</h3>
            <p className="text-muted-foreground text-sm">We may collect general location data such as:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Country</li>
              <li>Region</li>
              <li>Approximate geographic location</li>
            </ul>
            <p className="text-muted-foreground text-sm">We do not collect precise real-time GPS location unless explicitly required and permitted.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">1.4 Usage Information</h3>
            <p className="text-muted-foreground text-sm">To operate monetization and engagement systems, we collect:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Chat activity (metadata, not private message content unless required for moderation)</li>
              <li>Ranking progress</li>
              <li>Task completion records</li>
              <li>Engagement activity (views, interactions, participation)</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>To provide and maintain the 4GO platform</li>
            <li>To enable monetization features and calculate earnings</li>
            <li>To process rewards, referrals, and withdrawals</li>
            <li>To personalize user experience</li>
            <li>To improve platform performance and features</li>
            <li>To detect, prevent, and investigate fraud or abuse</li>
            <li>To provide customer support</li>
            <li>To send important notifications (system updates, account alerts, rewards)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">3. Legal Basis for Processing</h2>
          <p className="text-muted-foreground text-sm">Where applicable, we process your data based on:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Your consent</li>
            <li>Performance of a contract (providing 4GO services)</li>
            <li>Legitimate interests (fraud prevention, platform improvement)</li>
            <li>Legal obligations under Nigerian law</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">4. Data Sharing and Disclosure</h2>
          <p className="text-muted-foreground text-sm">We do not sell your personal information. We may share your data with trusted third parties under strict conditions:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Service Providers (hosting, analytics, infrastructure)</li>
            <li>Payment Processors (to facilitate withdrawals and payouts)</li>
            <li>Fraud Detection Systems (to maintain platform integrity)</li>
            <li>Legal Authorities (when required by law or to protect rights and safety)</li>
          </ul>
          <p className="text-muted-foreground text-sm">All third parties are required to handle your data securely and only for specified purposes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">5. Data Retention</h2>
          <p className="text-muted-foreground text-sm">We retain your information only as long as necessary to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Provide services</li>
            <li>Comply with legal obligations</li>
            <li>Resolve disputes</li>
            <li>Enforce our policies</li>
          </ul>
          <p className="text-muted-foreground text-sm">When data is no longer required, it is securely deleted or anonymized.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">6. Data Security</h2>
          <p className="text-muted-foreground text-sm">We implement appropriate technical and organizational measures, including:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Encryption and secure storage</li>
            <li>Access control systems</li>
            <li>Fraud monitoring mechanisms</li>
          </ul>
          <p className="text-muted-foreground text-sm">However, no digital system is completely secure. Users are responsible for safeguarding their login credentials.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">7. Your Rights</h2>
          <p className="text-muted-foreground text-sm">Depending on applicable laws, you may have the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Access your personal data</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your data</li>
            <li>Object to certain processing activities</li>
            <li>Withdraw consent where applicable</li>
          </ul>
          <p className="text-muted-foreground text-sm">Requests can be made through our support channels.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">8. Age Requirement</h2>
          <p className="text-muted-foreground text-sm">4GO is intended for individuals 18 years and above. By using the platform, you confirm that:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>You meet the minimum age requirement</li>
            <li>You are legally capable of entering into binding agreements</li>
          </ul>
          <p className="text-muted-foreground text-sm">Accounts found to belong to underage users may be removed.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">9. Account Suspension & Data Use</h2>
          <p className="text-muted-foreground text-sm">We may monitor and review accounts to ensure compliance. Accounts may be suspended or terminated if they:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Use fake or manipulated engagement</li>
            <li>Abuse monetization systems</li>
            <li>Operate multiple accounts fraudulently</li>
            <li>Violate platform rules</li>
          </ul>
          <p className="text-muted-foreground text-sm">Relevant data may be retained for investigation and legal compliance.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">10. International Data Transfers</h2>
          <p className="text-muted-foreground text-sm">If data is processed outside your country, we ensure appropriate safeguards are in place to protect your information in accordance with applicable laws.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">11. Changes to This Privacy Policy</h2>
          <p className="text-muted-foreground text-sm">We may update this Privacy Policy periodically.</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Updates will be posted within the app or website</li>
            <li>Continued use of 4GO means you accept the updated policy</li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold">12. Contact Information</h2>
          <p className="text-muted-foreground text-sm">If you have questions or concerns about this Privacy Policy, you may contact:</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">4GO Technology LTD</strong></p>
            <p>Website:{" "}
              <a href="https://4go.com.ng" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://4go.com.ng</a>
            </p>
            <p>Email:{" "}
              <a href="mailto:4gotechnologiesltd@gmail.com" className="text-primary underline">4gotechnologiesltd@gmail.com</a>
            </p>
          </div>
        </section>
      </div>

      <PageFooter showBackHome />
    </div>
  );
}
