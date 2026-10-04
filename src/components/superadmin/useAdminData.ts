import { useCallback, useEffect, useRef, useState } from "react";
import * as adminApi from "@/api/admin";

export interface AdminUser {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  rank: string;
  coins: number;
  is_online: boolean | null;
  is_premium: boolean | null;
  is_verified: boolean | null;
  is_suspended: boolean | null;
  is_monetized: boolean | null;
  last_seen: string | null;
  created_at: string;
}

export interface AdminReport {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  target_room_id: string | null;
  target_message_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

export interface AdminSub {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  amount_ngn: number | null;
  current_period_end: string | null;
  created_at: string;
}

export interface AdminRoom {
  id: string;
  name: string;
  type: string;
  is_active: boolean | null;
  max_members?: number | null;
  member_count?: number;
  message_count?: number;
  created_at: string;
}

export interface Kpis {
  totalUsers: number;
  activeToday: number;
  onlineUsers: number;
  messagesToday: number;
  newToday: number;
  reportedMessages: number;
  bannedUsers: number;
  revenue: number;
}

export interface PlatformStats {
  total_users: number;
  online_users: number;
  suspended_users: number;
  verified_users: number;
  premium_users: number;
  active_today: number;
  new_today: number;
  messages_today: number;
  total_messages: number;
  total_rooms: number;
  group_rooms: number;
  dm_rooms: number;
  pending_reports: number;
  total_reports: number;
  total_revenue: number;
  active_subs: number;
  mrr: number;
  pending_withdrawals: number;
}

const EMPTY_STATS: PlatformStats = {
  total_users: 0, online_users: 0, suspended_users: 0, verified_users: 0, premium_users: 0,
  active_today: 0, new_today: 0, messages_today: 0, total_messages: 0, total_rooms: 0,
  group_rooms: 0, dm_rooms: 0, pending_reports: 0, total_reports: 0, total_revenue: 0,
  active_subs: 0, mrr: 0, pending_withdrawals: 0,
};

export function useAdminData(search = "") {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpis>({
    totalUsers: 0, activeToday: 0, onlineUsers: 0, messagesToday: 0,
    newToday: 0, reportedMessages: 0, bannedUsers: 0, revenue: 0,
  });
  const [stats, setStats] = useState<PlatformStats>(EMPTY_STATS);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSub[]>([]);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const searchRef = useRef(search);
  searchRef.current = search;
  const mounted = useRef(false);

  // Each call is allowed to fail on its own: the backend limits some of these to certain staff roles
  // (e.g. subscriptions are Super Admin only), and a 403 should leave that panel empty, not break the page.
  const loadUsers = useCallback(async (q: string) => {
    const base = await adminApi.listUsers<AdminUser>(undefined, 1000).catch(() => [] as AdminUser[]);
    // Also search by name on the server so people outside the newest batch can still be found.
    const found = q.trim() ? await adminApi.listUsers<AdminUser>(q.trim(), 1000).catch(() => [] as AdminUser[]) : [];
    const seen = new Set<string>();
    const merged: AdminUser[] = [];
    for (const u of [...base, ...found]) {
      if (seen.has(u.user_id)) continue;
      seen.add(u.user_id);
      // Moderators and support staff get a trimmed profile (no phone number or coins).
      merged.push({ ...u, phone_number: u.phone_number ?? null, coins: u.coins ?? 0, rank: u.rank ?? "" });
    }
    return merged;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [users, reports, subs, rooms, statsRes] = await Promise.all([
      loadUsers(searchRef.current),
      adminApi.listReports<AdminReport>().catch(() => [] as AdminReport[]),
      adminApi.listSubscriptions<AdminSub>({ limit: 500 }).catch(() => [] as AdminSub[]),
      adminApi.listAdminRooms<AdminRoom>().catch(() => [] as AdminRoom[]),
      adminApi.getPlatformStats<PlatformStats>().catch(() => null),
    ]);

    const s = statsRes || EMPTY_STATS;

    setUsers(users);
    setReports(reports);
    setSubscriptions(subs);
    setRooms(rooms);
    setStats(s);
    setKpis({
      totalUsers: s.total_users,
      activeToday: s.active_today,
      onlineUsers: s.online_users,
      messagesToday: s.messages_today,
      newToday: s.new_today,
      reportedMessages: s.pending_reports,
      bannedUsers: s.suspended_users,
      revenue: Number(s.total_revenue) || 0,
    });
    setLoading(false);
  }, [loadUsers]);

  useEffect(() => { void load(); }, [load]);

  // Typing in the top search box only re-queries users (after a short pause), not everything.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const t = window.setTimeout(() => { void loadUsers(search).then(setUsers); }, 300);
    return () => window.clearTimeout(t);
  }, [search, loadUsers]);

  return { loading, kpis, stats, users, reports, subscriptions, rooms, refresh: load, setUsers, setReports };
}