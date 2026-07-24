import { useCallContext } from "@/contexts/CallContext";
import CallOverlay from "@/components/CallOverlay";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";

interface FriendRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function GlobalCallOverlay() {
  const call = useCallContext();
  const { user } = useAuth();
  const [peerName, setPeerName] = useState("User");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (call.incomingCall) setPeerName(call.incomingCall.name);
  }, [call.incomingCall]);

  const loadFriends = async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const { data: rels } = await supabase
        .from("friends")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");
      const ids = (rels || []).map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id));
      const inCallIds = new Set(call.participants.map((p) => p.peerId));
      const filteredIds = ids.filter((id) => !inCallIds.has(id));
      if (filteredIds.length === 0) { setFriends([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", filteredIds);
      setFriends(profs || []);
    } finally {
      setLoadingFriends(false);
    }
  };

  const openPicker = () => { setPickerOpen(true); void loadFriends(); };

  if (call.callState === "idle") return null;

  const canAdd = call.callState === "connected" && call.participants.length < 3;

  return (
    <>
      <CallOverlay
        callState={call.callState}
        callType={call.callType}
        peerName={peerName}
        participants={call.participants}
        incomingCall={call.incomingCall}
        isMuted={call.isMuted}
        isCameraOff={call.isCameraOff}
        isSpeakerOn={call.isSpeakerOn}
        isScreenSharing={call.isScreenSharing}
        localVideoRef={call.localVideoRef}
        remoteVideoRef={call.remoteVideoRef}
        remoteAudioRef={call.remoteAudioRef}
        onAnswer={call.answerCall}
        onReject={call.rejectCall}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onToggleCamera={call.toggleCamera}
        onToggleSpeaker={call.toggleSpeaker}
        onToggleScreenShare={call.toggleScreenShare}
        onAddParticipant={openPicker}
        canAddParticipant={canAdd}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="z-[300]">
          <DialogHeader>
            <DialogTitle>Add to call</DialogTitle>
          </DialogHeader>
          {loadingFriends ? (
            <p className="text-sm text-muted-foreground">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends available to add.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {friends.map((f) => (
                <div key={f.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                  <UserAvatar name={f.display_name || f.username} url={f.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.display_name || f.username || "User"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await call.addParticipant(f.user_id, f.display_name || f.username || "User");
                      setPickerOpen(false);
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
