import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import AdVideoPlayer from "@/components/pages/AdVideoPlayer";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "image" | "video";
  url: string;
  /** For a video shared in a chat room: its message id. Together with adsEnabled it lets the video show ads. */
  messageId?: string;
  /** Room videos show ads (Premium members never see them); private 1:1 chats don't. */
  adsEnabled?: boolean;
}

export default function MediaViewer({ open, onOpenChange, type, url, messageId, adsEnabled }: MediaViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none flex items-center justify-center [&>button]:hidden">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
        >
          <X className="w-5 h-5" />
        </button>
        {type === "image" ? (
          <img
            src={url}
            alt="Full view"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        ) : adsEnabled && messageId ? (
          // Same player (and the same admin-managed pre/mid/post-roll ads) as page videos. If anything about the ads
          // fails, the video just plays.
          <AdVideoPlayer postId={messageId} source="message" src={url} autoPlay className="max-w-full max-h-[90vh] rounded-lg" />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
