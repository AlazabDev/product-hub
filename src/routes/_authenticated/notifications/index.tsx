import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bell, Activity, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({ meta: [{ title: "الإشعارات والنشاط — Alazab PAOP" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: notifications = [], isLoading: nLoading } = useQuery({
    queryKey: ["notifications-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: activity = [], isLoading: aLoading } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="size-6 text-accent" />
          الإشعارات والنشاط
        </h1>
        <p className="text-sm text-muted-foreground mt-1">مركز كل الإشعارات وسجل النشاط اللحظي على المنصة</p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="size-3.5" /> الإشعارات</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="size-3.5" /> سجل النشاط</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4 space-y-2">
          {nLoading ? (
            <Loader2 className="size-6 animate-spin mx-auto my-12 text-muted-foreground" />
          ) : notifications.length === 0 ? (
            <Card className="p-12 text-center surface-elevated border-0">
              <Bell className="size-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">لا توجد إشعارات</p>
            </Card>
          ) : notifications.map((n) => (
            <Card key={n.id} className={`p-4 surface-elevated border-0 ${!n.is_read ? "border-r-2 border-r-accent" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={n.kind === "error" ? "destructive" : n.kind === "warning" ? "secondary" : "outline"}>
                      {n.kind}
                    </Badge>
                    {!n.is_read && <span className="size-2 rounded-full bg-accent" />}
                  </div>
                  {n.link ? (
                    <Link to={n.link} className="font-semibold hover:text-accent">{n.title}</Link>
                  ) : <div className="font-semibold">{n.title}</div>}
                  {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {aLoading ? (
            <Loader2 className="size-6 animate-spin mx-auto my-12 text-muted-foreground" />
          ) : activity.length === 0 ? (
            <Card className="p-12 text-center surface-elevated border-0">
              <Activity className="size-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">لا يوجد نشاط</p>
            </Card>
          ) : activity.map((a) => (
            <Card key={a.id} className="p-3 surface-elevated border-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-8 rounded bg-accent/10 grid place-items-center shrink-0">
                  <Activity className="size-3.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    <span className="text-accent">{a.action}</span>
                    <span className="text-muted-foreground"> · {a.entity_type}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground num truncate" dir="ltr">{a.entity_id}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0 num" dir="ltr">
                {new Date(a.created_at).toLocaleString("en-GB")}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
