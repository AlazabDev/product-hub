# AzProud API Documentation

Complete API reference for AzProud Product Management Platform.

## Base URL

```
Development: http://localhost:8084/api
Production: https://azproud.vercel.app/api
```

## Authentication

All endpoints require authentication via Supabase Auth token.

**Headers:**
```
Authorization: Bearer <supabase_auth_token>
Content-Type: application/json
```

## Products API

### List Products

Get all products with optional filtering, sorting, and pagination.

**Endpoint:** `GET /api/products`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search by name (Arabic/English), code, or description |
| `status` | string | - | Filter by status (draft, needs_review, approved, rejected) |
| `item_type` | string | - | Filter by item type (product, service, bundle) |
| `category` | string | - | Filter by GPC family/category |
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 50 | Items per page (max 200) |
| `sort` | string | -created_at | Sort field with direction (-field = desc, field = asc) |

**Example Request:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8084/api/products?status=approved&limit=20&page=1"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name_ar": "منتج تجريبي",
      "name_en": "Test Product",
      "az_code": "AZ-001",
      "item_type": "product",
      "status": "approved",
      "description_ar": "وصف عربي",
      "description_en": "English description",
      "gpc_family": "10000000",
      "sector_ar": "القطاع",
      "created_at": "2026-05-22T10:30:00Z",
      "updated_at": "2026-05-22T10:30:00Z",
      "created_by": "user_uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

**Error Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### Get Single Product

**Endpoint:** `GET /api/products/:id`

**Success Response (200):**
```json
{
  "id": "uuid",
  "name_ar": "منتج",
  "name_en": "Product",
  "az_code": "AZ-001",
  "status": "approved",
  "assets": [
    {
      "id": "uuid",
      "url": "https://storage.supabase.co/...",
      "type": "image",
      "size": 1024
    }
  ],
  "prices": [
    {
      "supplier_id": "uuid",
      "price": 100.00,
      "currency": "SAR",
      "created_at": "2026-05-22T10:30:00Z"
    }
  ]
}
```

### Create Product

**Endpoint:** `POST /api/products`

**Request Body:**
```json
{
  "name_ar": "منتج جديد",
  "name_en": "New Product",
  "az_code": "AZ-002",
  "item_type": "product",
  "description_ar": "وصف",
  "description_en": "Description",
  "gpc_family": "10000000",
  "sector_ar": "القطاع"
}
```

**Validation Rules:**
- `name_ar`: Required, min 2 chars, max 255 chars
- `name_en`: Required, min 2 chars, max 255 chars
- `az_code`: Required, unique, alphanumeric + hyphens
- `item_type`: Required, one of: product, service, work_item, material, tool, spare_part, finish_item, custom_unit, supplier_item, package, bundle
- `gpc_family`: Optional, must be valid GPC code
- `description_*`: Optional, max 2000 chars

**Success Response (201):**
```json
{
  "id": "uuid",
  "name_ar": "منتج جديد",
  "name_en": "New Product",
  "status": "draft",
  "created_at": "2026-05-22T10:35:00Z"
}
```

**Error Response (400):**
```json
{
  "error": "Validation Error",
  "fields": {
    "name_ar": "Name is required",
    "az_code": "Code already exists"
  }
}
```

### Update Product

**Endpoint:** `PUT /api/products/:id`

**Request Body:** Same as Create (all fields optional except id)

**Success Response (200):** Updated product object

**Error Response (404):**
```json
{
  "error": "Not Found",
  "message": "Product not found"
}
```

### Delete Product

**Endpoint:** `DELETE /api/products/:id`

**Success Response (204):** No content

## Suppliers API

### List Suppliers

**Endpoint:** `GET /api/suppliers`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search by name, code, or contact |
| `tier` | string | - | Filter by tier (first_tier, second_tier, backup, local) |
| `status` | string | active | Filter by status (active, inactive) |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name_ar": "الموردون العرب",
      "name_en": "Arab Suppliers",
      "supplier_code": "SUPP-001",
      "tier": "first_tier",
      "category": "Electronics",
      "email": "info@example.com",
      "phone": "+966-XX-XXXX",
      "status": "active",
      "created_at": "2026-05-22T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 25, "pages": 1 }
}
```

### Create Supplier

**Endpoint:** `POST /api/suppliers`

**Request Body:**
```json
{
  "name_ar": "مورد جديد",
  "name_en": "New Supplier",
  "supplier_code": "SUPP-002",
  "category": "Electronics",
  "tier": "second_tier",
  "email": "contact@example.com",
  "phone": "+966-XX-XXXX"
}
```

**Validation Rules:**
- `name_ar`: Required, min 2 chars
- `name_en`: Required, min 2 chars
- `supplier_code`: Required, unique
- `tier`: Required, one of: first_tier, second_tier, backup, local
- `email`: Optional, valid email format
- `phone`: Optional, valid phone format

**Success Response (201):** Created supplier object

### Update Supplier

**Endpoint:** `PUT /api/suppliers/:id`

**Request Body:** Same as Create (all fields optional)

**Success Response (200):** Updated supplier object

## Product Requests API

### List Requests

**Endpoint:** `GET /api/requests`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status |
| `priority` | string | - | Filter by priority (low, medium, high) |
| `type` | string | - | Filter by type |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "product_name_ar": "منتج مطلوب",
      "product_name_en": "Requested Product",
      "status": "open",
      "priority": "high",
      "requested_by": "user_uuid",
      "created_at": "2026-05-22T10:30:00Z",
      "updated_at": "2026-05-22T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Create Request

**Endpoint:** `POST /api/requests`

**Request Body:**
```json
{
  "product_name_ar": "منتج مطلوب",
  "product_name_en": "Requested Product",
  "description_ar": "وصف المتطلبات",
  "priority": "high",
  "quantity": 100
}
```

### Update Request Status

**Endpoint:** `PATCH /api/requests/:id/status`

**Request Body:**
```json
{
  "status": "in_review",
  "notes": "تحت المراجعة"
}
```

**Valid Status Values:**
- open
- in_review
- approved
- rejected
- converted

## Pricing API

### List Pricing Rules

**Endpoint:** `GET /api/pricing/rules`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | string | Filter by product |
| `supplier_id` | string | Filter by supplier |

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "supplier_id": "uuid",
      "rule_type": "volume_based",
      "min_quantity": 100,
      "max_quantity": 500,
      "price": 50.00,
      "discount_percent": 5,
      "created_at": "2026-05-22T10:30:00Z"
    }
  ]
}
```

### Create Pricing Rule

**Endpoint:** `POST /api/pricing/rules`

**Request Body:**
```json
{
  "product_id": "uuid",
  "supplier_id": "uuid",
  "rule_type": "volume_based",
  "min_quantity": 100,
  "max_quantity": 500,
  "price": 50.00,
  "discount_percent": 5
}
```

## Error Handling

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Missing/invalid auth token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate or state conflict |
| 429 | Too Many Requests - Rate limited |
| 500 | Server Error - Unexpected error |

## Rate Limiting

- **Limit:** 100 requests per minute per API key
- **Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Example Response Header:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1653217920
```

## Pagination

Paginated endpoints return:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

## Timestamps

All timestamps are in ISO 8601 format (UTC):
```
2026-05-22T10:30:00Z
```

## Webhook Events

(Available in v2.0)

## SDK/Client Libraries

- **JavaScript/TypeScript:** Use with Supabase client
- **Python:** (Coming soon)
- **Go:** (Coming soon)

## Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Get products
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('status', 'approved')
  .limit(20)

// Create product
const { data: newProduct } = await supabase
  .from('products')
  .insert({
    name_ar: 'منتج جديد',
    name_en: 'New Product',
    az_code: 'AZ-003'
  })
  .select()
  .single()
```

---

**Last Updated:** May 2026  
**API Version:** 1.0.0
