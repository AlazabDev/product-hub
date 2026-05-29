# Alazab Nexus — Production Development Plan

## 0. القرار الحاكم

`alazab-nexus` لا يتم اعتباره نظامًا إنتاجيًا إلا بعد تثبيت الأساس التقني والتشغيلي.

القاعدة الأساسية:

```text
No new features before stabilization.
```

أي تطوير جديد يجب أن يمر عبر:

```text
Schema → Types → Build → Approval Gate → Pricing Engine → Agent APIs → Production UI → Deployment
```

---

## 1. الهدف الإنتاجي

تحويل المستودع إلى:

```text
Alazab Product Nexus
```

وظيفته الأساسية:

```text
Product Master Data
Product Intelligence Layer
Pricing Rules
Assets / Images / GLB / CAD references
Agent APIs
Approval Gates
Manufacturing Handoff
Material Requisition Handoff
```

المستودع لا يكون Chatbot كامل، ولا يكون Agent حر، بل يكون طبقة منتجات وتشغيل محكومة تخدم باقي الوكلاء.

---

## 2. المشاكل الحالية المعروفة

### 2.1 Build غير مستقر

تقرير `src/data/build-health.json` يوضح وجود أخطاء TypeScript كثيرة بسبب:

```text
Missing schema tables
Missing fields
Invalid value conversions
Missing azure-config module
```

### 2.2 تضارب بين الكود وقاعدة البيانات

الكود يستخدم جداول ومسارات غير متزامنة بالكامل مع `src/integrations/supabase/types.ts`.

أمثلة الجداول/المناطق التي يجب تثبيتها:

```text
product_requests
quote_requests
manufacturing_orders
material_requisitions
material_requisition_items
pricing_rules
chatbot_interactions
api_consumers
webhook_logs
```

### 2.3 قبول العميل ينشئ تصنيع مباشرة

المسار الحالي في `quote-response.ts` ينشئ أمر تصنيع وأمر صرف خامات عند `accepted`.

هذا غير مقبول إنتاجيًا.

المسار المعتمد يجب أن يكون:

```text
Customer Accepted
↓
accepted_pending_internal_approval
↓
Internal Approval
↓
Manufacturing Order
↓
Material Requisition
```

### 2.4 التسعير يحتوي أسعار ثابتة داخل الكود

`pricing-engine.ts` يحتوي أسعار خامات hardcoded.

الإنتاج الصحيح:

```text
Pricing Engine reads from database tables, not static code.
```

---

## 3. القرار المعماري للوكلاء

كل وكيل داخل منظومة العزب يجب أن يكون له:

```text
1. وظيفة محددة
2. مدخلات محددة
3. مخرجات محددة
4. صلاحيات محددة
5. مصدر بيانات محدد
6. نقطة اعتماد واضحة
```

لا يوجد وكيل ينفذ كل شيء.

`alazab-nexus` يوفر البيانات والواجهات والمحركات، ولا يسمح للذكاء الاصطناعي بتجاوز Workflow الإنتاج.

---

## 4. مراحل التطوير الإنتاجي

## Phase 01 — Stabilization

### الهدف

الوصول إلى:

```text
TypeScript errors = 0
Build = Success
Schema = synced with code
```

### الأعمال

```text
1. توحيد اسم المشروع داخل package.json والتوثيق.
2. إزالة بقايا az-product / AzProud عند اعتماد الاسم النهائي.
3. تثبيت migrations الخاصة بجداول الشات والتصنيع.
4. تحديث Supabase generated types.
5. إصلاح الجداول الناقصة في الكود أو إضافتها رسميًا.
6. إصلاح src/lib/azure-config.ts أو تعطيل الاعتماد عليه مؤقتًا.
7. تشغيل build-health حتى يصل إلى صفر أخطاء.
```

### معيار القبول

```bash
bun run lint
bun run build
bun run build:health
```

كلها تنجح بدون TypeScript errors.

---

## Phase 02 — Schema & Data Contracts

### الهدف

تثبيت قاعدة البيانات كمرجع موحد لكل الوكلاء.

### الجداول الأساسية

```text
products
product_assets
assets
suppliers
supplier_inventory
prices
price_history
quote_requests
approvals
approval_history
manufacturing_orders
material_requisitions
material_requisition_items
agent_sessions
agent_actions
agent_decisions
api_consumers
webhook_logs
```

### قواعد العمل

```text
كل جدول مستخدم في الكود يجب أن يكون موجودًا في migration رسمية.
كل حقل مستخدم في الكود يجب أن يكون موجودًا في Supabase types.
كل JSONB payload له schema موثق.
```

---

## Phase 03 — Approval Gate

### الهدف

منع التصنيع أو صرف الخامات بدون اعتماد داخلي.

### المسار المعتمد

```text
quote_response.accepted
↓
quote_requests.status = accepted_pending_internal_approval
↓
approvals record created
↓
internal approval decision
↓
manufacturing_order created
↓
material_requisition created
```

### ممنوع

```text
Customer acceptance must not directly create manufacturing order.
Customer acceptance must not directly create material requisition.
```

---

## Phase 04 — Pricing Engine Refactor

### الهدف

تحويل التسعير من تقدير static إلى محرك قواعد متصل بالمنتجات والأسعار.

### المحركات المطلوبة

```text
Product Resolver
BOM / Cut List Engine
Pricing Engine
Quotation Engine
Approval Engine
Manufacturing Engine
Material Requisition Engine
```

### مصدر الأسعار

```text
prices
supplier_inventory
pricing_rules
labor_rules
overhead_rules
margin_rules
```

### ممنوع

```text
No production material prices hardcoded in TypeScript files.
```

---

## Phase 05 — Agent API Contracts

### الهدف

تثبيت واجهات API التي يستخدمها الشات والوكلاء.

### المسارات المقترحة

```text
POST /api/agent/v1/intake
POST /api/agent/v1/product-match
POST /api/agent/v1/design-preview
POST /api/agent/v1/cost-estimate
POST /api/agent/v1/quote-request
POST /api/agent/v1/quote-response
POST /api/agent/v1/internal-approval
POST /api/agent/v1/manufacturing-order
GET  /api/agent/v1/order-status
```

### القاعدة

```text
One endpoint = one responsibility.
```

---

## Phase 06 — API Governance

### الهدف

تأمين وتحجيم استخدام APIs قبل الإنتاج.

### المطلوب

```text
1. تطبيق allowed_endpoints لكل api_consumer.
2. تطبيق rate_limit_per_minute.
3. إغلاق CORS wildcard.
4. تسجيل كل request في webhook_logs / agent_actions.
5. منع أي action بدون consumer واضح.
6. فصل public APIs عن internal agent APIs.
```

---

## Phase 07 — Production UI

### الشاشات الأساسية فقط

```text
Dashboard
Products
Pricing
Quote Requests
Approvals
Manufacturing Orders
Settings / API Consumers
```

أي شاشة لا تخدم هذه المراحل تؤجل.

---

## Phase 08 — Blender / Design Worker

لا يبدأ قبل استقرار:

```text
Product Schema
Unit Template Schema
Pricing Engine
Approval Workflow
```

المسار القادم:

```text
Product Template
↓
Design Parameters
↓
Blender CLI Worker
↓
Preview PNG + GLB
↓
Quote Request
```

---

## Phase 09 — CI / Quality Gates

### المطلوب

أي PR لا يدخل `main` إلا بعد:

```text
TypeScript check
ESLint
Build
Supabase type check
Migration validation
API contract tests
```

---

## 5. Definition of Done للإنتاج

لا يعتبر المشروع Production Ready إلا عند تحقق الآتي:

```text
1. TypeScript errors = 0
2. Build succeeds
3. كل جدول مستخدم في الكود موجود في migration رسمية
4. Supabase types محدثة
5. لا توجد أسعار خامات إنتاجية hardcoded
6. قبول العميل لا ينشئ تصنيع مباشرة
7. يوجد Approval Gate قبل التصنيع
8. API keys لها صلاحيات endpoints محددة
9. CORS ليس مفتوحًا على wildcard
10. كل Agent action مسجل
11. كل أمر تصنيع مرتبط بـ quote + approval
12. كل صرف خامات مرتبط بأمر تصنيع معتمد
```

---

## 6. أول مسار تنفيذ

```text
Task 01: Stabilize Schema
Task 02: Regenerate Supabase Types
Task 03: Fix Build Errors
Task 04: Add Approval Gate
Task 05: Refactor Pricing Engine
Task 06: Lock Agent API Contracts
Task 07: Prepare Production Deployment
```

هذا الملف هو الوثيقة الحاكمة قبل بدء أي تعديل في الكود.
