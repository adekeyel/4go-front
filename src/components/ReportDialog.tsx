import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSubmit: (reason: string, details: string) => Promise<void>;
}

export default function ReportDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setDetails("");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(reason.trim(), details.trim());
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason"
            maxLength={80}
          />
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Add more details"
            rows={4}
            maxLength={400}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? "Sending..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}