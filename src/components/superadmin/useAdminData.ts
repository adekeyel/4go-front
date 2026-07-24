import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  max_members: number | null;
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

export function useAdminData() {
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const adminId = authData.user?.id;

    const [usersRes, reportsRes, subsRes, roomsRes, statsRes] = await Promise.all([
      supabase.from("profiles").select("user_id,display_name,username,avatar_url,phone_number,rank,coins,is_online,is_premium,is_verified,is_suspended,is_monetized,last_seen,created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("moderation_reports").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("subscriptions").select("id,user_id,plan,status,amount_ngn,current_period_end,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("rooms").select("id,name,type,is_active,max_members,created_at").order("created_at", { ascending: false }).limit(500),
      adminId
        ? (supabase.rpc as any)("admin_platform_stats", { p_admin_id: adminId })
        : Promise.resolve({ data: null }),
    ]);

    const subs = (subsRes.data || []) as AdminSub[];
    const s = (statsRes?.data as PlatformStats | null) || EMPTY_STATS;

    setUsers((usersRes.data || []) as AdminUser[]);
    setReports((reportsRes.data || []) as AdminReport[]);
    setSubscriptions(subs);
    setRooms((roomsRes.data || []) as AdminRoom[]);
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
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { loading, kpis, stats, users, reports, subscriptions, rooms, refresh: load, setUsers, setReports };
}