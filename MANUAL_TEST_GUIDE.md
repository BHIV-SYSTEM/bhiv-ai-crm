# SETU — Manual Test Guide

End-to-end walkthrough for the role-based portals, the customer e-commerce
redesign and the ARTHA single sign-on. Everything below was verified live on
2026-10-11 (browser + API), except where marked otherwise.

## 1. Start the stack

| Service | Command | URL |
|---|---|---|
| SETU backend | `cd backend-nodejs && PORT=8000 npm run dev` | http://localhost:8000 |
| SETU frontend | `cd frontend && npm run dev` | http://localhost:3000 |
| ARTHA backend | `cd "C:\Users\Ashmit Pandey\Downloads\AI-Artha-main\backend" && PORT=5000 npm run dev` | http://localhost:5000 |
| ARTHA frontend | `cd "C:\Users\Ashmit Pandey\Downloads\AI-Artha-main\frontend" && npm run dev` | http://localhost:5173 |

> Note: shells in this environment inject `PORT=0`, so always pass an explicit
> `PORT=…` to the Node backends. Both backends use MongoDB **Atlas** — no
> local mongod required.

Automated suites (run from `backend-nodejs`):

```bash
npm test          # 31/31 pass, incl. ARTHA→SETU end-to-end (needs SETU backend running)
```

## 2. Test accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | `admin@company.com` | `Admin@123456` | SETU admin dashboard (`/`) |
| Manager | `manager@company.com` | `Manager@123` | SETU admin dashboard (`/`) |
| Customer | `customer1@example.com` | `Customer@123` | Customer portal Shop (`/customer-portal`) |
| Customer | `customer2@example.com` | `Customer@123` | Customer portal Shop (`/customer-portal`) |
| **Seller** | `seller1@company.com` | `Seller@123` | My Parcel Workspace (`/seller-portal`) |
| **Seller** | `seller2@company.com` | `Seller@123` | My Parcel Workspace (`/seller-portal`) |
| Seller (legacy) | `seller@company.com` | `Seller@123` | My Parcel Workspace (`/seller-portal`) |

The seller account is created through the admin API (role `seller` is a new
SETU role — sellers get the dispatch workspace, never the SETU products):

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"email":"seller@company.com","password":"Seller@123","name":"Demo Seller","role":"seller"}'
```

## 3. Customer portal (e-commerce, Amazon/Flipkart-style)

1. Open http://localhost:3000 in a **private window** → you are redirected to `/auth/login`.
2. Sign in as `customer1@example.com` / `Customer@123`.
   - ✅ Lands on **Shop** (`/customer-portal`) — product catalogue with search,
     category filter, add-to-cart fly animation.
   - ✅ Sidebar shows only: **Shop · My Orders · Account · Notifications**.
     No SETU product tabs (CRM, Logistics, ARTHA, Finance …) anywhere.
3. Add 1–2 products to the cart → **Place Order**.
   - ✅ You are redirected to **My Orders**, where the new order appears with
     its ARTHA invoice number (e.g. `SETU-ORD-…`) and a **Pay Now** button.
4. Open **My Orders** (`/customer-portal/orders`).
   - ✅ Order cards show status badges (Order placed / On the way / Delivered),
     item chips, invoice + payment state, **Buy again**, **Track order**
     (live shipment timeline), and **Mark Received** for dispatched orders.
   - ✅ Filter chips (All / Placed / On the way / Delivered) and search work.
5. Open **Account** (`/customer-portal/account`).
   - ✅ Profile card (name, email, role, Active badge, Account ID),
     order-activity stats (total/placed/on the way/delivered, total spent),
     quick actions.
6. Open **Notifications** (`/customer-portal/notifications`).
   - ✅ Order/shipping/invoice events stream in; unread badge counts down as
     you open them. (Finance/GST/TDS pages are gone — customers no longer see
     internal accounting; the four Finance pages and the finance chat widget
     were deleted.)
7. Sign out from the sidebar → back on the login page.

## 4. Multi-seller: create seller IDs, assign parcels, per-seller isolation

The admin creates as many seller IDs as there are delivery partners, then
assigns each parcel to a specific seller. **A seller only ever sees and moves
the parcels assigned to them** — no cross-seller leakage, enforced server-side.

### 4a. Admin creates seller IDs

1. Sign in as admin → **Users** (`/users`).
2. Click Add User, choose role **"Seller (delivery partner)"**, fill in
   name/email/password.
   - ✅ The new seller appears in the list with a green `seller` badge and can
     log straight into `/seller-portal`.
   - Two demo sellers already exist: `seller1@company.com` and
     `seller2@company.com` (both `Seller@123`).

### 4b. Admin assigns a parcel to a seller

1. As admin, open **Sellers & Dispatch** in the sidebar (→ `/seller-portal`).
   - ✅ Admin view titled "Sellers & Dispatch" with an extra **Unassigned** KPI.
   - ✅ The orders table has an **Assigned seller** dropdown per parcel.
2. Pick a seller in the dropdown for any parcel.
   - ✅ Toast confirms "Parcel assigned to …", the row shows the seller, the
     Unassigned count drops, and the seller gets a notification
     ("Parcel ORD-… assigned to you").
   - Choosing "— Unassigned —" takes the parcel back (visible to all sellers
     again — unassigned parcels belong to no seller).
3. Assignment is validated: assigning to a non-seller (e.g. a customer)
   returns **400**; only admin/manager can assign.

### 4c. Per-seller isolation (the important part)

1. Sign in as `seller1@company.com` → **My Parcel Workspace**.
   - ✅ Only the parcels assigned to seller1 are listed (KPIs are scoped too).
   - ✅ Tabs: **Orders & Invoices**, **Dealer / Shipping** (pickup → transit →
     out for delivery → delivered), **Notifications**.
2. Sign in as `seller2@company.com` in another private window.
   - ✅ seller2's list does **not** contain seller1's parcels — the orders list,
     the shipment worklist, order details, tracking and shipment-by-order
     endpoints all return empty/**403** for foreign parcels.
   - ✅ seller2 cannot dispatch or advance the status of seller1's parcel
     (**403**), even with the order/shipment ID in hand.
3. seller1 dispatches their own parcel → ✅ 200; the shipment lifecycle
   (Start pickup → In transit → Out for delivery → Delivered) works on their
   own parcels only.
4. Staff data APIs still refuse every seller (`GET /api/dashboard/stats` →
   **403**). The legacy URL `/shipping-portal` redirects to `/seller-portal`. ✅

## 5. ARTHA single sign-on (per-user identity + data privacy)

Single sign-on now gives **each SETU person their own ARTHA account** in the
tenant's company — no more shared accountant service account:

| SETU role | ARTHA identity | Can do inside ARTHA |
|---|---|---|
| Admin | `sub_admin` (company **Admin**), own email/name | Everything in their company, incl. **creating that company's accountants & viewers** |
| Manager | `viewer` | Read-only company data |
| Customer / Seller | none — SSO ticket returns **403** | — |

Identities are provisioned server-to-server on first SSO
(`POST /api/v1/bridge/provision`, guarded by a shared-secret scope token) and
cached for 10 minutes; if ARTHA is unreachable, SSO falls back to the legacy
shared integration account so the page still opens.

### 5a. Verify the flow

1. Sign in to SETU as `admin@company.com` / `Admin@123456`.
2. Open **AI Artha** (`/ai-artha`).
   - ✅ The embedded ARTHA dashboard loads **already signed in** — no login
     form, no password re-entry.
   - ✅ API check: `GET /api/v1/users/me` with the SSO cookie returns
     `email: admin@company.com | role: sub_admin` in the tenant's company.
3. As this company Admin, open **Users** inside ARTHA and create an
   **Accountant** or **Viewer** — ✅ creation succeeds (the company Admin role
   manages only its own company's employees; the Super Admin role can never be
   created or reassigned).
4. Sign in to SETU as `manager@company.com` / `Manager@123` → same flow.
   - ✅ ARTHA identity is `manager@company.com | role: viewer` (read-only);
     listing users returns **403**.
5. Negative tests (API-level, verified):
   - Customer or seller requests an SSO ticket → **403**.
   - Replaying an exchanged ticket → **400** (one-time, 60 s TTL).
   - The ARTHA JWT never crosses the browser — only an opaque ticket — and
     lands as an HttpOnly `blackhole_token` cookie.

### 5b. Data privacy (each account sees only its own company)

1. ✅ The SSO identity sees **only its own company's invoices** (verified:
   the admin's workspace lists the 19 company invoices, nothing else).
2. Cross-company "shared invoices" (matched by company GSTIN) are now
   **opt-in and off by default** in the ARTHA backend
   (`ARTHA_SHARED_INVOICE_GSTIN_MATCH=on` restores the feature). With it off,
   an invoice from another company only appears when it was **explicitly
   addressed to your own email** — accounts never see other companies' data
   by GSTIN alone. Verified: the shared-invoice list returns **0** foreign
   invoices after the fix.

> Localhost note: `blackhole_token` is host-scoped, so on `localhost` every
> port (3000/5173/8000) shares one cookie — opening `:5173` directly after
> signing into ARTHA under a different account switches identity everywhere.
> On real deployments SETU and ARTHA live on different hosts, so each keeps
> its own cookie. Use the embedded page inside SETU for a deterministic demo.

## 6. Seller login entry point

Sellers are created by the admin (section 4a) and sign in through the same
login page — there is now a visible entry:

1. Open http://localhost:3000/auth/login → click
   **"🚚 Delivery partner? Sign in to your Seller Portal"**.
   - ✅ The page switches to seller mode: heading "Sign in to your seller
     account", the note "Sellers are created by their SETU administrator — no
     self sign-up", and a "Staff or customer? Sign in normally" link back.
     Direct URL: `/auth/login?portal=seller`.
2. Sign in as `seller1@company.com` / `Seller@123` →
   - ✅ Lands in **My Parcel Workspace** with only their assigned parcels
     (role-based routing; verified earlier in section 4c).

## 6. Regression checks

- `cd frontend && npx vite build` → ✅ builds clean.
- `cd backend-nodejs && npm test` → ✅ 31/31.
- ESLint: no new problems in files touched by this work; the repo-wide
  baseline (~230 pre-existing issues, e.g. unused `React` imports) is unchanged.
- Signup / forgot-password / reset-password flows are untouched.
