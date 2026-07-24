import { Link } from "react-router-dom";
import { Heart, MessageCircle, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import UserAvatar from "@/components/UserAvatar";

interface BasePreview {
  id: string;
  content: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
}

interface UserPreview extends BasePreview {
  kind: "user";
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface PagePreview extends BasePreview {
  kind: "page";
  page_id: string;
  page_name: string | null;
  page_avatar: string | null;
  unique_views_count: number;
}

export type PreviewItem = UserPreview | PagePreview;

export default function CommunityPreviewCard({ item }: { item: PreviewItem }) {
  const to =
    item.kind === "user"
      ? `/feed?post=${item.id}`
      : `/page-post/${item.id}`;

  const name = item.kind === "user" ? item.display_name || "User" : item.page_name || "Page";
  const avatar = item.kind === "user" ? item.avatar_url : item.page_avatar;

  return (
    <Link
      to={to}
      className="block bg-muted/30 hover:bg-muted/50 transition-colors rounded-xl p-3"
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <UserAvatar url={avatar} name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
      {item.content && (
        <p className="text-sm text-foreground/90 line-clamp-2 mb-2 break-words">
          {item.content}
        </p>
      )}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" /> {item.likes_count || 0}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-3.5 h-3.5" /> {item.comments_count || 0}
        </span>
        {item.kind === "page" && (
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {item.unique_views_count?.toLocaleString?.() ?? 0}
          </span>
        )}
      </div>
    </Link>
  );
}
