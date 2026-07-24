import { ReactNode, useState } from "react";
import { usePremium } from "@/hooks/usePremium";
import {
  READ_MORE_WORD_LIMIT,
  openReadMoreAd,
  shouldShowReadMoreAd,
} from "@/lib/sponsor";

interface Props {
  text: string;
  postId: string;
  className?: string;
  render: (t: string) => ReactNode;
}

/**
 * Renders post text, collapsing anything past ~600 words behind a "Read more"
 * button. On the first expand (per post, once per 6h) non-premium users are
 * shown a sponsor ad; the remaining text is revealed once they return.
 */
export default function ExpandablePostText({ text, postId, className, render }: Props) {
  const { isPremium } = usePremium();
  const [expanded, setExpanded] = useState(false);

  const words = text.split(/\s+/);
  const isLong = words.length > READ_MORE_WORD_LIMIT;

  if (!isLong || expanded) {
    return <p className={className}>{render(text)}</p>;
  }

  const preview = words.slice(0, READ_MORE_WORD_LIMIT).join(" ");

  const handleMore = () => {
    if (!isPremium && shouldShowReadMoreAd(postId)) {
      openReadMoreAd();
      const reveal = () => {
        setExpanded(true);
        window.removeEventListener("focus", reveal);
      };
      // Reveal the rest once the user closes the ad tab and returns.
      window.addEventListener("focus", reveal);
      // Fallback in case the focus event never fires.
      setTimeout(() => setExpanded(true), 5000);
    } else {
      setExpanded(true);
    }
  };

  return (
    <p className={className}>
      {render(preview)}
      {"… "}
      <button
        type="button"
        onClick={handleMore}
        className="text-primary font-medium hover:underline"
      >
        Read more
      </button>
    </p>
  );
}