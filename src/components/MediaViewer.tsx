import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "image" | "video";
  url: string;
}

export default function MediaViewer({ open, onOpenChange, type, url }: MediaViewerProps) {
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
