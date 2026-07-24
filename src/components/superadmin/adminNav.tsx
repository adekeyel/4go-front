import {
  LayoutDashboard, Activity, HeartPulse, Users, BadgeCheck, Wifi, Crown, UserX, Trash2,
  MessagesSquare, Lock, UsersRound, Archive, MessageSquareOff, BarChart3, Flag, Image,
  Video, Mic, Bot, Boxes, Radio, Megaphone, ShieldAlert, ShieldCheck, Building2,
  CreditCard, ReceiptText, LineChart, Undo2, LogIn, AlertTriangle, Smartphone, Globe,
  Search as SearchIcon, LifeBuoy, Inbox, ArrowUpRight, Headphones, Bell, Mail,
  Speaker, Tag, TrendingUp, Repeat, Settings, SlidersHorizontal, Database, KeyRound,
  ScrollText, Trophy, Send,
  Briefcase, Network, UserCheck,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
}

export const adminNav: AdminNavGroup[] = [
  {
    label: "My Pipeline",
    icon: Briefcase,
    items: [
      { id: "employee-home", label: "My Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "live-activity", label: "Live Activity Feed", icon: Activity },
      { id: "system-health", label: "System Health", icon: HeartPulse },
    ],
  },
  {
    label: "User Management",
    icon: Users,
    items: [
      { id: "users-all", label: "All Users", icon: Users },
      { id: "users-verified", label: "Verified Users", icon: BadgeCheck },
      { id: "users-online", label: "Online Users", icon: Wifi },
      { id: "users-premium", label: "Premium Users", icon: Crown },
      { id: "users-suspended", label: "Suspended Users", icon: UserX },
      { id: "users-deleted", label: "Deleted Accounts", icon: Trash2 },
    ],
  },
  {
    label: "Chat Management",
    icon: MessagesSquare,
    items: [
      { id: "chats-private", label: "Private Chats", icon: Lock },
      { id: "chats-group", label: "Group Chats", icon: UsersRound },
      { id: "chats-archived", label: "Archived Chats", icon: Archive },
      { id: "chats-deleted", label: "Deleted Chats", icon: MessageSquareOff },
      { id: "chats-analytics", label: "Message Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Content Moderation",
    icon: Flag,
    items: [
      { id: "mod-messages", label: "Reported Messages", icon: Flag },
      { id: "mod-images", label: "Reported Images", icon: Image },
      { id: "mod-videos", label: "Reported Videos", icon: Video },
      { id: "mod-voice", label: "Reported Voice Notes", icon: Mic },
      { id: "mod-ai", label: "AI Moderation Queue", icon: Bot },
    ],
  },
  {
    label: "Community",
    icon: Boxes,
    items: [
      { id: "comm-groups", label: "Groups", icon: UsersRound },
      { id: "comm-channels", label: "Channels", icon: Radio },
      { id: "comm-broadcast", label: "Broadcast Communities", icon: Megaphone },
      { id: "comm-reports", label: "Community Reports", icon: ShieldAlert },
    ],
  },
  {
    label: "Verification",
    icon: ShieldCheck,
    items: [
      { id: "verify-user", label: "User Verification", icon: BadgeCheck },
      { id: "verify-creator", label: "Creator Verification", icon: Crown },
      { id: "verify-business", label: "Business Verification", icon: Building2 },
    ],
  },
  {
    label: "Monetization",
    icon: CreditCard,
    items: [
      { id: "mon-plans", label: "Subscription Plans", icon: Tag },
      { id: "mon-premium", label: "Premium Users", icon: Crown },
      { id: "mon-payments", label: "Payment History", icon: ReceiptText },
      { id: "mon-revenue", label: "Revenue Analytics", icon: LineChart },
      { id: "mon-refunds", label: "Refund Management", icon: Undo2 },
    ],
  },
  {
    label: "Security Center",
    icon: ShieldAlert,
    items: [
      { id: "sec-login", label: "Login Activity", icon: LogIn },
      { id: "sec-suspicious", label: "Suspicious Accounts", icon: AlertTriangle },
      { id: "sec-devices", label: "Device Management", icon: Smartphone },
      { id: "sec-ip", label: "IP Monitoring", icon: Globe },
      { id: "sec-fraud", label: "Fraud Detection", icon: SearchIcon },
    ],
  },
  {
    label: "Customer Support",
    icon: LifeBuoy,
    items: [
      { id: "sup-tickets", label: "Support Tickets", icon: Inbox },
      { id: "sup-complaints", label: "User Complaints", icon: Flag },
      { id: "sup-escalated", label: "Escalated Cases", icon: ArrowUpRight },
      { id: "sup-live", label: "Live Chat Support", icon: Headphones },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { id: "mkt-push", label: "Push Notifications", icon: Bell },
      { id: "mkt-email", label: "Email Campaigns", icon: Mail },
      { id: "mkt-announce", label: "In-App Announcements", icon: Speaker },
      { id: "mkt-delivery", label: "Delivery Status", icon: Send },
      { id: "mkt-promos", label: "Promotions", icon: Tag },
      { id: "mkt-contests", label: "Contests", icon: Trophy },
    ],
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { id: "an-growth", label: "User Growth", icon: TrendingUp },
      { id: "an-chat", label: "Chat Activity", icon: MessagesSquare },
      { id: "an-engagement", label: "Engagement", icon: Activity },
      { id: "an-retention", label: "Retention", icon: Repeat },
      { id: "an-revenue", label: "Revenue", icon: LineChart },
    ],
  },
  {
    label: "Team",
    icon: Briefcase,
    items: [
      { id: "team-employees", label: "Employees", icon: UserCheck },
      { id: "team-activity", label: "Employee Activity", icon: ScrollText },
      { id: "team-active-users", label: "Active Users", icon: Network },
    ],
  },
  {
    label: "Advertisements",
    icon: Megaphone,
    items: [
      { id: "ads-advertisers", label: "Advertisers", icon: Building2 },
      { id: "ads-banners", label: "Banner Management", icon: Image },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { id: "set-admins", label: "Admin Accounts", icon: ShieldCheck },
      { id: "set-audit", label: "Audit Logs", icon: ScrollText },
      { id: "set-app", label: "App Configuration", icon: SlidersHorizontal },
      { id: "set-chat", label: "Chat Settings", icon: MessagesSquare },
      { id: "set-mod", label: "Moderation Rules", icon: ShieldCheck },
      { id: "set-storage", label: "Storage Settings", icon: Database },
      { id: "set-api", label: "API Settings", icon: KeyRound },
    ],
  },
];

export const navItemLabel = (id: string): string => {
  for (const g of adminNav) {
    const it = g.items.find((i) => i.id === id);
    if (it) return it.label;
  }
  return "Dashboard";
};

export type AdminRoleKey = "super_admin" | "moderator" | "support" | "employee";

// Which sidebar groups each role can access. Super admins see everything.
const ROLE_GROUPS: Record<Exclude<AdminRoleKey, "super_admin">, string[]> = {
  moderator: [
    "Dashboard",
    "User Management",
    "Chat Management",
    "Content Moderation",
    "Community",
    "Team",
    "Analytics",
  ],
  support: ["Dashboard", "Customer Support"],
  employee: ["My Pipeline"],
};

// Items only Super Admins may see, even inside a group shared with other roles.
const SUPER_ADMIN_ONLY_ITEMS = new Set(["team-active-users"]);

export function navForRole(role: AdminRoleKey | null): AdminNavGroup[] {
  if (!role || role === "super_admin") {
    // Super admins see everything except the personal employee pipeline group.
    return adminNav.filter((g) => g.label !== "My Pipeline");
  }
  const allowed = ROLE_GROUPS[role] ?? [];
  return adminNav
    .filter((g) => allowed.includes(g.label))
    .map((g) => ({ ...g, items: g.items.filter((i) => !SUPER_ADMIN_ONLY_ITEMS.has(i.id)) }))
    .filter((g) => g.items.length > 0);
}

// Flat set of section ids a role may open (for guarding active section).
export function allowedIdsForRole(role: AdminRoleKey | null): Set<string> {
  return new Set(navForRole(role).flatMap((g) => g.items.map((i) => i.id)));
}

export const ROLE_LABELS: Record<AdminRoleKey, string> = {
  super_admin: "Super Admin",
  moderator: "Moderator",
  support: "Support",
  employee: "Employee",
};