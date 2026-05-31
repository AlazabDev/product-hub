import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPaletteProvider, useCommandPalette } from "@/components/command-palette";
import { getBreadcrumbs } from "@/lib/nav-registry";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <CommandPaletteProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background" dir="rtl">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <Main />
          </div>
        </div>
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}

function TopBar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const crumbs = getBreadcrumbs(path);
  const { setOpen } = useCommandPalette();

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card/80 backdrop-blur px-3 md:px-4 sticky top-0 z-20">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger />
        <nav className="hidden md:flex items-center gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
          <Link to="/dashboard" className="hover:text-foreground transition-colors shrink-0">
            الرئيسية
          </Link>
          {crumbs.map((c, i) => (
            <span key={c.to} className="flex items-center gap-1 min-w-0">
              <ChevronLeft className="size-3 shrink-0 text-muted-foreground/50" />
              {i === crumbs.length - 1 ? (
                <span className="text-foreground font-medium truncate">{c.label}</span>
              ) : (
                <Link to={c.to} className="hover:text-foreground transition-colors truncate">
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border rounded-md px-2.5 py-1.5 transition-colors"
          aria-label="فتح لوحة الأوامر"
        >
          <Search className="size-3.5" />
          <span>بحث سريع</span>
          <kbd className="num text-[10px] bg-background border border-border rounded px-1 py-0.5">⌘K</kbd>
        </button>
        <NotificationBell />
      </div>
    </header>
  );
}

function Main() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const ref = useRef<HTMLElement>(null);
  // Scroll-to-top on route change for a clean transition.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  return (
    <main ref={ref} className="flex-1 overflow-auto">
      <div key={path} className="animate-in fade-in duration-200">
        <Outlet />
      </div>
    </main>
  );
}
