import { useState, useMemo } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LogOut, Search, Command } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/nav-registry";
import { useCommandPalette } from "@/components/command-palette";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const role = useUserRole();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { setOpen } = useCommandPalette();
  const [filter, setFilter] = useState("");

  const sections = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const grouped: Record<string, typeof NAV_ITEMS> = {};
    for (const item of NAV_ITEMS) {
      if (f) {
        const hay = `${item.title} ${item.keywords?.join(" ") ?? ""}`.toLowerCase();
        if (!hay.includes(f)) continue;
      }
      (grouped[item.group] ||= []).push(item);
    }
    return grouped;
  }, [filter]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="size-9 shrink-0 rounded-md bg-accent text-accent-foreground grid place-items-center font-bold">
            AZ
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sidebar-foreground truncate">Alazab PAOP</div>
              <div className="text-[10px] text-sidebar-foreground/60 truncate">
                Product Asset Operations
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-2 pb-2 space-y-1.5">
            <div className="relative">
              <Search className="size-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/50" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="فلترة القائمة..."
                className="h-8 text-xs pr-7 bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
              />
            </div>
            <button
              onClick={() => setOpen(true)}
              className="w-full flex items-center justify-between gap-2 text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors rounded-md px-2 py-1.5"
            >
              <span className="flex items-center gap-1.5">
                <Command className="size-3" />
                لوحة الأوامر
              </span>
              <kbd className="num text-[10px] bg-sidebar/60 border border-sidebar-border rounded px-1">
                ⌘K
              </kbd>
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {Object.entries(sections).map(([label, items]) => (
          <SidebarGroup key={label}>
            {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active =
                    currentPath === item.to || currentPath.startsWith(item.to + "/");
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="size-4 shrink-0" />
                          {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {!collapsed && Object.keys(sections).length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-sidebar-foreground/60">
            لا توجد نتائج لـ "{filter}"
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2 space-y-2">
          {!collapsed && role && (
            <div className="text-[10px] text-sidebar-foreground/60 px-2">
              الدور:{" "}
              <span className="text-accent font-semibold">
                {role === "admin" ? "مدير" : role === "editor" ? "محرر" : "مشاهد"}
              </span>
            </div>
          )}
          <SidebarMenuButton onClick={signOut} tooltip="تسجيل خروج">
            <LogOut className="size-4" />
            {!collapsed && <span>تسجيل خروج</span>}
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
