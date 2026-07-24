import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageFooter from "@/components/PageFooter";

export default function FounderPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">About the Founder</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 text-foreground">
        <section className="space-y-3">
          <h2 className="text-xl font-display font-bold">Adekeye Segun Lukman</h2>
          <p className="text-sm text-muted-foreground italic">Founder, 4GO Technology LTD</p>

          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Adekeye Segun Lukman</strong> is a Nigerian entrepreneur and digital innovator with a strong passion for building platforms that empower individuals through technology.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Driven by firsthand experience with the challenges faced by young people in accessing economic opportunities, he envisioned <strong className="text-foreground">4GO</strong> as more than just a social platform — but as a tool for financial empowerment and digital inclusion.
          </p>

          <p className="text-muted-foreground leading-relaxed">His approach combines:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2">
            <li>User-centric product design</li>
            <li>Monetization-driven engagement models</li>
            <li>Scalable digital ecosystems</li>
          </ul>

          <p className="text-muted-foreground leading-relaxed">
            Under his leadership, 4GO is being developed to address a critical gap in the social media landscape — where users actively contribute value but rarely receive financial returns.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            His long-term goal is to position 4GO as a globally recognized platform that allows users, especially in developing economies, to earn, grow, and thrive through digital interaction.
          </p>
        </section>
      </div>

      <PageFooter showBackHome />
    </div>
  );
}
