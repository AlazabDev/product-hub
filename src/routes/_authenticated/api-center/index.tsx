import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, Plus, Trash2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/api-center/")({ component: ApiCenter });

type Consumer = {
  id: string;
  name: string;
  channel: string;
  api_key: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  total_requests: number;
  last_used_at: string | null;
  notes: string | null;
  created_at: string;
};
type Log = {
  id: string;
  consumer_name: string | null;
  channel: string | null;
  endpoint: string;
  method: string;
  status_code: number | null;
  ip_address: string | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
};

function generateKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ApiCenter() {
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("azabot");
  const [rate, setRate] = useState(120);

  const load = async () => {
    setLoading(true);
    const [c, l] = await Promise.all([
      supabase.from("api_consumers").select("*").order("created_at", { ascending: false }),
      supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setConsumers((c.data as Consumer[]) ?? []);
    setLogs((l.data as Log[]) ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    const { error } = await supabase.from("api_consumers").insert({
      name,
      channel,
      api_key: generateKey(),
      rate_limit_per_minute: rate,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء المفتاح");
    setOpen(false);
    setName("");
    load();
  };

  const toggle = async (c: Consumer) => {
    await supabase.from("api_consumers").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("حذف نهائي للمفتاح؟")) return;
    await supabase.from("api_consumers").delete().eq("id", id);
    load();
  };
  const copy = (k: string) => {
    navigator.clipboard.writeText(k);
    toast.success("تم النسخ");
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مركز API</h1>
          <p className="text-sm text-muted-foreground">
            إدارة مفاتيح API للبوتات والتكاملات الخارجية
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="size-4 ml-2" /> تحديث
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نقاط النهاية المتاحة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm font-mono">
          {[
            ["GET", "/api/public/v1/products", "قائمة المنتجات (limit, offset, status, q)"],
            ["GET", "/api/public/v1/products/:azCode", "تفاصيل منتج + صور + أسعار"],
            ["GET", "/api/public/v1/assets", "الأصول (product_id اختياري)"],
            ["GET", "/api/public/v1/pricing", "قائمة الأسعار"],
            ["GET", "/api/public/v1/suppliers", "الموردون"],
          ].map(([m, p, d]) => (
            <div key={p} className="flex items-center gap-3 p-2 rounded border">
              <Badge variant="outline" className="font-bold">
                {m}
              </Badge>
              <code className="flex-1 truncate">
                {baseUrl}
                {p}
              </code>
              <span className="text-xs text-muted-foreground font-sans">{d}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground font-sans pt-2">
            المصادقة: مرر <code className="text-foreground">x-api-key: &lt;key&gt;</code> في رأس
            HTTP لكل طلب.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">المفاتيح ({consumers.length})</TabsTrigger>
          <TabsTrigger value="logs">سجل الطلبات ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 ml-2" /> مفتاح جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إنشاء مفتاح API</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>اسم المستهلك</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="AzaBot Production"
                  />
                </div>
                <div>
                  <Label>القناة</Label>
                  <Input value={channel} onChange={(e) => setChannel(e.target.value)} />
                </div>
                <div>
                  <Label>الحد الأقصى/دقيقة</Label>
                  <Input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create}>إنشاء</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>القناة</TableHead>
                    <TableHead>المفتاح</TableHead>
                    <TableHead>الطلبات</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.channel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs">
                            {show[c.id]
                              ? c.api_key
                              : c.api_key.slice(0, 8) + "…" + c.api_key.slice(-4)}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setShow((s) => ({ ...s, [c.id]: !s[c.id] }))}
                          >
                            {show[c.id] ? (
                              <EyeOff className="size-3" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => copy(c.api_key)}>
                            <Copy className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="num">{c.total_requests}</TableCell>
                      <TableCell>
                        <Badge
                          variant={c.is_active ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggle(c)}
                        >
                          {c.is_active ? "نشط" : "معطل"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!consumers.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        لا توجد مفاتيح بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوقت</TableHead>
                    <TableHead>المستهلك</TableHead>
                    <TableHead>المسار</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الزمن (ms)</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs num">
                        {new Date(l.created_at).toLocaleString("ar-EG")}
                      </TableCell>
                      <TableCell>
                        {l.consumer_name ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">
                          {l.method} {l.endpoint}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.status_code && l.status_code < 400 ? "default" : "destructive"}
                        >
                          {l.status_code ?? "?"}
                        </Badge>
                      </TableCell>
                      <TableCell className="num">{l.response_time_ms ?? "—"}</TableCell>
                      <TableCell className="text-xs">{l.ip_address ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!logs.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        لا توجد طلبات بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
