import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Search, Filter, ArrowUpDown, Eye, Edit, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPage,
});

interface ContentItem {
  id: string;
  title: string;
  type: "product_description" | "category_page" | "blog_post" | "landing_page" | "faq";
  language: string;
  status: "draft" | "published" | "archived";
  lastModified: string;
  author: string;
}

const demoItems: ContentItem[] = [
  { id: "CNT-001", title: "وصف منتج: خزانة معدنية صناعية", type: "product_description", language: "ar", status: "published", lastModified: "2026-05-28", author: "أحمد العزب" },
  { id: "CNT-002", title: "صفحة تصنيف: أثاث مكتبي", type: "category_page", language: "ar", status: "published", lastModified: "2026-05-27", author: "أحمد العزب" },
  { id: "CNT-003", title: "Product: Industrial Storage Rack", type: "product_description", language: "en", status: "draft", lastModified: "2026-05-26", author: "Ali Alazab" },
  { id: "CNT-004", title: "FAQ: Shipping & Returns", type: "faq", language: "en", status: "published", lastModified: "2026-05-25", author: "Support Team" },
  { id: "CNT-005", title: "صفحة هبوط: عروض الصيف 2026", type: "landing_page", language: "ar", status: "draft", lastModified: "2026-05-24", author: "أحمد العزب" },
];

const typeLabels: Record<string, string> = {
  product_description: "وصف منتج",
  category_page: "صفحة تصنيف",
  blog_post: "مدونة",
  landing_page: "صفحة هبوط",
  faq: "أسئلة شائعة",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/15 text-success",
  archived: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};

function ContentPage() {
  const [query, setQuery] = useState("");
  const items = demoItems.filter((i) =>
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    i.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <PageHeader
        icon={<FileText className="size-5" />}
        title="إدارة المحتوى"
        description="إدارة المحتوى النصي للمنتجات والتصنيفات والصفحات"
        actions={
          <Button size="sm" className="gap-1">
            <Plus className="size-4" />
            محتوى جديد
          </Button>
        }
      />
      <div className="p-4 md:p-6 space-y-6" dir="rtl">


      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المحتوى..."
            className="pr-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Filter className="size-4" /> تصفية
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowUpDown className="size-4" /> ترتيب
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            قائمة المحتوى
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">الكود</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>اللغة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تعديل</TableHead>
                <TableHead>المؤلف</TableHead>
                <TableHead className="w-[120px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {typeLabels[item.type] ?? item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {item.language === "ar" ? "العربية" : "English"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status]}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.lastModified}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.author}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7">
                        <Eye className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7">
                        <Edit className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </>
  );
}

