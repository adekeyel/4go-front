import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { openSponsor } from "@/lib/sponsor";

interface SponsorGateDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  continueLabel?: string;
  cancelLabel?: string;
  /** Called after the sponsor tab has been opened */
  onContinue: () => void;
  /** Called when the user backs out */
  onCancel: () => void;
}

export default function SponsorGateDialog({
  open,
  title = "Quick visit to our sponsor",
  description = "To continue, please visit our sponsor in a new tab. It only takes a moment and helps keep 4GO free.",
  continueLabel = "Continue",
  cancelLabel = "Cancel",
  onContinue,
  onCancel,
}: SponsorGateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[340px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-display flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1 h-10 text-xs" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            className="flex-1 h-10 text-xs"
            onClick={() => {
              openSponsor();
              onContinue();
            }}
          >
            {continueLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}