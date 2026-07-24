import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ImagePlus, Loader2, Lock } from "lucide-react";
import { canCreatePage } from "@/lib/boost";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

const CATEGORIES = [
  "Entertainment", "Education", "Business", "Technology", "Lifestyle",
  "Sports", "News", "Music", "Comedy", "Faith", "Gaming", "Other",
];

export default function CreatePagePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const profileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!user) navigate("/login"); }, [user, navigate]);

  const eligible = canCreatePage(profile?.rank);

  const upload = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/pages/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!user || !name.trim()) { toast.error("Page name is required"); return; }
    setSubmitting(true);
    try {
      const profileUrl = profileFile ? await upload(profileFile, "profile") : null;
      const coverUrl = coverFile ? await upload(coverFile, "cover") : null;
      const { data, error } = await supabase.rpc("create_page", {
        p_owner_id: user.id,
        p_name: name.trim(),
        p_about: about.trim() || null,
        p_category: category,
        p_profile_image: profileUrl,
        p_cover_image: coverUrl,
      });
      if (error) throw error;
      toast.success("Page created!");
      navigate(`/pages/${data}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create page");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-display font-bold text-lg">Create Page</h1>
        </div>
      </header>

      {!eligible ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="font-display font-bold text-lg">Professional rank required</h2>
          <p className="text-sm text-muted-foreground">
            You need to reach <strong>Professional</strong> level to create pages. Your rank: <strong>{profile?.rank ?? "Amateur"}</strong>.
          </p>
          <Button onClick={() => navigate("/ranks")}>View ranks</Button>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Cover */}
          <button
            onClick={() => coverRef.current?.click()}
            className="relative w-full aspect-[3/1] rounded-2xl bg-muted overflow-hidden border border-border"
          >
            {coverPreview ? (
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <ImagePlus className="w-6 h-6 mb-1" />
                <span className="text-xs">Add cover photo</span>
              </div>
            )}
            <input
              ref={coverRef} type="file" accept="image/*" hidden
              onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setCoverFile(f); setCoverPreview(URL.createObjectURL(f));
              }}
            />
          </button>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => profileRef.current?.click()}
              className="relative w-20 h-20 rounded-full bg-muted overflow-hidden border-4 border-card shadow-card -mt-12 ml-1"
            >
              {profilePreview ? (
                <img src={profilePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <ImagePlus className="w-5 h-5" />
                </div>
              )}
              <input
                ref={profileRef} type="file" accept="image/*" hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setProfileFile(f); setProfilePreview(URL.createObjectURL(f));
                }}
              />
            </button>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Page name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Awesome Page" maxLength={60} />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">About</Label>
            <Textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell people what your page is about…"
              maxLength={500}
              rows={4}
            />
          </div>

          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Page"}
          </Button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}