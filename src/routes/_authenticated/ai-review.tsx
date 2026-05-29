import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, Bot, User, Loader2, Search,
  Package, Truck, DollarSign, BarChart3, RefreshCw,
  MessageSquare, Lightbulb, Wrench,
} from "lucide-react";
import { sendChatMessage, type ChatMessage } from "@/lib/ai-assistant";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai-review")({
  component: AIReview,
});

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: "احصائيات النظام", prompt: "اعطني احصائيات النظام", icon: BarChart3 },
  { label: "البحث في المنتجات", prompt: "ابحث عن", icon: Search },
  { label: "معلومات مورد", prompt: "من هو المورد", icon: Truck },
  { label: "تفاصيل منتج", prompt: "ما هي تفاصيل المنتج", icon: Package },
  { label: "معلومات الاسعار", prompt: "كم سعر", icon: DollarSign },
];

// Example questions
const EXAMPLE_QUESTIONS = [
  "ما هي انواع البنود المتاحة في النظام؟",
  "ابحث عن منتجات الدهانات",
  "اعطني تفاصيل البند AZ-PRD-001",
  "من هم موردي الدرجة الاولى؟",
  "ما هي دورة حياة البند؟",
  "كيف اضيف منتج جديد؟",
];

function AIReview() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const newUserMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newUserMessage]);

      const response = await sendChatMessage([...messages, newUserMessage], (toolName) => {
        setActiveToolCall(toolName);
      });

      setActiveToolCall(null);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        metadata: response.toolCalls
          ? {
              action: response.toolCalls.map((tc) => tc.name).join(", "),
            }
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      return response;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    chatMutation.mutate(input.trim());
    setInput("");
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleExampleClick = (question: string) => {
    chatMutation.mutate(question);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const toolCallLabels: Record<string, string> = {
    search_products: "البحث في المنتجات",
    get_product_details: "جلب تفاصيل المنتج",
    get_price_info: "جلب معلومات التسعير",
    search_suppliers: "البحث في الموردين",
    get_statistics: "جلب الاحصائيات",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">مساعد PAOP الذكي</h1>
            <p className="text-sm text-muted-foreground">
              اسالني عن المنتجات، الاسعار، الموردين، او اي شيء اخر
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearChat}>
            <RefreshCw className="size-4 ml-2" />
            محادثة جديدة
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col surface-elevated border-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-8">
              {/* Welcome Message */}
              <div className="size-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Bot className="size-8 text-accent" />
              </div>
              <h2 className="text-lg font-bold mb-2">مرحبا بك في مساعد PAOP</h2>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                انا هنا لمساعدتك في ادارة كتالوج المنتجات. يمكنني البحث في المنتجات،
                عرض الاسعار، معلومات الموردين، والمزيد.
              </p>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.prompt)}
                    className="gap-2"
                  >
                    <action.icon className="size-4" />
                    {action.label}
                  </Button>
                ))}
              </div>

              {/* Example Questions */}
              <div className="w-full max-w-2xl">
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Lightbulb className="size-4" />
                  <span>امثلة على الاسئلة:</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {EXAMPLE_QUESTIONS.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleExampleClick(question)}
                      className="text-start p-3 rounded-lg border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-colors text-sm"
                    >
                      <MessageSquare className="size-4 inline ml-2 text-muted-foreground" />
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center shrink-0",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent/10"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="size-4" />
                    ) : (
                      <Bot className="size-4 text-accent" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      "flex-1 max-w-[80%]",
                      message.role === "user" ? "text-end" : ""
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block p-3 rounded-xl",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50"
                      )}
                    >
                      {/* Render markdown-like content */}
                      <div
                        className={cn(
                          "prose prose-sm max-w-none",
                          message.role === "user" ? "prose-invert" : ""
                        )}
                        dangerouslySetInnerHTML={{
                          __html: formatMessage(message.content),
                        }}
                      />
                    </div>

                    {/* Tool call badge */}
                    {message.metadata?.action && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Wrench className="size-3" />
                          {message.metadata.action
                            .split(", ")
                            .map((t) => toolCallLabels[t] || t)
                            .join(", ")}
                        </Badge>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div
                      className={cn(
                        "text-xs text-muted-foreground mt-1",
                        message.role === "user" ? "text-end" : ""
                      )}
                    >
                      {message.timestamp.toLocaleTimeString("ar", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Bot className="size-4 text-accent" />
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm">
                        {activeToolCall
                          ? toolCallLabels[activeToolCall] || activeToolCall
                          : "جاري التفكير..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              disabled={chatMutation.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="gap-2"
            >
              {chatMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              ارسال
            </Button>
          </form>

          {/* Error display */}
          {chatMutation.isError && (
            <p className="text-sm text-destructive mt-2">
              حدث خطا: {(chatMutation.error as Error).message}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// Helper function to format message content
function formatMessage(content: string): string {
  return content
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Headers
    .replace(/^## (.*?)$/gm, '<h3 class="text-base font-bold mt-2 mb-1">$1</h3>')
    .replace(/^### (.*?)$/gm, '<h4 class="text-sm font-bold mt-2 mb-1">$1</h4>')
    // Lists
    .replace(/^- (.*?)$/gm, '<li class="mr-4">$1</li>')
    // Line breaks
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>")
    // Tables (basic)
    .replace(
      /\| (.*?) \| (.*?) \|/g,
      '<div class="flex gap-4"><span class="font-medium">$1</span><span>$2</span></div>'
    );
}
