import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { navForRole, ROLE_LABELS, type AdminRoleKey } from "./adminNav";
import { cn } from "@/lib/utils";

interface Props {
  active: string;
  onSelect: (id: string) => void;
  role: AdminRoleKey | null;
}

export default function AdminSidebar({ active, onSelect, role }: Props) {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const nav = navForRole(role);
  const activeGroup = nav.find((g) => g.items.some((i) => i.id === active))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(nav.map((g) => [g.label, g.label === (activeGroup ?? "Dashboard")])),
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-display text-base font-bold text-sidebar-foreground">4GO Admin</p>
              <p className="text-[11px] text-sidebar-foreground/60">{role ? ROLE_LABELS[role] : "Admin"} Console</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {nav.map((group) => {
          const isOpen = collapsed ? true : (open[group.label] ?? false);
          return (
            <Collapsible
              key={group.label}
              open={isOpen}
              onOpenChange={(v) => setOpen((p) => ({ ...p, [group.label]: v }))}
            >
              <SidebarGroup className="py-1">
                {!collapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="group/label flex cursor-pointer items-center justify-between text-sidebar-foreground/60 hover:text-sidebar-foreground">
                      <span className="flex items-center gap-2">
                        <group.icon className="h-3.5 w-3.5" />
                        {group.label}
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={active === item.id}
                            tooltip={item.label}
                            onClick={() => handleSelect(item.id)}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}