import { ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import PageFooter from "@/components/PageFooter";
import TickerBanner from "@/components/TickerBanner";

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <TickerBanner />
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">About 4GO</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 text-foreground">
        <section className="space-y-3">
          <p className="text-muted-foreground leading-relaxed">
            4GO is a next-generation social platform that blends communication, entertainment, creator growth, and digital monetization into a unified experience. Developed by <strong className="text-foreground">4GO Technology LTD</strong>, the platform is designed to empower users not only to connect with others, but also to build influence, participate in interactive communities, and unlock earning opportunities through meaningful engagement.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Unlike conventional social or messaging platforms that focus solely on communication, 4GO introduces a dynamic ecosystem where participation, creativity, consistency, and community interaction can create real value.
          </p>
          <p className="text-muted-foreground leading-relaxed">On 4GO, users can:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2">
            <li>Engage in private and group conversations</li>
            <li>Discover and connect with new people</li>
            <li>Build influence through a structured ranking and level system</li>
            <li>Send and receive virtual gifts</li>
            <li>Participate in contests and platform activities</li>
            <li>Complete tasks and earn platform rewards</li>
            <li>Unlock advanced creator monetization features</li>
            <li>Apply for premium and verification features</li>
            <li>Withdraw eligible earnings securely under platform guidelines</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed italic">
            The platform is built around a simple philosophy: social activity should create value — socially, creatively, and economically.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">Core Features</h2>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">1. Communication</h3>
            <p className="text-muted-foreground text-sm">
              4GO provides an interactive communication environment that allows users to connect freely and build communities. Features include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Private messaging (DMs)</li>
              <li>Group chats and rooms</li>
              <li>Friend and follower system</li>
              <li>User discovery tools</li>
              <li>Interactive engagement features</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">2. Growth & Ranking System</h3>
            <p className="text-muted-foreground text-sm">
              4GO rewards consistent and meaningful participation through a structured progression system. Users can grow through various stages and ranks based on:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Platform activity</li>
              <li>Engagement quality</li>
              <li>Community participation</li>
              <li>Task completion</li>
              <li>Content interaction</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Advanced levels, including Professional and Master Level, unlock additional platform privileges and monetization opportunities.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">3. Monetization & Creator Economy</h3>
            <p className="text-muted-foreground text-sm">
              4GO operates a hybrid creator economy designed to support creators, encourage engagement, and maintain platform sustainability. Users may earn through:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Referral rewards</li>
              <li>Daily activity rewards</li>
              <li>Platform tasks and engagements</li>
              <li>Contest participation</li>
              <li>Virtual gifts</li>
              <li>Monetized content interactions</li>
              <li>Eligible post views</li>
              <li>Creator support features</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Certain monetization features are only available to users who meet platform eligibility requirements, including Master Level creators.
            </p>

            <h4 className="text-sm font-semibold text-foreground mt-3">Digital Coins & Rewards</h4>
            <p className="text-muted-foreground text-sm">
              4GO uses a virtual coin system for gifting, rewards, engagement features, and creator support. Coins on the platform may originate from different sources, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Purchased coins</li>
              <li>Reward coins</li>
              <li>Promotional or gifted coins</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Although coins may appear visually similar within the app, their platform utility, redemption eligibility, and earning value may differ depending on source, usage, engagement type, creator level, premium interaction, and platform policies.
            </p>
            <p className="text-muted-foreground text-sm">Some rewards, gifts, or promotional earnings may:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Be non-withdrawable</li>
              <li>Be restricted to in-app usage</li>
              <li>Be usable only for specific platform features such as gifting, active hours, boosts, or participation tools</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              4GO reserves the right to determine and adjust coin valuation systems, engagement weighting, earning formulas, and redemption eligibility in order to maintain platform integrity, fairness, and sustainability.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">4. Premium Membership</h3>
            <p className="text-muted-foreground text-sm">
              4GO offers optional premium subscriptions that provide enhanced platform features and experience. Premium features may include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Reduced or ad-free experience</li>
              <li>Increased withdrawal limits</li>
              <li>Enhanced visibility and engagement benefits</li>
              <li>Access to exclusive features</li>
              <li>Profile enhancements</li>
              <li>Priority platform features</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Premium membership does not guarantee monetization approval, earnings, or account verification.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">5. Verification System</h3>
            <p className="text-muted-foreground text-sm">
              Eligible users at Professional Level or higher may apply for account verification. Verification applications may require:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Identity confirmation</li>
              <li>Eligibility review</li>
              <li>Compliance checks</li>
              <li>Payment of applicable verification processing fees</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Verification is granted at the discretion of 4GO and may be revoked if platform policies are violated.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">6. Withdrawal System</h3>
            <p className="text-muted-foreground text-sm">
              4GO provides structured withdrawal access for eligible earnings under secure conditions. Withdrawals are subject to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Minimum withdrawal thresholds</li>
              <li>Account verification</li>
              <li>Fraud prevention reviews</li>
              <li>Platform compliance checks</li>
              <li>Monetization eligibility requirements</li>
            </ul>
            <p className="text-muted-foreground text-sm">
              Current withdrawal limits and policies may be adjusted periodically based on platform operations, security requirements, and economic sustainability.
            </p>
          </div>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold">Our Mission</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To create a digital ecosystem where communication, creativity, and participation can translate into meaningful opportunities for users, especially within emerging digital economies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">Our Vision</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To become a leading global social and creator platform where people can connect, express themselves, grow communities, and unlock sustainable digital opportunities without barriers.
          </p>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold">Company Information</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Company Name:</strong> 4GO Technology LTD</p>
            <p><strong className="text-foreground">Founder:</strong>{" "}
              <Link to="/founder" className="text-primary underline">Adekeye Segun Lukman</Link>
            </p>
            <p><strong className="text-foreground">Country:</strong> Nigeria</p>
            <p><strong className="text-foreground">Website:</strong>{" "}
              <a href="https://4go.com.ng" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                https://4go.com.ng
              </a>
            </p>
          </div>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "4GO Technology LTD",
            alternateName: "4GO",
            url: "https://4go.com.ng",
            logo: "https://4go.com.ng/icons/icon-192.png",
            founder: { "@type": "Person", name: "Adekeye Segun Lukman" },
            foundingLocation: { "@type": "Country", name: "Nigeria" },
            description:
              "4GO is a next-generation social platform blending communication, entertainment, creator growth, and digital monetization, built by 4GO Technology LTD in Nigeria.",
            sameAs: ["https://4go.com.ng"],
            contactPoint: [{
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "4gotechnologiesltd@gmail.com",
              availableLanguage: ["English"],
              areaServed: "NG",
            }],
          }),
        }}
      />

      <PageFooter showBackHome />
    </div>
  );
}
