# Production Stabilization Plan — Alazab Product Hub

الهدف: `bun run build` ✅، TypeScript errors = 0، Schema/Code متطابقان، workflow التصنيع محكوم بـ Approval Gate.

## الوضع الحالي (مؤكد من build-health.json)

- 120 خطأ، 10 ملفات متضررة.
- الجداول المفقودة في `types.ts` المستخدمة في الكود:
  `product_requests`, `quote_requests`, `manufacturing_orders`, `material_requisitions`, `material_requisition_items`, `chatbot_interactions`, `agent_sessions`, `agent_actions`, `agent_decisions`, `pricing_rules`, إضافة لحقول `azure_*` متعددة.
- `src/lib/azure-integrations.ts` → 23 خطأ، أبرزها import مكسور لـ `./azure-config` + استخدام جدول غير موجود (`azure_integrations`) بأعمدة JSON معاملة كسلاسل بسيطة.
- `pricing-engine.ts` يحوي أسعار خامات hardcoded — ممنوع إنتاجيًا.
- `quote-response.ts` ينشئ Manufacturing + Material Requisition مباشرة عند قبول العميل — انتهاك للـ Approval Gate.

---

## الدفعة 1 — Schema Foundation (أولوية حرجة)

migration واحدة شاملة تنشئ كل الجداول الناقصة المستخدمة فعليًا في الكود، مع GRANTs + RLS:

| الجدول | الغرض |
|---|---|
| `product_requests` | طلبات منتجات من النماذج الداخلية |
| `quote_requests` | طلبات تسعير الـ chatbot |
| `chatbot_interactions` | سجل تفاعلات الـ agent |
| `agent_sessions`, `agent_actions`, `agent_decisions` | حوكمة الـ Agent |
| `pricing_rules` | قواعد التسعير (overhead/margin/labor) |
| `manufacturing_orders` | أوامر تصنيع |
| `material_requisitions` + `material_requisition_items` | صرف خامات |

- كل جدول: GRANT للـ `authenticated` + `service_role`، RLS مفعّل، policies تعتمد `has_role`.
- بعد التطبيق: `types.ts` يُحدّث تلقائيًا.

**نتيجة متوقعة:** ~83 خطأ يختفي (38 جدول مفقود + 45 حقل مفقود معظمها داخل تلك الجداول).

---

## الدفعة 2 — Azure Config + Integrations Cleanup

- إنشاء `src/lib/azure-config.ts` يقرأ من `process.env` فقط (10 متغيرات بيئة محددة في الطلب).
- تثبيت `AZURE_SEARCH_INDEX=alazab-products` كقيمة افتراضية.
- إصلاح `azure-integrations.ts`: jsonb columns تُكتب كـ JSON (إزالة أخطاء `string[] → string|number|boolean`).
- إصلاح `request-form.tsx` ليستخدم `product_requests` الجديد.
- إصلاح كل ملفات `_authenticated/*` (integrations, manufacturing-orders, quote-requests, requests).

**نتيجة متوقعة:** الـ 27 خطأ تحويل قيمة + 6 TS errors + 3 type mismatch تختفي.

---

## الدفعة 3 — Approval Gate + Internal Approval Endpoint

تعديل سلوكي حرج للـ workflow:

- `quote-response.ts` عند `accepted`:
  - status → `accepted_pending_internal_approval`
  - ينشئ سجل `approvals` فقط — **لا** manufacturing_order ولا material_requisition.
- إنشاء `POST /api/agent/v1/internal-approval`:
  - يستقبل `approval_id` + `decision`.
  - `approved` → ينشئ `manufacturing_orders` + `material_requisitions` + `material_requisition_items`.
  - `rejected` → يحدّث الحالات فقط.
- توحيد response shape لكل APIs: `{ success, data?, error?, code? }`.

---

## الدفعة 4 — Pricing Engine + API Governance + Build Health

- `pricing-engine.ts`: استبدال hardcoded بـ `fetchMaterialPrices/fetchLaborRules/fetchPricingRules` من DB. fallback فقط في dev مع `console.warn`. في production → خطأ صريح `pricing_rules_missing` / `material_price_missing`.
- `api-auth.ts`:
  - CORS من `ALLOWED_ORIGINS` env (wildcard فقط في dev).
  - تطبيق `allowed_endpoints` فعليًا (403 إن لم يُسمح).
  - rate limiting بسيط عبر `webhook_logs` count في آخر دقيقة.
- تشغيل `bun run lint && bun run build && bun run build:health` وإصلاح ما تبقى.
- تحديث `REPOSITORY_INDEX.md` + `README.md` + `docs/PRE_PRODUCTION_CHECKLIST.md` بالواقع المنجز.
- توحيد الاسم إلى `product-hub` في `package.json` وما يلزم.

---

## ما لن أفعله (التزامًا بالقيود)

- لن أضيف features جديدة.
- لن أكسر APIs الموجودة أثناء التعديل.
- لن أستخدم `as any` لإخفاء أخطاء Schema.
- لن أعدّل `client.ts` / `client.server.ts` / `types.ts` يدويًا.
- لن أحذف شاشات بدون توثيق.

---

## التسليم بعد كل دفعة

تقرير مختصر: ملفات معدّلة، migrations مُطبّقة، أخطاء build-health قبل/بعد، الأخطاء المتبقية.

## السؤال قبل البدء

هل أبدأ بالدفعة 1 (migration الـ Schema الموحّدة)؟ أم تريد تعديل الترتيب أو حذف/إضافة بنود؟
