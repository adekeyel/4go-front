import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as roomsApi from "@/api/rooms";
import * as friendsApi from "@/api/friends";
import * as profilesApi from "@/api/profiles";
import axios from "axios";

import BottomNav from "@/components/BottomNav";
import AclibBanner from "@/components/AclibBanner";
import RoomCard from "@/components/RoomCard";
import UserAvatar from "@/components/UserAvatar";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { Search, UserPlus, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface PageSummary {
  id: string;
  name: string;
  category: string | null;
  profile_image: string | null;
  followers_count: number;
}

interface SuggestedUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  shared_rooms: number;
  mutual_friends: number;
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const { unreadCounts } = useUnreadCounts();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState<(Tables<"rooms"> & { member_count: number })[]>([]);
  const [users, setUsers] = useState<Tables<"profiles">[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [trendingPages, setTrendingPages] = useState<PageSummary[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const data = await friendsApi.getSuggestions(20).catch(() => []);
    setSuggestions(data);
    setSuggestionsLoading(false);
  }, []);

  const fetchTrending = useCallback(async () => {
    const enriched = await roomsApi.browseRooms({ types: ["public", "private"] }).catch(() => []);
    setRooms(enriched.slice(0, 20));
    // "Pages" (business/creator directory) hasn't been ported to the new
    // backend yet — left on Supabase for now, a distinct feature from rooms/chat.
    const { data: pgs } = await supabase
      .from("pages")
      .select("id, name, category, profile_image, followers_count")
      .order("followers_count", { ascending: false })
      .limit(20);
    setTrendingPages(pgs ?? []);
  }, []);

  const searchAll = useCallback(async (q: string) => {
    const [roomsRes, usersRes, pagesRes] = await Promise.all([
      roomsApi.browseRooms({ types: ["public", "private"], q }).catch(() => []),
      profilesApi.searchProfiles(q).catch(() => []),
      supabase.from("pages").select("id, name, category, profile_image, followers_count").ilike("name", `%${q}%`).limit(20),
    ]);
    setRooms(roomsRes);
    setUsers(usersRes);
    setPages(pagesRes.data || []);
  }, []);

  useEffect(() => {
    fetchTrending();
    if (user) fetchSuggestions();
  }, [user, fetchTrending, fetchSuggestions]);

  useEffect(() => {
    if (query.trim()) {
      searchAll(query.trim());
    } else {
      fetchTrending();
      setUsers([]);
      setPages([]);
    }
  }, [query, searchAll, fetchTrending]);

  const sendFriendRequest = async (addresseeId: string) => {
    if (!user) return;
    setSendingTo(addresseeId);
    try {
      await friendsApi.sendFriendRequest(addresseeId);
      toast.success("Friend request sent!");
      setSuggestions((prev) => prev.filter((s) => s.user_id !== addresseeId));
      setUsers((prev) => prev.filter((u) => u.user_id !== addresseeId));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        toast.info("Friend request already exists");
      } else {
        toast.error("Failed to send request");
      }
    } finally {
      setSendingTo(null);
    }
  };

  const connectionLabel = (s: SuggestedUser) => {
    const parts: string[] = [];
    if (s.shared_rooms > 0) parts.push(`${s.shared_rooms} shared room${s.shared_rooms > 1 ? "s" : ""}`);
    if (s.mutual_friends > 0) parts.push(`${s.mutual_friends} mutual friend${s.mutual_friends > 1 ? "s" : ""}`);
    return parts.join(" · ") || "Suggested";
  };

  const pagesToShow = query.trim() ? pages : trendingPages;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-12 pb-3">
        <AclibBanner />
        <h1 className="text-2xl font-display font-bold text-foreground mb-4">Discover</h1>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full h-11 bg-muted rounded-xl pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="px-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
          </TabsList>

          {/* ROOMS */}
          <TabsContent value="rooms" className="mt-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              {query ? "Results" : "🔥 Trending Rooms"}
            </h2>
            {rooms.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No rooms found</p>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    unreadCount={unreadCounts[room.id] || 0}
                    onClick={() => navigate(`/room/${room.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* PEOPLE */}
          <TabsContent value="people" className="mt-4 space-y-5">
            {query.trim() && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">Search results</h2>
                {users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">No people found</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.user_id} className="w-full flex items-center gap-3 p-3 bg-card rounded-xl shadow-card text-left">
                        <UserAvatar name={u.display_name} url={u.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username || "User"}</p>
                          {u.username && <p className="text-xs text-muted-foreground truncate">@{u.username}</p>}
                        </div>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1"
                          disabled={sendingTo === u.user_id}
                          onClick={() => sendFriendRequest(u.user_id)}
                        >
                          {sendingTo === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!query.trim() && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground">People You May Know</h2>
                </div>

                {suggestionsLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    {user ? "Join more rooms to discover people!" : "Sign in to see suggestions."}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {suggestions.map((s) => (
                      <div key={s.user_id} className="bg-card rounded-xl shadow-card p-3 flex flex-col items-center text-center">
                        <div className="mb-2">
                          <UserAvatar name={s.display_name} url={s.avatar_url} size="lg" />
                        </div>
                        <p className="text-xs font-semibold text-foreground truncate w-full">
                          {s.display_name || "User"}
                        </p>
                        {s.username && (
                          <p className="text-[10px] text-muted-foreground truncate w-full">@{s.username}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                          {connectionLabel(s)}
                        </p>
                        <Button
                          size="sm"
                          className="mt-2 w-full h-8 text-xs gap-1"
                          disabled={sendingTo === s.user_id}
                          onClick={() => sendFriendRequest(s.user_id)}
                        >
                          {sendingTo === s.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </TabsContent>

          {/* PAGES */}
          <TabsContent value="pages" className="mt-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              {query ? "Results" : "📄 Popular Pages"}
            </h2>
            {pagesToShow.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No pages found</p>
            ) : (
              <div className="space-y-2">
                {pagesToShow.map((pg) => (
                  <button
                    key={pg.id}
                    onClick={() => navigate(`/pages/${pg.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 bg-card rounded-xl shadow-card text-left"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0">
                      {pg.profile_image ? (
                        <img src={pg.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                          {pg.name?.[0] ?? "P"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{pg.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pg.category} · {pg.followers_count?.toLocaleString?.() ?? 0} followers
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
