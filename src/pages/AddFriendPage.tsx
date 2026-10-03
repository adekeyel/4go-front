import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import * as friendsApi from "@/api/friends";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AddFriendPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<{ user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const searchByUsername = async () => {
    const q = username.trim();
    if (!q || !user) return;
    setLoading(true);
    setResults([]);
    try {
      const { data } = await apiClient.get("/profiles", { params: { q } });
      setResults((data as typeof results).filter((r) => r.user_id !== user.id));
    } catch (err) {
      toast.error(axios.isAxiosError(err) ? err.response?.data?.error : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const searchByPhone = async () => {
    const q = phone.trim();
    if (!q || !user) return;
    setLoading(true);
    setResults([]);
    try {
      const { data } = await apiClient.get("/profiles", { params: { phone: q } });
      setResults((data as typeof results).filter((r) => r.user_id !== user.id));
    } catch (err) {
      toast.error(axios.isAxiosError(err) ? err.response?.data?.error : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;
    setSending(addresseeId);
    try {
      await friendsApi.sendFriendRequest(addresseeId);
      toast.success("Friend request sent! 🤝");
    } catch (err) {
      // The backend already de-dupes (409 if a request/friendship already exists).
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.info(err.response.data?.error || "Request already sent!");
      } else {
        toast.error("Failed to send request");
      }
    }
    setSending(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-primary-foreground">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-display font-bold text-primary-foreground">Add Friend</h1>
      </div>

      <div className="px-4 pt-4">
        <Tabs defaultValue="username" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="username">Username</TabsTrigger>
            <TabsTrigger value="phone">Phone</TabsTrigger>
          </TabsList>

          <TabsContent value="username" className="mt-4 space-y-3">
            <form
              onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); searchByUsername(); return false; }}
              action="javascript:void(0)"
              className="flex gap-2"
              noValidate
            >
              <Input
                placeholder="Search by username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 rounded-xl flex-1 text-base"
                autoComplete="off"
                inputMode="text"
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-xl gradient-primary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="phone" className="mt-4 space-y-3">
            <form
              onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); searchByPhone(); return false; }}
              action="javascript:void(0)"
              className="flex gap-2"
              noValidate
            >
              <Input
                placeholder="Enter phone number..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl flex-1 text-base"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-xl gradient-primary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Results */}
        <div className="mt-6 space-y-2">
          {loading && <p className="text-center text-muted-foreground text-sm py-4">Searching...</p>}
          {!loading && results.length === 0 && (username || phone) && (
            <p className="text-center text-muted-foreground text-sm py-4">No users found</p>
          )}
          {results.map((u) => (
            <div key={u.user_id} className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-card">
              <UserAvatar name={u.display_name || u.username} url={u.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username}</p>
                {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={(e) => { e.preventDefault(); sendFriendRequest(u.user_id); }}
                disabled={sending === u.user_id}
                className="rounded-lg gradient-primary text-primary-foreground"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                {sending === u.user_id ? "..." : "Add"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
