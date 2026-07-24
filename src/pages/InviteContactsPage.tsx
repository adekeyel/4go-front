import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Contact, Share2, MessageCircle, Copy, Check, Users, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";

interface PickedContact {
  name: string[];
  tel?: string[];
  email?: string[];
}

interface ContactMatch {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  contact_name: string | null;
  is_friend: boolean;
  has_pending_request: boolean;
}

// Extend Navigator for Contact Picker API (Chrome Android)
declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean }
      ) => Promise<PickedContact[]>;
    };
  }
  interface ContactsManager {
    select: (
      properties: string[],
      options?: { multiple?: boolean }
    ) => Promise<PickedContact[]>;
  }
}

export default function InviteContactsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<PickedContact[]>([]);
  const [copied, setCopied] = useState(false);
  const [invitedIndexes, setInvitedIndexes] = useState<Set<number>>(new Set());
  const [matches, setMatches] = useState<ContactMatch[]>([]);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const referralCode = profile?.referral_code;
  const inviteLink = typeof window !== "undefined" ? window.location.origin : "https://4go.com.ng";
  const inviteText = referralCode
    ? `Hey! Join me on 4GO — a fun social app where you chat, earn coins, and connect with people. Use my referral code: ${referralCode}\n${inviteLink}`
    : `Hey! Join me on 4GO — a fun social app where you chat, earn coins, and connect with people.\n${inviteLink}`;

  const supportsContactPicker = typeof navigator !== "undefined" && "contacts" in navigator;

  const normalizePhone = (value: string) => value.replace(/[^0-9]/g, "");

  const sha256Hex = async (value: string) => {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const syncPickedContacts = async (selected: PickedContact[]) => {
    if (!user) return;

    if (!window.isSecureContext || !crypto?.subtle) {
      toast.error("Secure contact hashing is not available in this browser");
      return;
    }

    const rows = await Promise.all(
      selected.flatMap((contact) => {
        const contactName = contact.name?.[0] || null;
        return (contact.tel || [])
          .map(normalizePhone)
          .filter((phone) => phone.length >= 7)
          .map(async (phone) => ({
            owner_id: user.id,
            contact_name: contactName,
            phone_hash: await sha256Hex(phone),
          }));
      })
    );

    const dedupedRows = Array.from(new Map(rows.map((row) => [row.phone_hash, row])).values());
    if (dedupedRows.length === 0) {
      setMatches([]);
      toast.info("No valid phone numbers were found in the selected contacts");
      return;
    }

    await supabase.from("device_contacts").delete().eq("owner_id", user.id);
    const { error: insertError } = await supabase.from("device_contacts").insert(dedupedRows as any);
    if (insertError) throw insertError;

    const { data, error } = await supabase.rpc("find_contact_matches", {
      p_user_id: user.id,
      p_limit: 50,
    });
    if (error) throw error;
    setMatches((data || []) as ContactMatch[]);
  };

  const pickContacts = async () => {
    if (!navigator.contacts || !user) {
      toast.error("Contact Picker is not supported on this browser");
      return;
    }
    try {
      setSyncingContacts(true);
      const selected = await navigator.contacts.select(["name", "tel", "email"], {
        multiple: true,
      });
      if (selected.length > 0) {
        setContacts(selected);
        await syncPickedContacts(selected);
        toast.success(`${selected.length} contact${selected.length > 1 ? "s" : ""} selected`);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Could not access contacts");
      }
    } finally {
      setSyncingContacts(false);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;
    setSendingTo(addresseeId);
    try {
      const { data: existing } = await supabase
        .from("friends")
        .select("id, status")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        toast.info(existing.status === "accepted" ? "Already friends" : "Friend request already exists");
        return;
      }

      const { error } = await supabase.from("friends").insert({
        requester_id: user.id,
        addressee_id: addresseeId,
      });
      if (error) throw error;

      setMatches((prev) => prev.map((match) => (
        match.user_id === addresseeId ? { ...match, has_pending_request: true } : match
      )));
      toast.success("Friend request sent!");
    } catch {
      toast.error("Failed to send friend request");
    } finally {
      setSendingTo(null);
    }
  };

  const inviteViaSMS = (contact: PickedContact, index: number) => {
    const phone = contact.tel?.[0];
    if (!phone) {
      toast.error("No phone number for this contact");
      return;
    }
    const encoded = encodeURIComponent(inviteText);
    window.open(`sms:${phone}?body=${encoded}`, "_blank");
    setInvitedIndexes((prev) => new Set(prev).add(index));
  };

  const inviteViaWhatsApp = (contact: PickedContact, index: number) => {
    const phone = contact.tel?.[0]?.replace(/[^0-9+]/g, "");
    if (!phone) {
      toast.error("No phone number for this contact");
      return;
    }
    const encoded = encodeURIComponent(inviteText);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    setInvitedIndexes((prev) => new Set(prev).add(index));
  };

  const shareGeneric = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join 4GO", text: inviteText });
      } catch {}
    } else {
      await copyLink();
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteText);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-display font-bold text-foreground">Invite Friends</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite your friends to 4GO and earn 500 coins for each friend who joins!
        </p>
      </div>

      <div className="px-4 space-y-4">
        {/* Quick share section */}
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              Quick Share
            </h2>

            <div className="flex gap-2">
              <Button onClick={shareGeneric} className="flex-1 gap-2 h-11">
                <Share2 className="w-4 h-4" />
                Share Invite
              </Button>
              <Button variant="outline" onClick={copyLink} className="gap-2 h-11">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            {referralCode && (
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Your referral code</p>
                <p className="text-lg font-display font-bold text-foreground tracking-widest">{referralCode}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact picker section */}
        {supportsContactPicker && (
          <Card className="border-0 shadow-elevated">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Contact className="w-4 h-4 text-primary" />
                From Your Contacts
              </h2>

              <Button
                variant="secondary"
                onClick={pickContacts}
                disabled={syncingContacts}
                className="w-full gap-2 h-11"
              >
                {syncingContacts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {contacts.length > 0 ? "Find More Friends from Contacts" : "Find Friends from Contacts"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Your contact phone numbers are hashed in the browser before they are synced for matching.
              </p>

              {matches.length > 0 && (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">Registered on 4GO</p>
                    <span className="text-[10px] text-muted-foreground">{matches.length} match{matches.length > 1 ? "es" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {matches.map((match) => {
                      const disabled = match.is_friend || match.has_pending_request || sendingTo === match.user_id;
                      return (
                        <div key={match.user_id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="shrink-0">
                              <div className="rounded-full">
                                <img
                                  src={match.avatar_url || "/placeholder.svg"}
                                  alt={match.display_name || match.username || "User"}
                                  className="h-10 w-10 rounded-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">{match.display_name || match.username || "User"}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {match.contact_name ? `${match.contact_name} • ` : ""}
                                {match.username ? `@${match.username}` : "On 4GO"}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={disabled}
                            onClick={() => sendFriendRequest(match.user_id)}
                            className="h-8 rounded-lg gap-1"
                          >
                            {sendingTo === match.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                            {match.is_friend ? "Friends" : match.has_pending_request ? "Pending" : "Add"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {contacts.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {contacts.map((c, i) => {
                    const name = c.name?.[0] || "Unknown";
                    const phone = c.tel?.[0] || "";
                    const invited = invitedIndexes.has(i);

                    return (
                      <div
                        key={`${name}-${phone}-${i}`}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          {phone && (
                            <p className="text-xs text-muted-foreground truncate">{phone}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant={invited ? "outline" : "default"}
                            className="h-8 px-2.5 text-xs gap-1"
                            onClick={() => inviteViaSMS(c, i)}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            SMS
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-2.5 text-xs gap-1"
                            onClick={() => inviteViaWhatsApp(c, i)}
                          >
                            💬 WA
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fallback for browsers without Contact Picker */}
        {!supportsContactPicker && (
          <Card className="border-0 shadow-elevated">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Invite via Messaging
              </h2>
              <p className="text-xs text-muted-foreground">
                Your browser doesn't support contact picking. Use the buttons below to invite friends directly.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 gap-2 h-11 text-sm"
                  onClick={() => {
                    const encoded = encodeURIComponent(inviteText);
                    window.open(`sms:?body=${encoded}`, "_blank");
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Send SMS
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 gap-2 h-11 text-sm"
                  onClick={() => {
                    const encoded = encodeURIComponent(inviteText);
                    window.open(`https://wa.me/?text=${encoded}`, "_blank");
                  }}
                >
                  💬 WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
