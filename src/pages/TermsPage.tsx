import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFooter from "@/components/PageFooter";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Terms of Service</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 text-foreground">
        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            By accessing or using 4GO, you agree to comply with and be legally bound by these Terms of Service and all applicable platform policies. If you do not agree with any part of these Terms, you must discontinue use of the platform immediately.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">2. Eligibility</h2>
          <p className="text-muted-foreground text-sm">Users must:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Be at least 18 years old or meet the legal age requirement in their jurisdiction</li>
            <li>Provide accurate and up-to-date account information</li>
            <li>Maintain the security of their account credentials</li>
          </ul>
          <p className="text-muted-foreground text-sm">4GO reserves the right to request identity verification at any time.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">3. User Conduct</h2>
          <p className="text-muted-foreground text-sm">Users agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Engage in fraudulent or deceptive activity</li>
            <li>Manipulate engagement systems, views, rewards, or monetization mechanisms</li>
            <li>Use bots, automation tools, fake traffic, or artificial engagement systems</li>
            <li>Harass, abuse, threaten, or impersonate other users</li>
            <li>Upload illegal, harmful, misleading, or inappropriate content</li>
            <li>Attempt to exploit platform vulnerabilities or bypass restrictions</li>
            <li>Sell, transfer, or trade accounts without authorization</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Violation of these rules may result in content removal, monetization restrictions, suspension, or permanent account termination.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">4. Digital Coins, Rewards & Virtual Assets</h2>
          <p className="text-muted-foreground text-sm">
            4GO operates a digital virtual coin system used for engagement, gifting, participation, and creator support. Users acknowledge that:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Coins are digital platform assets and not legal tender or bank currency</li>
            <li>Coins may originate from different sources, including purchased, rewarded, gifted, or promotional distributions</li>
            <li>Coin types may carry different platform values, earning weights, usage rights, or redemption eligibility</li>
            <li>Certain coins, rewards, gifts, or bonuses may be non-withdrawable and restricted to in-platform use</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Platform coin values, engagement multipliers, earning formulas, and redemption conditions may vary depending on:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Coin source</li>
            <li>Creator level</li>
            <li>Premium status</li>
            <li>Engagement quality</li>
            <li>Platform events</li>
            <li>Fraud detection systems</li>
            <li>Monetization policies</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            4GO reserves the right to modify, suspend, limit, or adjust virtual asset systems at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">5. Monetization & Earnings Policy</h2>
          <p className="text-muted-foreground text-sm">
            Monetization features are available only to eligible users under platform guidelines. Users acknowledge that:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Not all platform engagement generates withdrawable earnings</li>
            <li>Earnings may depend on creator level, user interaction quality, premium engagement weighting, content authenticity, and platform policies</li>
            <li>Monetization access may require reaching specific progression levels such as Master Level</li>
            <li>Premium subscriptions and verification do not guarantee earnings</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Artificial inflation of engagement, views, gifts, tasks, referrals, or monetization metrics is strictly prohibited. 4GO reserves the right to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Review earning activity</li>
            <li>Reverse fraudulent earnings</li>
            <li>Limit monetization access</li>
            <li>Suspend withdrawals</li>
            <li>Adjust earning formulas or payout structures</li>
            <li>Deny monetization privileges where abuse is suspected</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">6. Premium Membership & Verification</h2>
          <p className="text-muted-foreground text-sm">
            Premium subscriptions and verification services are optional paid platform features. Users acknowledge that:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Premium subscriptions are non-transferable</li>
            <li>Verification eligibility is subject to platform review</li>
            <li>Verification fees may be charged through approved payment gateways</li>
            <li>Verification may be denied or revoked at the discretion of 4GO</li>
            <li>Premium status does not guarantee monetization eligibility or platform influence</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">7. Withdrawal Policy</h2>
          <p className="text-muted-foreground text-sm">Withdrawals are subject to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Minimum withdrawal thresholds</li>
            <li>Maximum withdrawal limits</li>
            <li>Identity verification</li>
            <li>Fraud prevention reviews</li>
            <li>Compliance and security checks</li>
            <li>Platform monetization requirements</li>
          </ul>
          <p className="text-muted-foreground text-sm">4GO reserves the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Delay withdrawals for security reviews</li>
            <li>Reject suspicious transactions</li>
            <li>Temporarily suspend withdrawal access</li>
            <li>Reverse earnings connected to fraudulent activity</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Withdrawal timelines may vary depending on operational, financial, or regulatory conditions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">8. Content Ownership & License</h2>
          <p className="text-muted-foreground text-sm">
            Users retain ownership of the content they create and upload. By posting content on 4GO, users grant the platform a non-exclusive, worldwide license to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Display</li>
            <li>Distribute</li>
            <li>Promote</li>
            <li>Reproduce</li>
            <li>Recommend</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            such content within the platform ecosystem for operational and promotional purposes. Users remain solely responsible for the legality and originality of their content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">9. Platform Availability</h2>
          <p className="text-muted-foreground text-sm">
            4GO does not guarantee uninterrupted or error-free service availability. The platform may experience interruptions due to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Maintenance</li>
            <li>System upgrades</li>
            <li>Technical failures</li>
            <li>Security incidents</li>
            <li>Third-party service disruptions</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            4GO is not liable for losses resulting from temporary downtime or service interruptions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">10. Suspension & Termination</h2>
          <p className="text-muted-foreground text-sm">4GO reserves the right to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Suspend or terminate accounts involved in suspicious activity</li>
            <li>Restrict monetization access</li>
            <li>Remove content violating platform policies</li>
            <li>Limit access to features or services</li>
            <li>Permanently ban users engaged in repeated abuse or fraud</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            Severe violations may result in permanent loss of platform privileges and virtual assets.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">11. Privacy</h2>
          <p className="text-muted-foreground text-sm">
            User information is handled in accordance with the 4GO Privacy Policy. By using the platform, users consent to the collection, processing, and use of data necessary for:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Platform functionality</li>
            <li>Security</li>
            <li>Fraud prevention</li>
            <li>Monetization systems</li>
            <li>Verification procedures</li>
            <li>Service improvement</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">12. Modifications to Terms</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            4GO reserves the right to modify or update these Terms of Service at any time. Continued use of the platform after updates constitutes acceptance of the revised Terms.
          </p>
        </section>
      </div>

      <PageFooter showBackHome />
    </div>
  );
}
