import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { askSupportAgent } from "@/lib/support-agent.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Bot, User, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "وكيل الدعم — Alazab PAOP" }] }),
  component: SupportPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
  source?: { azCode: string; name?: string } | null;
}

function SupportPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "مرحباً، أنا وكيل دعم العزب. اسألني عن أي منتج باستخدام رمز AZ Code أو اسم المنتج.",
    },
  ]);
  const fn = useServerFn(askSupportAgent);

  const send = useMutation({
    mutationFn: async (text: string) => {
      const next: Msg[] = [...messages, { role: "user", content: text }];
      const res = await fn({
        data: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      return { reply: res.reply, source: res.source };
    },
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, source: res.source },
      ]);
    },
    onError: (e: any) => {
      toast.error(e.message || "خطأ في الاتصال بالوكيل");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || send.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: input.trim() }]);
    send.mutate(input.trim());
    setInput("");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto h-[calc(100vh-3.5rem)] flex flex-col" dir="rtl">
      <Card className="flex-1 surface-elevated border-1 flex flex-col overflow-hidden">
        <div className="h-14 flex items-center gap-3 px-4 border-b bg-card shrink-1">
          <div className="size-9 rounded-full bg-accent text-accent-foreground grid place-items-center">
            <Bot className="size-5" />
          </div>
          <div>
            <div className="font-bold">وكيل دعم المنتجات</div>
            <div className="text-[10px] text-muted-foreground">
              مدعوم بـ Azure AI Search + Azure OpenAI
            </div>
          </div>
          <div className="mr-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3" /> gpt-4o-mini
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <Avatar className="size-8 shrink-1">
                <AvatarFallback
                  className={
                    m.role === "user"
                      ? "bg-muted text-muted-foreground"
                      : "bg-accent text-accent-foreground"
                  }
                >
                  {m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-loose whitespace-pre-wrap ${
                  m.role === "user" ? "bg-accent text-accent-foreground mr-2" : "bg-muted"
                }`}
              >
                {m.content}
                {m.source && (
                  <div
                    className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground num"
                    dir="ltr"
                  >
                    Source: {m.source.name} — {m.source.azCode}
                  </div>
                )}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex gap-3">
              <Avatar className="size-8 shrink-1">
                <AvatarFallback className="bg-accent text-accent-foreground">
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-xl px-4 py-2.5 text-sm animate-pulse">
                جاري التفكير…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t p-3 flex gap-2 bg-card shrink-1">
          <Input
            placeholder="اكتب سؤالك… مثال: AZ-ABR-01-25-1939 لا يعمل"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={send.isPending}
            className="flex-1"
          />
          <Button type="submit" disabled={send.isPending || !input.trim()} className="gap-2">
            <Send className="size-4" /> إرسال
          </Button>
        </form>
      </Card>
    </div>
  );
}
