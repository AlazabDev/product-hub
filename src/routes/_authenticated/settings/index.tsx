import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useUserRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, Users, Key, Shield, Plus, Trash2, Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "الاعدادات — Alazab PAOP" }] }),
  component: SettingsPage,
});

interface ApiConsumer {
  id: string;
  name: string;
  api_key: string;
  channel: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

function SettingsPage() {
  const { user } = useAuth();
  const role = useUserRole();
  const queryClient = useQueryClient();
  const [showAddApi, setShowAddApi] = useState(false);
  const [newApiName, setNewApiName] = useState("");
  const [newApiChannel, setNewApiChannel] = useState("web");

  // Fetch API consumers
  const { data: apiConsumers, isLoading: loadingApi } = useQuery({
    queryKey: ["api-consumers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_consumers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApiConsumer[];
    },
    enabled: role === "admin",
  });

  // Fetch user roles
  const { data: userRoles, isLoading: loadingRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserRole[];
    },
    enabled: role === "admin",
  });

  // Create API key mutation
  const createApiMutation = useMutation({
    mutationFn: async () => {
      const apiKey = `ak_${crypto.randomUUID().replace(/-/g, "")}`;
      const { error } = await supabase.from("api_consumers").insert({
        name: newApiName,
        api_key: apiKey,
        channel: newApiChannel,
        created_by: user?.id,
      });
      if (error) throw error;
      return apiKey;
    },
    onSuccess: (apiKey) => {
      toast.success("تم انشاء مفتاح API بنجاح");
      navigator.clipboard.writeText(apiKey);
      toast.info("تم نسخ المفتاح الى الحافظة");
      queryClient.invalidateQueries({ queryKey: ["api-consumers"] });
      setShowAddApi(false);
      setNewApiName("");
    },
    onError: () => {
      toast.error("حدث خطا اثناء انشاء المفتاح");
    },
  });

  // Toggle API key status
  const toggleApiMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("api_consumers")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-consumers"] });
      toast.success("تم تحديث حالة المفتاح");
    },
  });

  // Delete API key
  const deleteApiMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_consumers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-consumers"] });
      toast.success("تم حذف المفتاح");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ الى الحافظة");
  };

  const roleLabels: Record<string, string> = {
    admin: "مدير",
    editor: "محرر",
    viewer: "مشاهد",
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="size-6" />
          الاعدادات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ادارة اعدادات النظام والمستخدمين ومفاتيح API
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
          {role === "admin" && (
            <>
              <TabsTrigger value="users">المستخدمون</TabsTrigger>
              <TabsTrigger value="api">مفاتيح API</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="p-6 surface-elevated border-0">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="size-5" />
              معلومات الحساب
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">البريد الالكتروني</Label>
                <div className="mt-1 text-sm num" dir="ltr">
                  {user?.email}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">معرف المستخدم</Label>
                <div className="mt-1 text-xs num text-muted-foreground" dir="ltr">
                  {user?.id}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">الدور</Label>
                <div className="mt-1">
                  <Badge variant="outline" className="bg-accent/15 text-accent">
                    {role ? roleLabels[role] : "غير محدد"}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {role === "admin" && (
          <TabsContent value="users" className="space-y-4">
            <Card className="p-6 surface-elevated border-0">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="size-5" />
                ادارة المستخدمين
              </h3>

              {loadingRoles && (
                <div className="text-center text-muted-foreground py-8">جاري التحميل...</div>
              )}

              {!loadingRoles && userRoles?.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  لا يوجد مستخدمون مسجلون
                </div>
              )}

              <div className="divide-y">
                {userRoles?.map((ur) => (
                  <div key={ur.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm num" dir="ltr">
                        {ur.user_id.slice(0, 12)}...
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(ur.created_at).toLocaleDateString("ar")}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        ur.role === "admin"
                          ? "bg-destructive/15 text-destructive"
                          : ur.role === "editor"
                            ? "bg-accent/15 text-accent"
                            : "bg-muted text-muted-foreground"
                      }
                    >
                      {roleLabels[ur.role]}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        )}

        {role === "admin" && (
          <TabsContent value="api" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Key className="size-5" />
                مفاتيح API
              </h3>
              <Button onClick={() => setShowAddApi(true)}>
                <Plus className="size-4 ml-1" />
                مفتاح جديد
              </Button>
            </div>

            {loadingApi && (
              <Card className="p-8 text-center text-muted-foreground surface-elevated border-0">
                جاري التحميل...
              </Card>
            )}

            {!loadingApi && apiConsumers?.length === 0 && (
              <Card className="p-8 text-center surface-elevated border-0">
                <Key className="size-12 mx-auto text-muted-foreground mb-3" />
                <div className="text-lg font-semibold">لا توجد مفاتيح API</div>
                <p className="text-sm text-muted-foreground mt-1">
                  انشئ مفتاح API للسماح بالوصول للبيانات من تطبيقات خارجية
                </p>
              </Card>
            )}

            <div className="grid gap-3">
              {apiConsumers?.map((api) => (
                <Card key={api.id} className="p-4 surface-elevated border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{api.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            api.is_active
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {api.is_active ? "نشط" : "معطل"}
                        </Badge>
                        <Badge variant="outline">{api.channel}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-xs num bg-secondary px-2 py-1 rounded" dir="ltr">
                          {api.api_key.slice(0, 20)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(api.api_key)}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          الطلبات:{" "}
                          <span className="num">{api.total_requests.toLocaleString()}</span>
                        </span>
                        <span>
                          الحد: <span className="num">{api.rate_limit_per_minute}</span>/دقيقة
                        </span>
                        {api.last_used_at && (
                          <span>
                            اخر استخدام: {new Date(api.last_used_at).toLocaleDateString("ar")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleApiMutation.mutate({ id: api.id, isActive: api.is_active })
                        }
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteApiMutation.mutate(api.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showAddApi} onOpenChange={setShowAddApi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>انشاء مفتاح API جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>اسم التطبيق</Label>
              <Input
                value={newApiName}
                onChange={(e) => setNewApiName(e.target.value)}
                placeholder="مثال: تطبيق الموبايل"
                className="mt-1"
              />
            </div>
            <div>
              <Label>القناة</Label>
              <Select value={newApiChannel} onValueChange={setNewApiChannel}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">ويب</SelectItem>
                  <SelectItem value="mobile">موبايل</SelectItem>
                  <SelectItem value="erp">ERP</SelectItem>
                  <SelectItem value="other">اخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddApi(false)}>
              الغاء
            </Button>
            <Button
              onClick={() => createApiMutation.mutate()}
              disabled={!newApiName || createApiMutation.isPending}
            >
              انشاء المفتاح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
