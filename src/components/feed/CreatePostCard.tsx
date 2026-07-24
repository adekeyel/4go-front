import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreatePostCardProps {
  onPostCreated: () => void;
}

export default function CreatePostCard({ onPostCreated }: CreatePostCardProps) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!user || !content.trim()) return;
    setPosting(true);

    try {
      let image_url: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `posts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("chat-media")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: content.trim(),
        image_url,
      });

      if (error) throw error;

      setContent("");
      removeImage();
      onPostCreated();
      toast.success("Post created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="shadow-elevated border-0">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <UserAvatar
            url={profile?.avatar_url}
            name={profile?.display_name || ""}
            size="sm"
          />
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="What's happening on 4GO?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[60px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
            />
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-40 rounded-lg object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                <Image className="w-5 h-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                size="sm"
                onClick={handlePost}
                disabled={posting || !content.trim()}
                className="rounded-full px-5"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
