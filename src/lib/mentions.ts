import React from "react";
import { Link } from "react-router-dom";
import ProfileBadges from "@/components/ProfileBadges";

// Match @username (letters, numbers, underscores, dots, 2-30 chars)
export const MENTION_REGEX = /@([a-zA-Z0-9_.]{2,30})/g;

/** Extract unique @usernames from a string. */
export function extractMentionHandles(text: string): string[] {
  const set = new Set<string>();
  text.replace(MENTION_REGEX, (_, handle) => {
    set.add(handle.toLowerCase());
    return _;
  });
  return [...set];
}

/**
 * Render text with @mentions as links to the mentioned user's profile (if known)
 * and URLs as anchors.
 */
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export function renderRichText(
  text: string,
  mentionMap: Record<string, { user_id: string; display_name?: string | null }> = {}
): React.ReactNode[] {
  if (!text) return [];
  // First split on URLs, then within each non-URL chunk split on mentions.
  const out: React.ReactNode[] = [];
  let key = 0;
  const urlParts = text.split(URL_REGEX);
  for (const part of urlParts) {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      out.push(
        React.createElement(
          "a",
          {
            key: key++,
            href: part,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-primary underline break-all hover:text-primary/80",
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          },
          part
        )
      );
      continue;
    }
    // Mentions inside this chunk
    const mentionParts = part.split(MENTION_REGEX);
    for (let i = 0; i < mentionParts.length; i++) {
      const seg = mentionParts[i];
      // Pattern: text, handle, text, handle, ...
      if (i % 2 === 1) {
        const handle = seg;
        const target = mentionMap[handle.toLowerCase()];
        if (target) {
          out.push(
            React.createElement(
              Link,
              {
                key: key++,
                to: `/profile/${target.user_id}`,
                className: "text-primary font-semibold hover:underline",
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
              },
              `@${handle}`
            )
          );
          out.push(
            React.createElement(ProfileBadges, {
              key: key++,
              userId: target.user_id,
              size: "xs",
              className: "ml-0.5",
            })
          );
        } else {
          out.push(
            React.createElement(
              "span",
              { key: key++, className: "text-primary font-semibold" },
              `@${handle}`
            )
          );
        }
      } else if (seg) {
        out.push(seg);
      }
    }
  }
  return out;
}
