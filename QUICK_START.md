# AzProud Quick Start Guide

Get up and running with AzProud in 5 minutes.

## For Developers

### 1. Clone & Install
```bash
git clone https://github.com/uberfiix/az-product.git
cd az-product
bun install
```

### 2. Setup Environment
```bash
cp .env.example .env.local
# Add your Supabase and Azure keys
```

### 3. Run Dev Server
```bash
bun run dev
# Open http://localhost:8084
```

### 4. Build for Production
```bash
bun run build
bun run preview
```

## For Operations

### Deploy to Vercel
```bash
# Push to GitHub main branch
git push origin main

# Vercel automatically deploys
# Monitor: https://vercel.com/projects/az-product
```

### Monitor Production
```bash
# View logs
vercel logs --follow

# Check database health
# https://your-project.supabase.co/admin/database
```

### Troubleshoot Issues
```bash
# Check build status
npm run build

# Run tests
npm run test

# Type check
npx tsc --noEmit
```

## For Users

### Login
- URL: https://azproud.alazab.com (or local dev server)
- Email: your@email.com
- Password: your password

### Create Product
1. Click "مورد جديد" (New Product) button
2. Fill in Arabic and English names
3. Select product type
4. Submit form

### Upload Assets
1. Go to Assets → Bulk Upload
2. Drag images into upload zone
3. Link to products
4. View in gallery

### Create Supplier
1. Go to Suppliers
2. Click "مورد جديد" (New Supplier)
3. Fill supplier details
4. Save

### Manage Pricing
1. Go to Pricing
2. Create new pricing rule
3. Set volume/tier-based pricing
4. Apply to products

## Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | / | Overview and KPIs |
| Products | /products | Product management |
| Suppliers | /suppliers | Supplier registry |
| Pricing | /pricing | Pricing rules |
| Requests | /requests | Product requests |
| Assets | /assets | Image gallery |
| Settings | /settings | Configuration |
| API Docs | /docs/API.md | API reference |

## Important Environment Variables

```env
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
AZURE_OPENAI_API_KEY=sk-...
VITE_API_URL=https://azproud.alazab.com/api
```

## Common Commands

```bash
# Development
bun run dev          # Start dev server
bun run build        # Production build
bun run preview      # Preview build
bun run test         # Run tests
bun run lint         # Check lint

# Database
supabase start       # Local Supabase
supabase db push     # Apply migrations

# Git
git add .
git commit -m "message"
git push origin main
```

## Performance Targets

✓ Dashboard: < 2 seconds  
✓ Product List: < 1.5 seconds  
✓ Search: < 500ms  
✓ API Response: < 200ms  

## Security Checklist

Before deploying:
- [ ] No API keys in code
- [ ] HTTPS/TLS enabled
- [ ] Rate limiting configured
- [ ] Database RLS enabled
- [ ] Email verification required
- [ ] CORS policy set
- [ ] Backups configured

## Support & Help

- **README:** Project overview and features
- **API.md:** API endpoint documentation
- **DEPLOYMENT.md:** Deployment procedures
- **INTEGRATIONS.md:** Third-party system integration
- **PRE_PRODUCTION_CHECKLIST.md:** Pre-launch verification

## Project Structure

```
src/
├── routes/           # Pages and routes
├── components/       # React components
├── hooks/           # Custom React hooks
├── lib/             # Utilities
└── styles.css       # Global styles

docs/
├── API.md           # API documentation
├── DEPLOYMENT.md    # Deployment guide
├── INTEGRATIONS.md  # Integration specs
└── PRE_PRODUCTION_CHECKLIST.md
```

## Useful Links

- **Repository:** https://github.com/uberfiix/az-product
- **Issue Tracker:** github.com/.../issues
- **Vercel Dashboard:** https://vercel.com/projects
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Azure OpenAI:** https://portal.azure.com

## Database Tables Quick Reference

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| products | Product catalog | name_ar, name_en, az_code, status |
| suppliers | Supplier registry | name_ar, tier, category |
| product_requests | Request management | product_name_ar, status, priority |
| pricing_rules | Pricing config | product_id, supplier_id, price |
| assets | Image gallery | file_path, product_id, type |
| audit_logs | Activity tracking | user_id, action, table_name |

## Status Page

### System Health
- Database: ✓ Connected
- Storage: ✓ Operational
- AI Service: ✓ Available
- API: ✓ Responding
- Build: ✓ Passing

### Last Updated
- Code: May 22, 2026
- Docs: May 22, 2026
- Database: May 22, 2026

---

For more details, see:
- README.md - Full project documentation
- docs/DEPLOYMENT.md - Deployment procedures
- docs/PRE_PRODUCTION_CHECKLIST.md - Launch verification
