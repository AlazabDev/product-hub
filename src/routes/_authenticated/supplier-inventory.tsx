import { createFileRoute } from "@tanstack/react-router";
import { Warehouse, Search, Filter, ArrowUpDown, ArrowDownUp, Package, AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/supplier-inventory")({
  component: SupplierInventoryPage,
});

interface SupplierInventoryItem {
  id: string;
  supplier: string;
  productName: string;
  sku: string;
  availableQty: number;
  reservedQty: number;
  unitPrice: number;
  currency: string;
  leadTimeDays: number;
  status: "available" | "low_stock" | "out_of_stock" | "discontinued";
  lastUpdated: string;
}

const demoItems: SupplierInventoryItem[] = [
  { id: "SI-001", supplier: "المورد الصناعي السعودي", productName: "خزانة معدنية 4 أدراج", sku: "MET-CAB-4D-001", availableQty: 120, reservedQty: 30, unitPrice: 850, currency: "SAR", leadTimeDays: 7, status: "available", lastUpdated: "2026-05-29" },
  { id: "SI-002", supplier: "المورد الصناعي السعودي", productName: "رف تخزين ثقيل 3 أمتار", sku: "RCK-HVY-3M-002", availableQty: 45, reservedQty: 15, unitPrice: 1200, currency: "SAR", leadTimeDays: 10, status: "low_stock", lastUpdated: "2026-05-28" },
  { id: "SI-003", supplier: "تقنية الأثاث المكتبي", productName: "مكتب إداري خشبي", sku: "DSK-EXE-WD-003", availableQty: 0, reservedQty: 0, unitPrice: 2100, currency: "SAR", leadTimeDays: 21, status: "out_of_stock", lastUpdated: "2026-05-27" },
  { id: "SI-004", supplier: "الحديد والصلب المتحدة", productName: "قاعدة معدنية قابلة للتعديل", sku: "BAS-ADJ-MT-004", availableQty: 300, reservedQty: 50, unitPrice: 180, currency: "SAR", leadTimeDays: 5, status: "available", lastUpdated: "2026-05-29" },
  { id: "SI-005", supplier: "الحديد والصلب المتحدة", productName: "هيكل فولاذي 2x2م", sku: "STL-FRM-2X2-005", availableQty: 8, reservedQty: 2, unitPrice: 950, currency: "SAR", leadTimeDays: 14, status: "low_stock", lastUpdated: "2026-05-26" },
  { id: "SI-006", supplier: "تقنية الأثاث المكتبي", productName: "كرسي مكتبي مريح", sku: "CHR-ERG-006", availableQty: 0, reservedQty: 0, unitPrice: 750, currency: "SAR", leadTimeDays: 30, status: "discontinued", lastUpdated: "2026-05-20" },
];

const statusColors: Record<string, string> = {
  available: "bg-success/15 text-success",
  low_stock: "bg-warning/15 text-warning",
  out_of_stock: "bg-destructive/10 text-destructive",
  discontinued: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  available: "متاح",
  low_stock: "منخفض",
  out_of_stock: "نفذت الكمية",
  discontinued: "متوقف",
};

function SupplierInventoryPage() {
  const [query, setQuery] = useState("");
  const items = demoItems.filter((i) =>
    i.productName.toLowerCase().includes(query.toLowerCase()) ||
    i.sku.toLowerCase().includes(query.toLowerCase()) ||
    i.supplier.toLowerCase().includes(query.toLowerCase())
  );

  const lowStockCount = items.filter((i) => i.status === "low_stock").length;
  const outOfStockCount = items.filter((i) => i.status === "out_of_stock").length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مخزون الموردين</h1>
          <p className="text-muted-foreground text-sm mt-1">
            متابعة توافر المنتجات والكميات لدى الموردين ومعدلات التوريد.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">إجمالي الأصناف</p>
                <p className="text-2xl font-bold num">{items.length}</p>
              </div>
              <Package className="size-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">متاحة</p>
                <p className="text-2xl font-bold text-success num">{items.filter((i) => i.status === "available").length}</p>
              </div>
              <ArrowDownUp className="size-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">منخفضة</p>
                <p className="text-2xl font-bold text-warning num">{lowStockCount}</p>
              </div>
              <AlertTriangle className="size-5 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs">نفذت الكمية</p>
                <p className="text-2xl font-bold text-destructive num">{outOfStockCount}</p>
              </div>
              <Package className="size-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المخزون..."
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
            <Warehouse className="size-4 text-primary" />
            جرد الموردين
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[90px]">الكود</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead className="text-center">الكمية المتاحة</TableHead>
                <TableHead className="text-center">المحجوزة</TableHead>
                <TableHead className="text-center">السعر</TableHead>
                <TableHead className="text-center">مدة التوريد</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.id}</TableCell>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                  <TableCell className="text-sm">{item.supplier}</TableCell>
                  <TableCell className="text-center font-semibold num">{item.availableQty}</TableCell>
                  <TableCell className="text-center text-muted-foreground num">{item.reservedQty}</TableCell>
                  <TableCell className="text-center num">
                    {item.unitPrice.toLocaleString()} {item.currency}
                  </TableCell>
                  <TableCell className="text-center">{item.leadTimeDays} يوم</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status]}`}>
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{item.lastUpdated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
