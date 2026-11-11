# SETU Project Execution & Deployment Guide

Production-ready Node.js Express + MongoDB backend (`backend-nodejs`) and React + Vite frontend (`frontend`) with full SETU signal ingestion, Bright Connection Tally connector, provenance validation, DAG graph engines, and AI-Artha integration.

---

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: MongoDB Atlas Cluster or local MongoDB instance (`mongodb://localhost:27017`)

---

## ⚙️ Environment Configuration

### 1. Backend Environment (`backend-nodejs/.env`)

Ensure the file `backend-nodejs/.env` exists with the following configuration:

```env
PORT=8000
NODE_ENV=production

# MongoDB Connection String (Atlas Cluster)
MONGODB_URL="mongodb+srv://blackholeinfiverse51:Blackhole051@cluster0.7c16heb.mongodb.net/ai_crm_logistics?retryWrites=true&w=majority&appName=Cluster0"

# Security & Authentication
JWT_SECRET=ai-crm-logistics-super-secret-jwt-key-2026-change-in-production
JWT_EXPIRES_IN=7d

# Admin Default Credentials
ADMIN_EMAIL=admin@company.com
ADMIN_NAME="System Administrator"
ADMIN_PASSWORD=Admin@123456

# CORS Configuration
CORS_ORIGINS=https://ai-crm-sigma-five.vercel.app,https://setu.blackholeinfiverse.com,http://localhost:3000,http://localhost:5173

# Sampada / SETU Gateway Integration
SAMPADA_SETU_ENABLED=true
SAMPADA_SETU_BASE_URL=https://bhiv-hr-gateway-l0xp.onrender.com
SAMPADA_SETU_API_KEY=prod_api_key_XUqM2msdCa4CYIaRywRNXRVc477nlI3AQ-lr6cgTB2o
SAMPADA_SETU_CORRELATION_ID=3d0a7d1a-1be8-4267-af5b-8d239ea25049
SAMPADA_SETU_TIMEOUT_S=30

# Email Service Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=blackholeinfiverse51@gmail.com
SMTP_PASSWORD=kzqwqzuevmcvzhgu
SMTP_FROM_EMAIL=blackholeinfiverse51@gmail.com
SMTP_FROM_NAME="AI CRM Logistics"

# UniGuru AI Service Configuration
UNIGURU_SERVICE_URL=http://163.128.209.18:8007
UNIGURU_API_TOKEN=your-uniguru-api-token
UNIGURU_CALLER_NAME=bhiv-setu
```

### 2. Frontend Environment (`frontend/.env`)

Ensure the file `frontend/.env` exists with the following configuration:

```env
# Node.js SETU Backend API URL
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Embedded Dashboard URLs
VITE_ARTHA_URL=http://localhost:5173/
VITE_NIYANTRAN_URL=http://localhost:5174/
VITE_SAMPADA_URL=http://localhost:5175/
```

---

## 🚀 How to Run locally

### Step 1: Start the SETU Node.js Backend Server

Open a terminal window and execute:

```powershell
cd "backend-nodejs"

# 1. Install dependencies (first time only)
npm install

# 2. Seed initial MongoDB database (optional)
npm run seed

# 3. Start the backend server
node src/server.js
```

*The backend server will run at **`http://localhost:8000`**.*

---

### Step 2: Start the SETU React Frontend

Open a second terminal window and execute:

```powershell
cd "frontend"

# 1. Install dependencies (first time only)
npm install

# 2. Start the Vite development server
npm run dev
```

*The frontend application will run at **`http://localhost:5173`** (or the port displayed by Vite).*

---

## 🧪 Running Automated Test Suites

The backend includes 3 automated test suites covering 100% of SETU's engines and integration pipelines:

```powershell
cd "backend-nodejs"

# Test 1: Provenance & Bright Connection Connector Suite (7 tests)
node test/testProvenanceLocal.test.js

# Test 2: SETU Infrastructure Engine Suite (DAG, Lineage, Telemetry, Sovereign, Niyantran) (5 tests)
node test/testSetuInfrastructure.test.js

# Test 3: Full End-to-End AI-Artha to SETU Integration Test
node test/testArthaToSetuEndToEnd.test.js
```

### Run All Tests Together:

```powershell
node test/testProvenanceLocal.test.js; node test/testSetuInfrastructure.test.js; node test/testArthaToSetuEndToEnd.test.js
```

---

## 🛠️ Manual Testing via PowerShell Commands

When the backend server is running on `http://localhost:8000`, open PowerShell and test endpoints directly:

### 1. Transform Bright Connection Catalog
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/setu/bright/catalog" -Method Post -ContentType "application/json" -Body '{
  "items": [
    { "sku": "BC-HAMMER-01", "name": "Claw Hammer 16oz", "category": "Tools", "price": 24.99, "stock": 150, "store_id": "GODOWN-MUMBAI-01" }
  ],
  "sync_id": "sync_batch_99"
}' | ConvertTo-Json -Depth 5
```

### 2. Transform Bright Connection Order Payload
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/setu/bright/orders" -Method Post -ContentType "application/json" -Body '{
  "order_id": "ORD-2026-9901",
  "customer_id": "DEALER-440",
  "shop_name": "Sharma Hardware",
  "total_amount": 1500.0,
  "items": [{ "product_id": "BC-HAMMER-01", "name": "Claw Hammer", "quantity": 20, "unit_price": 25.0 }]
}' | ConvertTo-Json -Depth 5
```

### 3. Ingest Signal & Execute Quarantine Policy
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/setu/signals/ingest" -Method Post -ContentType "application/json" -Body '{
  "trace_id": "trc_test_99999",
  "entity_id": "ent_hardware_01",
  "event_type": "stock_sync",
  "signal_type": "inventory",
  "severity": "info",
  "timestamp": "2026-08-25T12:00:00Z",
  "tenant_id": "tenant_bright_connection",
  "failure_action": "quarantine"
}' | ConvertTo-Json -Depth 5
```

### 4. Query UI Candidate Visibility State
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/setu/visibility/candidate/trc_test_99999" -Method Get | ConvertTo-Json -Depth 5
```

---

## 🔗 AI-Artha & Tally Connect Live Integration

To test live dispatches from **AI-Artha** (`bhiv-artha`) to **SETU**:

1. Open `bhiv-artha/bhiv-Ai-Artha/backend/.env` and ensure SETU integration is enabled:
   ```env
   SETU_ENABLED=true
   SETU_BASE_URL=http://localhost:8000
   SETU_API_KEY=setu-secure-key-123
   ```
2. Start AI-Artha backend on port `5000` (`npm start`).
3. Open AI-Artha Frontend (`http://localhost:5173/signals`) and click **"SEND TO SETU"** on any compliance signal.
4. AI-Artha will dispatch the signal live to `http://localhost:8000/setu/signals/ingest`, returning **`SETU DISPATCH CONFIRMED (HTTP 200)`**.

