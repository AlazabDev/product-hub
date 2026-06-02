# إغلاق الدورة الحرجة لاعتماد عروض الأسعار → التصنيع

تنفيذ بالترتيب الصارم. كل خطوة لا تبدأ قبل إتمام السابقة.

## 1) إصلاح `quote-response.ts` وتوحيد مرحلة الاعتماد
- المشكلة: السطر `current_stage: "internal_review" as never` يكسر نوع `approval_stage` (الإنومات الحالية: `content_review|manager_review|final_approval`).
- التعديل: استخدم مرحلة موحّدة `final_approval` لطلبات `quote_request` (لا يوجد سير ثلاثي للعروض)، أو القيمة الجديدة `internal_review` بعد إضافتها في الـ migration (الخطوة 2). نختار **إضافة `internal_review` في إنوم `approval_stage`** لفصل سير المنتجات عن سير العروض.
- إزالة `as never` بعد ذلك.

## 2) Migration 1 — Quantity + State Machine
SQL يشمل:
- `ALTER TYPE approval_stage ADD VALUE IF NOT EXISTS 'internal_review';`
- إضافة عمود `quantity numeric NOT NULL DEFAULT 1` إلى `quote_requests`.
- جدول مرجعي `manufacturing_order_status_transitions(from_status, to_status)` يثبت الانتقالات القانونية:
  - `pending → materials_requested|cancelled`
  - `materials_requested → in_production|cancelled`
  - `in_production → quality_check|cancelled`
  - `quality_check → ready|in_production`
  - `ready → delivered|cancelled`
  - `delivered →` (نهائي)
- Trigger `enforce_mo_status_transition` على `manufacturing_orders` يرفض أي UPDATE خارج هذه المصفوفة.
- Trigger مشابه `enforce_quote_status_transition` يثبت:
  - `quoted → accepted_pending_internal_approval|rejected|expired`
  - `accepted_pending_internal_approval → approved_in_production|rejected`
  - `approved_in_production →` (نهائي)
- GRANTs لجدول الانتقالات (`SELECT` لـ authenticated, `ALL` لـ service_role) + RLS.

## 3) Migration 2 — RPC ذرية `approve_quote_for_manufacturing`
دالة `SECURITY DEFINER` تأخذ `(_approval_id uuid, _decided_by uuid, _notes text)` وتنفذ داخل معاملة واحدة:
1. قفل صف `approvals` (`FOR UPDATE`) والتحقق من: `status='pending'` و `entity_type='quote_request'`.
2. قفل وقراءة `quote_requests` المرتبط؛ التحقق من حالة `accepted_pending_internal_approval`.
3. توليد `order_number` عبر `generate_order_number()`.
4. INSERT في `manufacturing_orders` بـ `quantity` من العرض و `unit_price/total_price/final_price` المحسوبة.
5. توليد `requisition_number` و INSERT في `material_requisitions`.
6. INSERT الدفعي لبنود `material_requisition_items` من `pricing_breakdown.materials_breakdown` (مضروبة في `quantity`).
7. UPDATE `approvals.status='approved'`, `decided_at`, `decided_by`.
8. UPDATE `quote_requests.status='approved_in_production'`.
9. تُرجع `jsonb` يحوي معرفات MO و MR وعدد العناصر.
- على أي فشل: `RAISE EXCEPTION` فيعود الـ rollback تلقائياً.
- GRANT `EXECUTE` للـ `service_role` فقط.

## 4) تحويل `internal-approval.ts` إلى غلاف خفيف
- الرفض: يبقى منطقياً (تحديث `approvals` + `quote_requests`).
- الاعتماد: استبدال المنطق الطويل باستدعاء واحد `supabaseAdmin.rpc('approve_quote_for_manufacturing', {...})`.
- استخراج `mo_id/mr_id/items_count` من نتيجة الـ RPC وإرجاعها كما هي للعميل.
- إبقاء `requireApiKey` + `logCall`.

## 5) `approvals.functions.ts` — دعم `quote_request`
- توسيع enum `entityType` في `submitForApproval` ليشمل `"quote_request"`.
- توسيع منطق `decideApproval`:
  - عند `entity_type='quote_request'` و قرار `approved`: استدعاء الـ RPC نفسها بدلاً من تحديث جدول products.
  - عند الرفض: تحديث `quote_requests.status='rejected'`.
- الإبقاء على سير ثلاثي للمنتجات كما هو.

## 6) `approvals/index.tsx` — ربط مسار التصنيع
- عند نجاح `decide.mutate` لطلب من نوع `quote_request` بقرار `approved`: عرض toast مع زر "فتح أمر التصنيع" يوجّه إلى `/manufacturing-orders`.
- إظهار شارة `quote_request` مميّزة (لون مختلف) وترجمتها العربية "طلب عرض سعر".
- تكييف خطوات التقدم (stage progress) ليُظهر مرحلة واحدة `internal_review` لطلبات العروض بدل الثلاث.

## 7) `order-status.ts` — منع الانتقالات غير القانونية
- في الـ PATCH handler: قبل أي تحديث للحالة، استعلام `manufacturing_order_status_transitions` (أو الاعتماد على الـ trigger) للتأكد من شرعية الانتقال.
- إعادة خطأ `409 invalid_transition` بدلاً من فشل صامت.
- whitelist لحقول التحديث الأخرى (تواريخ، ملاحظات، دفع) منفصلة عن تحديث الحالة.

## 8) `manufacturing-orders.tsx` — منع التعديل المباشر
- استبدال `supabase.from("manufacturing_orders").update(...)` (المباشر من المتصفح) بـ **server function جديد** `updateManufacturingOrderStatus` في `src/lib/manufacturing.functions.ts`:
  - يستعمل `requireSupabaseAuth` + يتحقق `has_role(editor|admin)`.
  - يستدعي نفس منطق الـ trigger (يفشل تلقائياً عند الانتقال غير القانوني).
- استبدال `useMutation` ليستدعي الـ server fn عبر `useServerFn`.
- إضافة قراءة الانتقالات المسموحة لإخفاء الأزرار غير الصالحة بصرياً.

## 9) `api-auth.ts` — إغلاق CORS + Rate Limit لكل مستهلك
- إزالة `CORS` الافتراضي المفتوح (`*`)؛ كل المسارات تستخدم `corsHeaders(request)` (موجودة بالفعل).
- إجبار `ALLOWED_ORIGINS` ليكون مطلوباً في الإنتاج (`NODE_ENV==='production'` بدون قائمة → 403).
- استبدال `RATE_LIMIT_PER_MINUTE` العام بـ `consumer.rate_limit_per_minute` (العمود موجود في جدول `api_consumers`).
- تحديث جميع handlers (`quote-request|quote-response|internal-approval|order-status|public/v1/*`) لاستخدام `corsHeaders(request)` بدل `CORS` الثابت.

## 10) `package.json` — بوابة TypeScript و Lint قبل Deploy
- إضافة scripts:
  - `"typecheck": "tsc --noEmit"`
  - `"verify": "bun run typecheck && bun run lint && bun run build:health"`
- توثيق في `.github/workflows/main.yml` (إن وجد) لإضافة `bun run verify` قبل أي خطوة deploy.

---

## ملاحظات تقنية
- المهاجرات (steps 2 و 3) منفصلتان لأن `ALTER TYPE ... ADD VALUE` لا يمكن استخدامه في نفس المعاملة التي تستخدم القيمة الجديدة.
- جميع التغييرات على الـ DB تشمل GRANT + RLS صريحاً.
- لا أغيّر `types.ts` يدوياً (يُنشأ تلقائياً بعد كل migration).
- بعد كل migration سأتوقف لانتظار موافقتك قبل الانتقال للخطوة التالية.

## النتيجة النهائية
- مرحلة موافقة موحّدة، state machine مفروض على مستوى DB، RPC ذرية تمنع حالات "أمر بدون مستلزمات"، نهاية للتعديل المباشر من المتصفح، CORS مغلق، rate limit لكل عميل، وبوابة CI تمنع نشر كود مكسور.
