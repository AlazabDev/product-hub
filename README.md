# AzProud - Product Management Platform

A comprehensive, AI-powered product and service management system built for enterprises managing complex catalogs with Arabic localization and real-time collaboration.

## 📑 Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Core Functionality](#core-functionality)
  - [Advanced Features](#advanced-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
  - [Dashboard](#dashboard)
  - [Product Management](#product-management)
  - [Supplier Management](#supplier-management)
  - [Request Management](#request-management)
- [Architecture Decisions](#architecture-decisions)
  - [State Management](#state-management)
  - [Form Handling](#form-handling)
  - [Styling](#styling)
- [Security](#security)
  - [Authentication](#authentication)
  - [Database Security](#database-security)
  - [API Security](#api-security)
- [Performance Targets](#performance-targets)
- [Deployment](#deployment)
  - [Vercel (Recommended)](#vercel-recommended)
  - [Docker](#docker)
  - [Manual](#manual)
- [Integration Points](#integration-points)
  - [Daftra (Accounting)](#daftra-accounting)
  - [Bot Gateway](#bot-gateway)
  - [ERPNext](#erpnext)
- [API Reference](#api-reference)
  - [Products](#products)
  - [Suppliers](#suppliers)
  - [Requests](#requests)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Code Style](#code-style)
- [Testing](#testing)
- [Monitoring & Maintenance](#monitoring--maintenance)
  - [Database Health](#database-health)
  - [Error Tracking](#error-tracking)
  - [Performance](#performance)
- [Support & Troubleshooting](#support--troubleshooting)
- [License](#license)
- [Changelog](#changelog)

## Overview

AzProud is a professional product management platform designed for organizations that need to:
- Manage large product catalogs efficiently
- Integrate with multiple business systems (Daftra, ERPNext, Bot Gateway)
- Leverage AI for product classification and analysis
- Track pricing strategies across suppliers
- Handle multi-language workflows (Arabic/English)

## Features

### Core Functionality
- **Product Management** - Complete CRUD with bulk operations, versioning, and AI-assisted creation
- **Asset Management** - Professional image gallery with drag-drop, optimization, and linking
- **Supplier Management** - Track suppliers by tier, performance metrics, and inventory links
- **Product Requests** - Workflow-based request management with status tracking and SLA monitoring
- **Pricing Management** - Visual rule editor for tiered and volume-based pricing strategies
- **Dashboard** - Real-time KPIs with drill-down analytics and status indicators

### Advanced Features
- Real-time data synchronization with Supabase
- AI-powered product classification (Azure OpenAI)
- Multi-language support (Arabic/English, RTL-friendly)
- Dark/Light theme support
- Comprehensive audit logging
- Row-level security (RLS) for data protection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19.2, TypeScript, TanStack Router, Tailwind CSS v4 |
| **State** | TanStack Query, React Hook Form, Zod validation |
| **Backend** | Supabase PostgreSQL, Real-time subscriptions |
| **AI/ML** | Azure OpenAI for product analysis |
| **Storage** | Supabase Storage for assets and documents |
| **UI Components** | shadcn/ui (30+ components) |

## Getting Started

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Supabase account with database connection
- Azure OpenAI API key (optional for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/uberfiix/az-product.git
   cd az-product
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or: npm install / pnpm install / yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Required variables:
   - `VITE_SUPABASE_URL` - Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
   - `AZURE_OPENAI_API_KEY` - Azure OpenAI API key (optional)

4. **Run development server**
   ```bash
   bun run dev
   # App will be available at http://localhost:8084
   ```

5. **Build for production**
   ```bash
   bun run build
   bun run preview
   ```

## Project Structure

```
src/
├── routes/               # TanStack Router file-based routing
│   ├── _authenticated/  # Protected routes
│   ├── login.tsx        # Authentication
│   └── __root.tsx       # Root layout
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── dashboard/       # Dashboard-specific components
│   ├── product-*.tsx    # Product management components
│   ├── supplier-*.tsx   # Supplier components
│   └── *.tsx            # Feature components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and helpers
├── integrations/        # External API integration
└── styles.css          # Global styles & design tokens
```

## Key Components

### Dashboard
- KPI cards with drill-down navigation
- Quick action buttons (Create Product, Import Data, Manage Pricing)
- System health indicators
- Recent activity feed

### Product Management
- **Form Component** - Product creation/editing with full validation
- **Gallery Component** - Professional asset viewing and management
- **Upload Zone** - Drag-drop file upload with progress tracking
- **Products List** - Sortable, filterable product table with bulk operations

### Supplier Management
- Supplier registry with tier classification
- Contact information management
- Performance metrics and inventory linking
- Sheet-based inline editing

### Request Management
- Product request lifecycle (Open → Review → Approval → Conversion)
- Status tracking with visual indicators
- Priority and type categorization
- Timestamp and audit logging

## Architecture Decisions

### State Management
Uses TanStack Query for server state management because:
- Automatic caching and synchronization
- Background refetching capabilities
- Built-in error and loading states
- Minimal boilerplate

### Form Handling
React Hook Form + Zod for:
- Type-safe form validation
- Better performance (field-level updates)
- Seamless integration with Supabase types
- Arabic error messages

### Styling
Tailwind CSS v4 with design tokens in `styles.css` for:
- Consistent color system
- RTL-first approach
- Dark/Light theme support
- Responsive design

## Security

### Authentication
- Supabase Auth with email/password
- Email verification required before account activation
- Session management with secure cookies
- Protected routes requiring authentication

### Database Security
- Row-Level Security (RLS) policies on all tables
- Parameterized queries (Supabase prevents SQL injection)
- Service Role Key restricted to backend
- API key rate limiting

### API Security
- CORS policy configured for allowed domains
- Rate limiting (100 requests/minute per API key)
- Input validation on all forms (Zod)
- CSRF tokens for state-changing operations

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Dashboard Load Time | < 2s | ✓ |
| Product List (1000 items) | < 1s | ✓ |
| Search Response | < 500ms | ✓ |
| API Response | < 200ms | ✓ |
| Mobile FCP | < 2.5s | ✓ |

## Deployment

### Vercel (Recommended)
1. Push to GitHub (main branch)
2. Connect GitHub repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy: Vercel automatically builds and deploys

### Docker
```bash
docker build -t azproud .
docker run -p 3000:3000 azproud
```

### Manual
```bash
bun run build
bun run preview
```

## Integration Points

### Daftra (Accounting)
- Sync product catalog to Daftra
- Create invoices from product requests
- Two-way sync with price updates

### Bot Gateway
- Expose product list API for chatbots
- AI-powered product recommendations
- Real-time inventory status

### ERPNext
- Inventory management sync
- Manufacturing orders integration
- Supply chain coordination

## API Reference

### Products
- `GET /api/products` - List products (paginated)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Suppliers
- `GET /api/suppliers` - List suppliers
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier

### Requests
- `GET /api/requests` - List product requests
- `POST /api/requests` - Create request
- `PATCH /api/requests/:id/status` - Update status

## Troubleshooting

### Issue: "VITE_SUPABASE_URL is not set"
**Solution:** Ensure `.env.local` file exists with all required environment variables.

### Issue: Auth redirects to login
**Solution:** Email verification may be pending. Check verification email or disable email confirmation in Supabase.

### Issue: Images not displaying
**Solution:** Check Supabase Storage bucket permissions and CORS settings.

## Contributing

1. Create feature branch from `main`
2. Make changes following code style
3. Test locally with `bun run dev`
4. Push and create pull request
5. Merge after review

## Code Style

- **Formatting:** Prettier (auto-format on save)
- **Linting:** ESLint with TypeScript support
- **Naming:** camelCase for variables/functions, PascalCase for components
- **Comments:** JSDoc for complex functions, inline for logic clarity

## Testing

Run tests:
```bash
bun run test
```

Coverage:
```bash
bun run test:coverage
```

## Monitoring & Maintenance

### Database Health
- Monitor query performance: Supabase Dashboard → Performance
- Check storage usage: Supabase Dashboard → Storage
- Review audit logs: `audit_logs` table in database

### Error Tracking
- Monitor errors in Supabase logs
- Toast notifications for user-facing errors
- Console logs for debugging (development only)

### Performance
- Use Lighthouse for performance audits
- Monitor bundle size: `bun run build` → dist/ folder
- Check Core Web Vitals in Vercel Analytics

## Support & Troubleshooting

For issues:
1. Check existing GitHub Issues
2. Review logs in Supabase Dashboard
3. Test in development environment first
4. Create detailed issue with reproduction steps

## License

Proprietary - Alazab PAOP

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.

---

**Last Updated:** May 2026  
**Maintainer:** Alazab Development Team
