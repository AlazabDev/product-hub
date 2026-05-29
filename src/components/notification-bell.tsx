import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data as Notification[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 num text-[9px] grid place-items-center rounded-full bg-destructive text-destructive-foreground font-bold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[500px] flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-bold text-sm">الإشعارات</div>
          <div className="flex gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="h-7 text-xs gap-1">
                <CheckCheck className="size-3.5" /> قراءة الكل
              </Button>
            )}
            <Link to="/notifications" className="text-xs text-accent hover:underline self-center px-2">عرض الكل</Link>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`p-3 border-b last:border-0 hover:bg-muted/40 transition ${!n.is_read ? "bg-accent/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link to={n.link} className="font-semibold text-sm hover:text-accent block truncate">{n.title}</Link>
                    ) : (
                      <div className="font-semibold text-sm truncate">{n.title}</div>
                    )}
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={() => markOne.mutate(n.id)} title="تمييز كمقروء">
                      <Check className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
