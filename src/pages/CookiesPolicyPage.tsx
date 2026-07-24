import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFooter from "@/components/PageFooter";

export default function CookiesPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Cookies Policy</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 text-foreground">
        <p className="text-xs text-muted-foreground">Effective Date: 1st May, 2027</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          4GO Technology LTD ("4GO", "we", "our", or "us") uses cookies and similar technologies to enhance your experience, improve platform performance, and support monetization features. This Cookies Policy explains what cookies are, how we use them, and your choices regarding their use when you access or use 4GO.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">1. What Are Cookies?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cookies are small text files stored on your device (phone, tablet, or computer) when you visit a website or use an application. They help platforms recognize your device and remember information about your preferences or activity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">2. Types of Cookies We Use</h2>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">2.1 Essential Cookies</h3>
            <p className="text-muted-foreground text-sm">These cookies are required for the platform to function properly. They are used to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Keep you logged in</li>
              <li>Maintain session security</li>
              <li>Enable navigation between pages</li>
              <li>Prevent fraudulent activity</li>
            </ul>
            <p className="text-muted-foreground text-sm">Without these cookies, 4GO may not function correctly.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">2.2 Performance & Analytics Cookies</h3>
            <p className="text-muted-foreground text-sm">These cookies help us understand how users interact with the platform. They are used to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Track user activity and engagement</li>
              <li>Measure feature performance</li>
              <li>Identify errors and improve system stability</li>
            </ul>
            <p className="text-muted-foreground text-sm">This data helps us optimize the user experience and platform efficiency.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">2.3 Functionality Cookies</h3>
            <p className="text-muted-foreground text-sm">These cookies remember your preferences and settings. They are used to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Save user preferences</li>
              <li>Improve personalized experience</li>
              <li>Enable smoother interactions across sessions</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">2.4 Advertising & Monetization Cookies</h3>
            <p className="text-muted-foreground text-sm">These cookies support revenue generation and ad delivery. They may be used to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Display relevant ads</li>
              <li>Measure ad performance</li>
              <li>Prevent repeated or fraudulent ad interactions</li>
              <li>Support reward-based ad systems</li>
            </ul>
            <p className="text-muted-foreground text-sm">These cookies may be set by third-party advertising partners.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">3. Third-Party Cookies</h2>
          <p className="text-muted-foreground text-sm">We may allow trusted third-party services to place cookies on your device, including:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Advertising networks</li>
            <li>Analytics providers</li>
            <li>Payment and monetization partners</li>
          </ul>
          <p className="text-muted-foreground text-sm">These third parties may collect information about your activity across different websites or services, subject to their own privacy policies. 4GO does not control how third-party cookies operate.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">4. Why We Use Cookies</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Ensure platform functionality and security</li>
            <li>Improve performance and user experience</li>
            <li>Enable monetization features and reward systems</li>
            <li>Analyze usage and engagement</li>
            <li>Support advertising and revenue generation</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-display font-bold">5. Your Choices and Control</h2>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">5.1 Browser Settings</h3>
            <p className="text-muted-foreground text-sm">Most browsers allow you to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
              <li>Block or delete cookies</li>
              <li>Set preferences for certain websites</li>
              <li>Receive alerts before cookies are stored</li>
            </ul>
            <p className="text-muted-foreground text-sm">However, disabling essential cookies may affect how 4GO functions.</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">5.2 In-App Controls (If Available)</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We may provide options within the platform to manage certain cookie preferences, especially for analytics and advertising.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">6. Data Protection</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cookies do not typically contain personally identifiable information. However, they may be linked to your account information to improve functionality and monetization systems. All data collected through cookies is handled in accordance with our Privacy Policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-display font-bold">7. Updates to This Policy</h2>
          <p className="text-muted-foreground text-sm">We may update this Cookies Policy from time to time to reflect:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2 text-sm">
            <li>Changes in technology</li>
            <li>Legal requirements</li>
            <li>Platform improvements</li>
          </ul>
          <p className="text-muted-foreground text-sm">Updates will be posted on the platform, and continued use of 4GO indicates acceptance of the updated policy.</p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-display font-bold">8. Contact Information</h2>
          <p className="text-muted-foreground text-sm">If you have any questions about this Cookies Policy, you may contact:</p>
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
