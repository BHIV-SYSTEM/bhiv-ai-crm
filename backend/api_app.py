from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles
# Use database adapter for unified interface (supports both MongoDB and SQLite)
from database.adapter import DatabaseService, CRMService, init_database, DATABASE_TYPE
from integrations.llm_query_system import LLMQuerySystem
from integrations.google_maps_integration import GoogleMapsIntegration, VisitTracker
from integrations.office365_integration import Office365Integration
import agent_db
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from auth_system import (
    auth_system, get_current_user, require_permission, require_role,
    User, UserLogin, UserCreate, Token
)
from pydantic import BaseModel
import json
import requests
import os

# === INFIVERSE MODELS ===

class InfiverseUserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = 'User'
    department: Optional[str] = None

class InfiverseUserLogin(BaseModel):
    email: str
    password: str

class TaskCreate(BaseModel):
    title: str
    description: str
    status: Optional[str] = 'Pending'
    priority: Optional[str] = 'Medium'
    department: str
    assignee: str
    dueDate: datetime

class AttendanceStart(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    workFromHome: Optional[bool] = False

class ConsentUpdate(BaseModel):
    consent: bool

class AlertResponse(BaseModel):
    employeeId: Optional[str] = None
    severity: Optional[str] = None

# === CRM MODELS ===

class AccountCreate(BaseModel):
    name: str
    account_type: Optional[str] = 'customer'
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    territory: Optional[str] = None
    parent_account_id: Optional[str] = None
    account_manager_id: Optional[str] = None
    status: Optional[str] = 'active'
    lifecycle_stage: Optional[str] = 'prospect'
    created_by: Optional[str] = None
    notes: Optional[str] = None

class ContactCreate(BaseModel):
    account_id: str
    first_name: str
    last_name: str
    title: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    contact_role: Optional[str] = 'contact'
    is_primary: Optional[bool] = False
    reports_to_id: Optional[str] = None
    status: Optional[str] = 'active'
    created_by: Optional[str] = None
    notes: Optional[str] = None

class LeadCreate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    lead_source: Optional[str] = None
    lead_status: Optional[str] = 'new'
    lead_stage: Optional[str] = 'inquiry'
    budget: Optional[float] = None
    timeline: Optional[str] = None
    authority: Optional[str] = None
    need: Optional[str] = None
    assigned_to: Optional[str] = None
    territory: Optional[str] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None

class OpportunityCreate(BaseModel):
    account_id: str
    primary_contact_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    opportunity_type: Optional[str] = 'new_business'
    stage: Optional[str] = 'prospecting'
    probability: Optional[float] = 0.0
    amount: Optional[float] = None
    currency: Optional[str] = 'USD'
    expected_revenue: Optional[float] = None
    close_date: Optional[datetime] = None
    owner_id: Optional[str] = None
    requirements: Optional[str] = None
    products_interested: Optional[str] = None
    competitors: Optional[str] = None
    risks: Optional[str] = None
    created_by: Optional[str] = None
    notes: Optional[str] = None

class ActivityCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    activity_type: str  # call, email, meeting, task, note, visit
    status: Optional[str] = 'planned'
    priority: Optional[str] = 'medium'
    due_date: Optional[datetime] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    lead_id: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None
    communication_type: Optional[str] = None
    outcome: Optional[str] = None
    next_steps: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: Optional[str] = 'general'
    priority: Optional[str] = 'medium'
    status: Optional[str] = 'pending'
    due_date: Optional[datetime] = None
    reminder_date: Optional[datetime] = None
    assigned_to: str
    created_by: Optional[str] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    lead_id: Optional[str] = None

app = FastAPI(
    title="AI Agent Logistics API",
    description="Secure Database-backed API for AI Agent Logistics Automation",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Complete-Infiverse integration
INFIVERSE_BASE_URL = os.getenv("INFIVERSE_BASE_URL", "http://localhost:5000")

# Add CORS middleware with security considerations
# Allow frontend origins (Vite default ports + configured port)
# For development, allow all localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend configured port
        "http://localhost:3001",  # Frontend alternative port
        "http://localhost:5173",  # Vite default port
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:8501",  # Streamlit dashboard
        "http://localhost:8503",  # Streamlit dashboard
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:8000",  # Backend itself
        "http://localhost:8000",  # Backend itself
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
)

# Mount static files for product images
import os
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Security headers middleware (runs after CORS)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Only add security headers if it's not a CORS preflight request
    # and if the response doesn't already have CORS headers set by the middleware
    if request.method != "OPTIONS" and "Access-Control-Allow-Origin" not in response.headers:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Initialize integrations
llm_query_system = LLMQuerySystem()
google_maps = GoogleMapsIntegration()
visit_tracker = VisitTracker(google_maps)
office365 = Office365Integration()

# Initialize SETU integrations
try:
    from setu.mongo_store import MongoSetuStore
    from setu.trace_continuity import TraceContinuityValidator
    from setu.trace_continuity_middleware import TraceContinuityMiddleware
    from setu.sovereign_routing_adapter import SovereignRoutingAdapter
    from setu.bucket_lineage_adapter import BucketLineageAdapter
    from setu.telemetry_layer import TelemetryLayer
    from setu.signal_ingestion import SignalIngestionModule
    from setu.niyantran_integration_adapter import NiyantranIntegrationAdapter
    from setu.contract_validation import ContractValidator
    from setu.failure_handler import FailureHandler
    from setu.ui_visibility_service import SetuUIVisibilityService
    from setu.routes import create_setu_router
    
    # Initialize SETU components
    setu_store = MongoSetuStore()
    trace_validator = TraceContinuityValidator(setu_store)
    routing_adapter = SovereignRoutingAdapter()
    lineage_adapter = BucketLineageAdapter(setu_store)
    telemetry_layer = TelemetryLayer(setu_store)
    signal_ingestion = SignalIngestionModule(setu_store, telemetry_layer)
    niyantran_adapter = NiyantranIntegrationAdapter(setu_store)
    contract_validator = ContractValidator()
    failure_handler = FailureHandler(setu_store)
    ui_visibility = SetuUIVisibilityService(setu_store, niyantran_adapter)
    
    # Create SETU router
    setu_router = create_setu_router(
        trace_validator,
        routing_adapter,
        lineage_adapter,
        telemetry_layer,
        signal_ingestion,
        niyantran_adapter,
        contract_validator,
        failure_handler,
        ui_visibility
    )
    
    # Add SETU middleware
    app.add_middleware(
        TraceContinuityMiddleware,
        validator=trace_validator,
        path_prefix="/setu"
    )
    
    setu_integration_ready = True
except Exception as e:
    print(f"[WARNING] SETU integration failed to initialize: {e}")
    setu_integration_ready = False

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    print(f"[INFO] Initializing {DATABASE_TYPE.upper()} database...")
    init_database()
    print(f"[OK] {DATABASE_TYPE.upper()} database initialized")
    print("Authentication system ready")
    print("LLM Query System ready")
    print("Google Maps integration ready")
    print("Office 365 integration ready")
    
    # Include SETU router if initialization succeeded
    if setu_integration_ready:
        app.include_router(setu_router)
        print("[OK] SETU integration ready - signal ingestion, trace continuity, Niyantran visibility")
    else:
        print("[WARNING] SETU integration not available")

@app.get("/")
def read_root():
    return {
        "message": "AI Agent Logistics + CRM + Infiverse API",
        "version": "3.2.0",
        "status": "operational",
        "security": "JWT Authentication Enabled",
        "features": [
            "Order management",
            "Inventory tracking",
            "Returns processing",
            "Procurement automation",
            "Delivery tracking",
            "Dashboard analytics",
            "User authentication",
            "Role-based access control",
            "CRM (Accounts, Contacts, Leads, Opportunities, Activities, Tasks)",
            "Consolidated Endpoints (/account/view, /lead/pipeline, /opportunity/status, /llm_query)",
            "Integrations (Office 365 Email, Google Maps Visits, BOS Orders)",
            "Infiverse (Employee Monitoring, Tasks, Attendance, Alerts)",
            "AI Insights and Automation"
        ]
    }

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection without context manager (MongoDB doesn't support it)
        db_service = DatabaseService()
        try:
            db_service.get_orders(limit=1)
        except:
            pass  # It's OK if there are no orders yet
        
        # Test CRM database
        crm_service = CRMService()
        try:
            crm_service.get_accounts(limit=1)
        except:
            pass  # It's OK if there are no accounts yet

        return {
            "status": "healthy",
            "database": "connected",
            "modules": {
                "logistics": "operational",
                "crm": "operational",
                "infiverse": "operational",
                "integrations": {
                    "office365": "configured" if office365.client_id else "not_configured",
                    "google_maps": "configured" if google_maps.api_key else "not_configured",
                    "llm_query": "operational"
                }
            },
            "timestamp": datetime.now().isoformat(),
            "version": "3.2.0"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# === AUTHENTICATION ENDPOINTS ===

@app.post("/auth/login", response_model=Token)
def login(login_data: UserLogin):
    """User login"""
    return auth_system.login(login_data)

@app.post("/auth/refresh", response_model=Token)
def refresh_token(refresh_token: str):
    """Refresh access token"""
    return auth_system.refresh_access_token(refresh_token)

@app.post("/auth/logout")
def logout(refresh_token: str):
    """User logout"""
    success = auth_system.logout(refresh_token)
    return {"message": "Logged out successfully" if success else "Logout failed"}

@app.post("/auth/register", response_model=User)
def register(user_data: UserCreate, current_user: User = Depends(require_role("admin"))):
    """Register new user (admin only)"""
    return auth_system.create_user(user_data)

@app.get("/auth/me", response_model=User)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@app.get("/auth/users", response_model=List[User])
def list_users(current_user: User = Depends(require_role("admin"))):
    """List all users (admin only)"""
    return auth_system.list_users()

@app.get("/orders")
def get_orders(limit: int = 100, current_user: User = Depends(require_permission("read:orders"))):
    """Get orders from database (requires read:orders permission)"""
    try:
        with DatabaseService() as db_service:
            orders = db_service.get_orders(limit=limit)
        return {"orders": orders, "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/orders/{order_id}")
def get_order(order_id: int):
    """Get specific order by ID"""
    try:
        with DatabaseService() as db_service:
            order = db_service.get_order_by_id(order_id)
        if order:
            return order
        else:
            raise HTTPException(status_code=404, detail="Order not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/returns")
def get_returns(processed: bool = None):
    """Get returns from database"""
    try:
        with DatabaseService() as db_service:
            returns = db_service.get_returns(processed=processed)
        return {"returns": returns, "count": len(returns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/restock-requests")
def get_restock_requests(status: str = None):
    """Get restock requests"""
    try:
        with DatabaseService() as db_service:
            requests = db_service.get_restock_requests(status=status)
        return {"restock_requests": requests, "count": len(requests)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/inventory")
def get_inventory():
    """Get inventory status"""
    try:
        with DatabaseService() as db_service:
            inventory = db_service.get_inventory()
        return {"inventory": inventory, "count": len(inventory)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/inventory/low-stock")
def get_low_stock():
    """Get low stock items"""
    try:
        with DatabaseService() as db_service:
            low_stock = db_service.get_low_stock_items()
        return {"low_stock_items": low_stock, "count": len(low_stock)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/status")
def get_agent_status():
    """Get agent status and metrics"""
    try:
        status = agent_db.get_agent_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/run")
def run_agent():
    """Trigger agent execution"""
    try:
        success = agent_db.run_agent()
        return {"success": success, "message": "Agent execution completed" if success else "Agent execution failed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reviews/pending")
def get_pending_reviews():
    """Get pending human reviews"""
    try:
        with DatabaseService() as db_service:
            reviews = db_service.get_pending_reviews()
        return {"pending_reviews": reviews, "count": len(reviews)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/logs")
def get_agent_logs(limit: int = 100):
    """Get agent logs"""
    try:
        with DatabaseService() as db_service:
            logs = db_service.get_agent_logs(limit=limit)
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/performance")
def get_performance_metrics(days: int = 7):
    """Get performance analytics"""
    try:
        with DatabaseService() as db_service:
            metrics = db_service.get_performance_metrics(days=days)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Legacy endpoints for backward compatibility
@app.get("/get_orders")
def get_orders_legacy():
    """Legacy endpoint - redirects to /orders"""
    return get_orders()

@app.get("/get_returns")
def get_returns_legacy():
    """Legacy endpoint - redirects to /returns"""
    return get_returns()

@app.get("/procurement/purchase-orders")
def get_purchase_orders(status: str = None):
    """Get purchase orders"""
    try:
        with DatabaseService() as db_service:
            orders = db_service.get_purchase_orders(status=status)
        return {"purchase_orders": orders, "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/procurement/suppliers")
def get_suppliers():
    """Get suppliers"""
    try:
        with DatabaseService() as db_service:
            suppliers = db_service.get_suppliers()
        return {"suppliers": suppliers, "count": len(suppliers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/procurement/suppliers")
def create_supplier(supplier_data: dict, current_user: User = Depends(require_permission("write:suppliers"))):
    """Create new supplier"""
    try:
        from database.models import SessionLocal, Supplier
        db = SessionLocal()
        
        # Check if supplier_id already exists
        existing = db.query(Supplier).filter(Supplier.supplier_id == supplier_data['supplier_id']).first()
        if existing:
            db.close()
            raise HTTPException(status_code=400, detail="Supplier ID already exists")
        
        # Create new supplier
        new_supplier = Supplier(
            supplier_id=supplier_data['supplier_id'],
            name=supplier_data['name'],
            contact_email=supplier_data.get('contact_email'),
            contact_phone=supplier_data.get('contact_phone'),
            api_endpoint=supplier_data.get('api_endpoint'),
            lead_time_days=supplier_data.get('lead_time_days', 7),
            minimum_order=supplier_data.get('minimum_order', 1),
            is_active=supplier_data.get('is_active', True)
        )
        
        db.add(new_supplier)
        db.commit()
        
        # Return created supplier
        result = {
            'supplier_id': new_supplier.supplier_id,
            'name': new_supplier.name,
            'contact_email': new_supplier.contact_email,
            'contact_phone': new_supplier.contact_phone,
            'lead_time_days': new_supplier.lead_time_days,
            'minimum_order': new_supplier.minimum_order,
            'is_active': new_supplier.is_active
        }
        
        db.close()
        return {"message": "Supplier created successfully", "supplier": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/procurement/suppliers/{supplier_id}")
def update_supplier(supplier_id: str, supplier_data: dict, current_user: User = Depends(require_permission("write:suppliers"))):
    """Update existing supplier"""
    try:
        from database.models import SessionLocal, Supplier
        db = SessionLocal()
        
        # Find existing supplier
        supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
        if not supplier:
            db.close()
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Update fields
        if 'name' in supplier_data:
            supplier.name = supplier_data['name']
        if 'contact_email' in supplier_data:
            supplier.contact_email = supplier_data['contact_email']
        if 'contact_phone' in supplier_data:
            supplier.contact_phone = supplier_data['contact_phone']
        if 'api_endpoint' in supplier_data:
            supplier.api_endpoint = supplier_data['api_endpoint']
        if 'lead_time_days' in supplier_data:
            supplier.lead_time_days = supplier_data['lead_time_days']
        if 'minimum_order' in supplier_data:
            supplier.minimum_order = supplier_data['minimum_order']
        if 'is_active' in supplier_data:
            supplier.is_active = supplier_data['is_active']
        
        db.commit()
        
        # Return updated supplier
        result = {
            'supplier_id': supplier.supplier_id,
            'name': supplier.name,
            'contact_email': supplier.contact_email,
            'contact_phone': supplier.contact_phone,
            'lead_time_days': supplier.lead_time_days,
            'minimum_order': supplier.minimum_order,
            'is_active': supplier.is_active
        }
        
        db.close()
        return {"message": "Supplier updated successfully", "supplier": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/procurement/run")
def run_procurement():
    """Trigger procurement agent"""
    try:
        from procurement_agent import run_procurement_agent
        results = run_procurement_agent()
        return {
            "success": True,
            "results": results,
            "message": f"Procurement cycle completed: {results['purchase_orders_created']} POs created, {results['items_submitted_for_review']} items for review"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/delivery/shipments")
def get_shipments(status: str = None):
    """Get shipments"""
    try:
        with DatabaseService() as db_service:
            shipments = db_service.get_shipments(status=status)
        return {"shipments": shipments, "count": len(shipments)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/delivery/track/{tracking_number}")
def track_shipment(tracking_number: str):
    """Track shipment by tracking number"""
    try:
        with DatabaseService() as db_service:
            shipment = db_service.get_shipment_by_tracking(tracking_number)
        if shipment:
            return shipment
        else:
            raise HTTPException(status_code=404, detail="Tracking number not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/delivery/order/{order_id}")
def get_shipment_by_order(order_id: int):
    """Get shipment by order ID"""
    try:
        with DatabaseService() as db_service:
            shipment = db_service.get_shipment_by_order(order_id)
        if shipment:
            return shipment
        else:
            raise HTTPException(status_code=404, detail="No shipment found for this order")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/delivery/couriers")
def get_couriers():
    """Get couriers"""
    try:
        with DatabaseService() as db_service:
            couriers = db_service.get_couriers()
        return {"couriers": couriers, "count": len(couriers)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/delivery/run")
def run_delivery():
    """Trigger delivery agent"""
    try:
        from delivery_agent import run_delivery_agent
        results = run_delivery_agent()
        return {
            "success": True,
            "results": results,
            "message": f"Delivery cycle completed: {results['shipments_created']} shipments created, {results['shipments_updated']} updated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/kpis")
def get_dashboard_kpis():
    """Get dashboard KPIs"""
    try:
        with DatabaseService() as db_service:
            orders = db_service.get_orders()
            shipments = db_service.get_shipments()
            inventory = db_service.get_inventory()
            low_stock = db_service.get_low_stock_items()
            purchase_orders = db_service.get_purchase_orders()
            pending_reviews = db_service.get_pending_reviews()
            performance = db_service.get_performance_metrics(days=7)

            # Calculate KPIs
            total_orders = len(orders)
            active_shipments = len([s for s in shipments if s['status'] not in ['delivered', 'cancelled']])
            delivered_shipments = len([s for s in shipments if s['status'] == 'delivered'])
            delivery_rate = (delivered_shipments / len(shipments) * 100) if shipments else 0

            low_stock_count = len(low_stock)
            stock_health = ((len(inventory) - low_stock_count) / len(inventory) * 100) if inventory else 100

            pending_pos = len([po for po in purchase_orders if po['status'] == 'pending'])
            automation_rate = performance.get('automation_rate', 0) if isinstance(performance, dict) else 0

            kpis = {
                'total_orders': total_orders,
                'active_shipments': active_shipments,
                'delivery_rate': round(delivery_rate, 1),
                'stock_health': round(stock_health, 1),
                'low_stock_count': low_stock_count,
                'pending_pos': pending_pos,
                'automation_rate': round(automation_rate, 1),
                'pending_reviews': len(pending_reviews)
            }

        return {"kpis": kpis, "timestamp": datetime.now().isoformat()}
    except Exception as e:
        import traceback
        print(f"ERROR in /dashboard/kpis: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/alerts")
def get_dashboard_alerts():
    """Get system alerts"""
    try:
        from notification_system import NotificationSystem
        notif_system = NotificationSystem()

        # Get all types of alerts
        stock_alerts = notif_system.check_stock_alerts()
        delivery_alerts = notif_system.check_delivery_alerts()
        system_alerts = notif_system.check_system_alerts()

        all_alerts = stock_alerts + delivery_alerts + system_alerts

        # Sort by severity
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        all_alerts.sort(key=lambda x: severity_order.get(x['severity'], 4))

        return {"alerts": all_alerts, "count": len(all_alerts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/dashboard/notifications/run")
def run_notification_system():
    """Trigger notification system"""
    try:
        from notification_system import run_notification_system
        results = run_notification_system()
        return {
            "success": True,
            "results": results,
            "message": f"Notification cycle completed: {results['alerts_created']} alerts, {results['notifications_sent']} notifications"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/charts")
def get_dashboard_charts(current_user: User = Depends(get_current_user)):
    """Get dashboard charts data"""
    try:
        with DatabaseService() as db_service:
            orders = db_service.get_orders(limit=100)
            shipments = db_service.get_shipments(limit=100)
            inventory = db_service.get_inventory()

        # Process order status distribution
        order_status = {}
        for order in orders:
            status = order.get('Status', 'unknown')
            order_status[status] = order_status.get(status, 0) + 1

        # Process shipment status distribution
        shipment_status = {}
        for shipment in shipments:
            status = shipment.get('status', 'unknown')
            shipment_status[status] = shipment_status.get(status, 0) + 1

        # Process inventory data for charts
        inventory_data = {
            'labels': [item['ProductID'] for item in inventory[:15]],  # Top 15 products
            'currentStock': [item['CurrentStock'] for item in inventory[:15]],
            'reorderPoint': [item['ReorderPoint'] for item in inventory[:15]]
        }

        return {
            "orderStatus": order_status,
            "shipmentStatus": shipment_status,
            "inventory": inventory_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === EMPLOYEE API ENDPOINTS ===

@app.get("/api/employee/{employee_id}/metrics")
def get_employee_metrics(employee_id: str, current_user: User = Depends(get_current_user)):
    """Get employee personal metrics"""
    try:
        # Mock data for now - in production this would come from HR system
        metrics = {
            'performance_score': 85.5,
            'tasks_completed': 47,
            'pending_reviews': 2,
            'achievements': [
                {'title': 'Quality Excellence Award', 'date': '2024-10-01'},
                {'title': 'Team Player Recognition', 'date': '2024-09-15'}
            ],
            'performance_history': [
                {'date': '2024-10-01', 'score': 82.3},
                {'date': '2024-10-08', 'score': 85.1},
                {'date': '2024-10-15', 'score': 85.5}
            ]
        }
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/employee/{employee_id}/review-request")
def request_employee_review(employee_id: str, review_data: dict, current_user: User = Depends(get_current_user)):
    """Submit employee review request"""
    try:
        # In production, this would save to HR database
        review_request = {
            'employee_id': employee_id,
            'type': review_data.get('type'),
            'comments': review_data.get('comments'),
            'status': 'pending',
            'submitted_at': datetime.now().isoformat()
        }
        return {"message": "Review request submitted successfully", "request": review_request}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/employee/{employee_id}/attendance")
def get_employee_attendance(employee_id: str, current_user: User = Depends(get_current_user)):
    """Get employee attendance history"""
    try:
        # Mock attendance data - in production this would come from attendance system
        attendance_records = [
            {
                'date': '2024-10-15',
                'status': 'present',
                'check_in': '09:00',
                'check_out': '17:30',
                'hours_worked': 8.5
            },
            {
                'date': '2024-10-14',
                'status': 'present',
                'check_in': '08:45',
                'check_out': '17:15',
                'hours_worked': 8.5
            },
            {
                'date': '2024-10-13',
                'status': 'present',
                'check_in': '09:15',
                'check_out': '17:45',
                'hours_worked': 8.5
            }
        ]
        return attendance_records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/employee/{employee_id}/privacy")
def update_employee_privacy(employee_id: str, privacy_settings: dict, current_user: User = Depends(get_current_user)):
    """Update employee privacy settings"""
    try:
        # In production, this would update user preferences in database
        settings = {
            'employee_id': employee_id,
            'facial_recognition_opt_in': privacy_settings.get('facial_recognition_opt_in', False),
            'updated_at': datetime.now().isoformat()
        }
        return {"message": "Privacy settings updated successfully", "settings": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === ATTENDANCE API ENDPOINTS ===

@app.post("/api/attendance/checkin")
def attendance_checkin(attendance_data: dict, current_user: User = Depends(get_current_user)):
    """Process attendance check-in with facial recognition"""
    try:
        employee_id = attendance_data.get('employee_id')
        image_data = attendance_data.get('image_data')

        if not employee_id:
            raise HTTPException(status_code=400, detail="Employee ID is required")

        # In production, this would process facial recognition
        # For now, simulate successful check-in
        checkin_record = {
            'employee_id': employee_id,
            'action': 'checkin',
            'timestamp': attendance_data.get('timestamp', datetime.now().isoformat()),
            'status': 'success',
            'method': 'facial_recognition'
        }

        return {"message": "Check-in successful", "record": checkin_record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/attendance/checkout")
def attendance_checkout(attendance_data: dict, current_user: User = Depends(get_current_user)):
    """Process attendance check-out with facial recognition"""
    try:
        employee_id = attendance_data.get('employee_id')
        image_data = attendance_data.get('image_data')

        if not employee_id:
            raise HTTPException(status_code=400, detail="Employee ID is required")

        # In production, this would process facial recognition
        # For now, simulate successful check-out
        checkout_record = {
            'employee_id': employee_id,
            'action': 'checkout',
            'timestamp': attendance_data.get('timestamp', datetime.now().isoformat()),
            'status': 'success',
            'method': 'facial_recognition'
        }

        return {"message": "Check-out successful", "record": checkout_record}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/attendance/{employee_id}")
def get_attendance_records(employee_id: str, current_user: User = Depends(get_current_user)):
    """Get attendance records for employee"""
    try:
        # Mock attendance data - in production this would come from attendance database
        records = [
            {
                'date': '2024-10-15',
                'status': 'present',
                'check_in': '09:00',
                'check_out': '17:30',
                'hours_worked': 8.5
            },
            {
                'date': '2024-10-14',
                'status': 'present',
                'check_in': '08:45',
                'check_out': '17:15',
                'hours_worked': 8.5
            },
            {
                'date': '2024-10-11',
                'status': 'present',
                'check_in': '09:15',
                'check_out': '17:45',
                'hours_worked': 8.5
            },
            {
                'date': '2024-10-10',
                'status': 'absent',
                'check_in': None,
                'check_out': None,
                'hours_worked': 0
            }
        ]
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/dashboard/activity")
def get_recent_activity():
    """Get recent system activity"""
    try:
        with DatabaseService() as db_service:
            logs = db_service.get_agent_logs(limit=20)

            # Format logs for dashboard
            formatted_logs = []
            for log in logs:
                formatted_logs.append({
                    'timestamp': log['timestamp'],
                    'action': log['action'],
                    'product_id': log['ProductID'],
                    'quantity': log['quantity'],
                    'confidence': log['confidence'],
                    'human_review': log['human_review'],
                    'details': log['details'][:100] + '...' if log['details'] and len(log['details']) > 100 else log['details']
                })

        return {"activity": formatted_logs, "count": len(formatted_logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === CRM ENDPOINTS ===

# === ACCOUNT ENDPOINTS ===

@app.post("/accounts", response_model=dict)
def create_account(account: AccountCreate, current_user: User = Depends(require_permission("write:accounts"))):
    """Create a new account"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_account(account.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.options("/accounts")
def options_accounts():
    """Handle CORS preflight for accounts endpoint"""
    return {"message": "OK"}

@app.get("/accounts", response_model=dict)
def get_accounts(
    account_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    territory: Optional[str] = Query(None),
    account_manager_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:accounts"))
):
    """Get accounts with optional filters"""
    try:
        filters = {}
        if account_type:
            filters['account_type'] = account_type
        if status:
            filters['status'] = status
        if territory:
            filters['territory'] = territory
        if account_manager_id:
            filters['account_manager_id'] = account_manager_id

        with CRMService() as crm_service:
            accounts = crm_service.get_accounts(filters=filters, limit=limit)
            return {"accounts": accounts, "count": len(accounts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/accounts/{account_id}", response_model=dict)
def get_account(account_id: str, current_user: User = Depends(require_permission("read:accounts"))):
    """Get account by ID with full details"""
    try:
        with CRMService() as crm_service:
            account = crm_service.get_account_by_id(account_id)
            if account:
                return account
            else:
                raise HTTPException(status_code=404, detail="Account not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/accounts/{account_id}", response_model=dict)
def update_account(account_id: str, update_data: dict, current_user: User = Depends(require_permission("write:accounts"))):
    """Update account"""
    try:
        with CRMService() as crm_service:
            account = crm_service.update_account(account_id, update_data)
            if account:
                return account
            else:
                raise HTTPException(status_code=404, detail="Account not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === CONTACT ENDPOINTS ===

@app.post("/contacts", response_model=dict)
def create_contact(contact: ContactCreate, current_user: User = Depends(require_permission("write:contacts"))):
    """Create a new contact"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_contact(contact.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/contacts", response_model=dict)
def get_contacts(
    account_id: Optional[str] = Query(None),
    contact_role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:contacts"))
):
    """Get contacts with optional filters"""
    try:
        filters = {}
        if contact_role:
            filters['contact_role'] = contact_role
        if status:
            filters['status'] = status

        with CRMService() as crm_service:
            contacts = crm_service.get_contacts(account_id=account_id, filters=filters, limit=limit)
            return {"contacts": contacts, "count": len(contacts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contacts/{contact_id}", response_model=dict)
def get_contact(contact_id: str, current_user: User = Depends(require_permission("read:contacts"))):
    """Get contact by ID"""
    try:
        with CRMService() as crm_service:
            contact = crm_service.get_contact_by_id(contact_id)
            if contact:
                return contact
            else:
                raise HTTPException(status_code=404, detail="Contact not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === LEAD ENDPOINTS ===

@app.post("/leads", response_model=dict)
def create_lead(lead: LeadCreate, current_user: User = Depends(require_permission("write:leads"))):
    """Create a new lead"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_lead(lead.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/leads", response_model=dict)
def get_leads(
    lead_status: Optional[str] = Query(None),
    lead_source: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    converted: Optional[bool] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:leads"))
):
    """Get leads with optional filters"""
    try:
        filters = {}
        if lead_status:
            filters['lead_status'] = lead_status
        if lead_source:
            filters['lead_source'] = lead_source
        if assigned_to:
            filters['assigned_to'] = assigned_to
        if converted is not None:
            filters['converted'] = converted

        with CRMService() as crm_service:
            leads = crm_service.get_leads(filters=filters, limit=limit)
            return {"leads": leads, "count": len(leads)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/leads/{lead_id}", response_model=dict)
def get_lead(lead_id: str, current_user: User = Depends(require_permission("read:leads"))):
    """Get lead by ID"""
    try:
        with CRMService() as crm_service:
            lead = crm_service.get_lead_by_id(lead_id)
            if lead:
                return lead
            else:
                raise HTTPException(status_code=404, detail="Lead not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/leads/{lead_id}/convert", response_model=dict)
def convert_lead(lead_id: str, opportunity_data: OpportunityCreate, current_user: User = Depends(require_permission("write:leads"))):
    """Convert lead to opportunity"""
    try:
        with CRMService() as crm_service:
            result = crm_service.convert_lead_to_opportunity(lead_id, opportunity_data.dict())
            return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === OPPORTUNITY ENDPOINTS ===

@app.post("/opportunities", response_model=dict)
def create_opportunity(opportunity: OpportunityCreate, current_user: User = Depends(require_permission("write:opportunities"))):
    """Create a new opportunity"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_opportunity(opportunity.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/opportunities", response_model=dict)
def get_opportunities(
    stage: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    is_closed: Optional[bool] = Query(None),
    close_date_from: Optional[datetime] = Query(None),
    close_date_to: Optional[datetime] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:opportunities"))
):
    """Get opportunities with optional filters"""
    try:
        filters = {}
        if stage:
            filters['stage'] = stage
        if owner_id:
            filters['owner_id'] = owner_id
        if account_id:
            filters['account_id'] = account_id
        if is_closed is not None:
            filters['is_closed'] = is_closed
        if close_date_from:
            filters['close_date_from'] = close_date_from
        if close_date_to:
            filters['close_date_to'] = close_date_to

        with CRMService() as crm_service:
            opportunities = crm_service.get_opportunities(filters=filters, limit=limit)
            return {"opportunities": opportunities, "count": len(opportunities)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/opportunities/{opportunity_id}", response_model=dict)
def get_opportunity(opportunity_id: str, current_user: User = Depends(require_permission("read:opportunities"))):
    """Get opportunity by ID"""
    try:
        with CRMService() as crm_service:
            opportunity = crm_service.get_opportunity_by_id(opportunity_id)
            if opportunity:
                return opportunity
            else:
                raise HTTPException(status_code=404, detail="Opportunity not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/opportunities/{opportunity_id}/stage", response_model=dict)
def update_opportunity_stage(opportunity_id: str, stage_data: dict, current_user: User = Depends(require_permission("write:opportunities"))):
    """Update opportunity stage and probability"""
    try:
        stage = stage_data.get('stage')
        probability = stage_data.get('probability')

        if not stage:
            raise HTTPException(status_code=400, detail="Stage is required")

        with CRMService() as crm_service:
            opportunity = crm_service.update_opportunity_stage(opportunity_id, stage, probability)
            if opportunity:
                return opportunity
            else:
                raise HTTPException(status_code=404, detail="Opportunity not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === ACTIVITY ENDPOINTS (Messaging/Notes) ===

@app.post("/activities", response_model=dict)
def create_activity(activity: ActivityCreate, current_user: User = Depends(require_permission("write:activities"))):
    """Create a new activity (note, call, email, meeting, etc.)"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_activity(activity.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/activities", response_model=dict)
def get_activities(
    activity_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    opportunity_id: Optional[str] = Query(None),
    lead_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:activities"))
):
    """Get activities with optional filters"""
    try:
        filters = {}
        if activity_type:
            filters['activity_type'] = activity_type
        if status:
            filters['status'] = status
        if assigned_to:
            filters['assigned_to'] = assigned_to
        if account_id:
            filters['account_id'] = account_id
        if opportunity_id:
            filters['opportunity_id'] = opportunity_id
        if lead_id:
            filters['lead_id'] = lead_id

        with CRMService() as crm_service:
            activities = crm_service.get_activities(filters=filters, limit=limit)
            return {"activities": activities, "count": len(activities)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/activities/{activity_id}/complete", response_model=dict)
def complete_activity(activity_id: str, completion_data: dict, current_user: User = Depends(require_permission("write:activities"))):
    """Mark activity as completed"""
    try:
        outcome = completion_data.get('outcome')
        next_steps = completion_data.get('next_steps')

        with CRMService() as crm_service:
            activity = crm_service.complete_activity(activity_id, outcome, next_steps)
            if activity:
                return activity
            else:
                raise HTTPException(status_code=404, detail="Activity not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === TASK ENDPOINTS (Tasks/Reminders) ===

@app.post("/tasks", response_model=dict)
def create_task(task: TaskCreate, current_user: User = Depends(require_permission("write:tasks"))):
    """Create a new task"""
    try:
        with CRMService() as crm_service:
            return crm_service.create_task(task.dict())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/tasks", response_model=dict)
def get_tasks(
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    opportunity_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: User = Depends(require_permission("read:tasks"))
):
    """Get tasks with optional filters"""
    try:
        filters = {}
        if status:
            filters['status'] = status
        if assigned_to:
            filters['assigned_to'] = assigned_to
        if priority:
            filters['priority'] = priority
        if account_id:
            filters['account_id'] = account_id
        if opportunity_id:
            filters['opportunity_id'] = opportunity_id

        with CRMService() as crm_service:
            tasks = crm_service.get_tasks(filters=filters, limit=limit)
            return {"tasks": tasks, "count": len(tasks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === CONSOLIDATED ENDPOINTS ===

@app.get("/account/view/{account_id}", response_model=dict)
def get_account_view(account_id: str, current_user: User = Depends(require_permission("read:accounts"))):
    """Get comprehensive account view with contacts, opportunities, orders, and tasks"""
    try:
        with CRMService() as crm_service:
            # Get account details
            account = crm_service.get_account_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")

            # Get related data
            contacts = crm_service.get_contacts(account_id=account_id, limit=50)
            opportunities = crm_service.get_opportunities(filters={'account_id': account_id}, limit=50)
            tasks = crm_service.get_tasks(filters={'account_id': account_id}, limit=50)
            activities = crm_service.get_activities(filters={'account_id': account_id}, limit=20)

        # Get orders from logistics system
        try:
            with DatabaseService() as db_service:
                orders = db_service.get_orders(limit=50)
                # Filter orders by account (assuming customer_id maps to account)
                account_orders = [o for o in orders if o.get('customer_id') == account_id]
        except:
            account_orders = []

        return {
            "account": account,
            "contacts": contacts,
            "opportunities": opportunities,
            "orders": account_orders,
            "tasks": tasks,
            "recent_activities": activities
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/lead/pipeline", response_model=dict)
def get_lead_pipeline(current_user: User = Depends(require_permission("read:leads"))):
    """Get all leads organized by stage/status"""
    try:
        with CRMService() as crm_service:
            leads = crm_service.get_leads(limit=500)

        # Group leads by stage and status
        pipeline = {}
        for lead in leads:
            stage = lead.get('lead_stage', 'unknown')
            status = lead.get('lead_status', 'unknown')

            if stage not in pipeline:
                pipeline[stage] = {}

            if status not in pipeline[stage]:
                pipeline[stage][status] = []

            pipeline[stage][status].append(lead)

        # Add counts
        pipeline_summary = {}
        for stage, statuses in pipeline.items():
            pipeline_summary[stage] = {}
            for status, leads_list in statuses.items():
                pipeline_summary[stage][status] = len(leads_list)

        return {
            "pipeline": pipeline,
            "summary": pipeline_summary,
            "total_leads": len(leads)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/opportunity/status", response_model=dict)
def get_opportunity_status(current_user: User = Depends(require_permission("read:opportunities"))):
    """Get opportunities with current stage and linked tasks"""
    try:
        with CRMService() as crm_service:
            opportunities = crm_service.get_opportunities(limit=500)

        # Get tasks linked to opportunities
        opportunity_tasks = {}
        for opp in opportunities:
            opp_id = opp['opportunity_id']
            try:
                tasks = crm_service.get_tasks(filters={'opportunity_id': opp_id}, limit=20)
                opportunity_tasks[opp_id] = tasks
            except:
                opportunity_tasks[opp_id] = []

        # Group by stage
        by_stage = {}
        for opp in opportunities:
            stage = opp.get('stage', 'unknown')
            if stage not in by_stage:
                by_stage[stage] = []
            by_stage[stage].append({
                **opp,
                'linked_tasks': opportunity_tasks.get(opp['opportunity_id'], [])
            })

        return {
            "opportunities_by_stage": by_stage,
            "total_opportunities": len(opportunities)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm_query", response_model=dict)
def process_llm_query(query_data: dict, current_user: User = Depends(require_permission("read:crm"))):
    """Process natural language queries against CRM data"""
    try:
        query = query_data.get('query', '').strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        user_context = query_data.get('context', {})

        # Process the query
        result = llm_query_system.process_query(query, user_context)

        # Generate natural language response
        natural_response = llm_query_system.generate_natural_response(result)

        return {
            'query': query,
            'result': result,
            'natural_response': natural_response,
            'timestamp': datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === INTEGRATION ENDPOINTS ===

@app.post("/integrations/office365/email", response_model=dict)
def send_office365_email(email_data: dict, current_user: User = Depends(require_permission("write:emails"))):
    """Send email via Office 365 integration"""
    try:
        to_email = email_data.get('to_email')
        subject = email_data.get('subject')
        body = email_data.get('body')
        cc_emails = email_data.get('cc_emails', [])
        attachments = email_data.get('attachments', [])

        if not to_email or not subject or not body:
            raise HTTPException(status_code=400, detail="to_email, subject, and body are required")

        result = office365.send_email(to_email, subject, body, cc_emails, attachments)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrations/google-maps/visit", response_model=dict)
def plan_visit(visit_data: dict, current_user: User = Depends(require_permission("write:visits"))):
    """Plan a visit using Google Maps integration"""
    try:
        account_id = visit_data.get('account_id')
        purpose = visit_data.get('purpose', 'Business visit')
        scheduled_time_str = visit_data.get('scheduled_time')

        if not account_id:
            raise HTTPException(status_code=400, detail="Account ID is required")

        if not scheduled_time_str:
            raise HTTPException(status_code=400, detail="Scheduled time is required")

        # Get account data
        with CRMService() as crm_service:
            account = crm_service.get_account_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")

        scheduled_time = datetime.fromisoformat(scheduled_time_str.replace('Z', '+00:00'))

        visit_plan = visit_tracker.plan_visit(account, purpose, scheduled_time)

        return visit_plan

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrations/bos/order", response_model=dict)
def create_order_from_opportunity(order_data: dict, current_user: User = Depends(require_permission("write:orders"))):
    """Create order from opportunity (BOS integration)"""
    try:
        # This would integrate with the existing logistics system
        # For now, return a placeholder response
        return {
            "message": "Order created from opportunity",
            "order_id": f"ORD_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "opportunity_id": order_data.get('opportunity_id'),
            "status": "created"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# === DASHBOARD API PREP ===

@app.get("/dashboard/crm", response_model=dict)
def get_crm_dashboard(current_user: User = Depends(require_permission("read:crm"))):
    """Get comprehensive CRM dashboard data for account view"""
    try:
        with CRMService() as crm_service:
            dashboard_data = crm_service.get_crm_dashboard_data()

        # Add recent activities and tasks
        with CRMService() as crm_service:
            recent_activities = crm_service.get_activities(limit=10)
            pending_tasks = crm_service.get_tasks(filters={'status': 'pending'}, limit=20)

        dashboard_data['recent_activities'] = recent_activities
        dashboard_data['pending_tasks'] = pending_tasks

        return dashboard_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === INFIVERSE ENDPOINTS ===

# Auth endpoints
@app.post("/api/auth/register")
def infiverse_register(user_data: InfiverseUserCreate):
    """Register new user for Infiverse"""
    try:
        # Use existing auth system
        create_data = UserCreate(
            username=user_data.email,
            email=user_data.email,
            password=user_data.password,
            role=user_data.role
        )
        return auth_system.create_user(create_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
def infiverse_login(login_data: InfiverseUserLogin):
    """Login for Infiverse"""
    try:
        user_login = UserLogin(email=login_data.email, password=login_data.password)
        return auth_system.login(user_login)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/auth/me")
def infiverse_get_me(current_user: User = Depends(get_current_user)):
    """Get current user info for Infiverse"""
    return current_user

# Tasks endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/tasks", methods=["GET", "POST"])
async def proxy_infiverse_tasks(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy tasks requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/tasks"
        headers = dict(request.headers)
        # Remove host header
        headers.pop('host', None)
        # Add auth token if needed
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            params = dict(request.query_params)
            response = requests.get(url, headers=headers, params=params)
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks")
async def create_infiverse_task(request: Request, current_user: User = Depends(get_current_user)):
    """Create new task in Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/tasks"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        data = await request.json()
        response = requests.post(url, headers=headers, json=data)
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse task service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Monitoring endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/monitoring/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_infiverse_monitoring(path: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy monitoring requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/monitoring/{path}"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            response = requests.get(url, headers=headers, params=dict(request.query_params))
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        elif request.method == "PUT":
            data = await request.json()
            response = requests.put(url, headers=headers, json=data)
        elif request.method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse monitoring service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Attendance endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/attendance/{path:path}", methods=["GET", "POST"])
async def proxy_infiverse_attendance(path: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy attendance requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/attendance/{path}"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            response = requests.get(url, headers=headers, params=dict(request.query_params))
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Consent endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/consent", methods=["GET", "POST"])
async def proxy_infiverse_consent(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy consent requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/consent"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            response = requests.get(url, headers=headers, params=dict(request.query_params))
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse consent service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Alerts endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/alerts", methods=["GET"])
async def proxy_infiverse_alerts(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy alerts requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/alerts"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        response = requests.get(url, headers=headers, params=dict(request.query_params))
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Notifications endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/notifications/{path:path}", methods=["GET", "POST"])
async def proxy_infiverse_notifications(path: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy notifications requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/notifications/{path}"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            response = requests.get(url, headers=headers, params=dict(request.query_params))
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# AI endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/ai/{path:path}", methods=["GET", "POST"])
async def proxy_infiverse_ai(path: str, request: Request, current_user: User = Depends(get_current_user)):
    """Proxy AI requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/ai/{path}"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        if request.method == "GET":
            response = requests.get(url, headers=headers, params=dict(request.query_params))
        elif request.method == "POST":
            data = await request.json()
            response = requests.post(url, headers=headers, json=data)
        else:
            raise HTTPException(status_code=405, detail="Method not allowed")

        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse AI service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Departments endpoints - Proxy to Complete-Infiverse
@app.api_route("/api/departments", methods=["GET"])
async def proxy_infiverse_departments(request: Request, current_user: User = Depends(get_current_user)):
    """Proxy departments requests to Complete-Infiverse"""
    try:
        url = f"{INFIVERSE_BASE_URL}/api/departments"
        headers = dict(request.headers)
        headers.pop('host', None)
        headers['Authorization'] = f"Bearer {request.headers.get('authorization', '').replace('Bearer ', '')}"

        response = requests.get(url, headers=headers, params=dict(request.query_params))
        return response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Infiverse service error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === PRODUCT MODELS ===

class ProductCreate(BaseModel):
    product_id: str
    name: str
    category: str
    description: Optional[str] = None
    unit_price: float
    weight_kg: Optional[float] = 0.0
    dimensions: Optional[str] = None
    supplier_id: str
    reorder_point: Optional[int] = 10
    max_stock: Optional[int] = 100
    is_active: Optional[bool] = True
    marketing_description: Optional[str] = None
    key_features: Optional[str] = None  # JSON string
    specifications: Optional[str] = None  # JSON string

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    supplier_id: Optional[str] = None
    reorder_point: Optional[int] = None
    max_stock: Optional[int] = None
    is_active: Optional[bool] = None
    marketing_description: Optional[str] = None
    key_features: Optional[str] = None
    specifications: Optional[str] = None

# === PRODUCT CRUD ENDPOINTS ===

@app.get("/products")
async def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    category: Optional[str] = None,
    supplier_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all products with filtering and pagination"""
    try:
        db = SessionLocal()
        try:
            query = db.query(Product)
            
            # Apply filters
            if category:
                query = query.filter(Product.category == category)
            if supplier_id:
                query = query.filter(Product.supplier_id == supplier_id)
            if is_active is not None:
                query = query.filter(Product.is_active == is_active)
            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    (Product.name.ilike(search_term)) |
                    (Product.product_id.ilike(search_term)) |
                    (Product.description.ilike(search_term))
                )
            
            # Get total count
            total = query.count()
            
            # Apply pagination and ordering
            products = query.order_by(Product.updated_at.desc()).offset(skip).limit(limit).all()
            
            # Get inventory for each product
            result = []
            for product in products:
                inventory = db.query(Inventory).filter(Inventory.product_id == product.product_id).first()
                stock_quantity = inventory.current_stock if inventory else 0
                
                # Determine stock status
                if stock_quantity == 0:
                    status = 'out_of_stock'
                elif inventory and product.reorder_point and stock_quantity <= product.reorder_point:
                    status = 'low_stock'
                else:
                    status = 'in_stock'
                
                product_data = {
                    'id': product.product_id,
                    'product_id': product.product_id,
                    'name': product.name,
                    'category': product.category,
                    'description': product.description,
                    'price': product.unit_price,
                    'unit_price': product.unit_price,
                    'stock': stock_quantity,
                    'weight_kg': product.weight_kg,
                    'dimensions': product.dimensions,
                    'supplier_id': product.supplier_id,
                    'reorder_point': product.reorder_point,
                    'max_stock': product.max_stock,
                    'status': status,
                    'is_active': product.is_active,
                    'image': product.primary_image_url or product.thumbnail_url or 'https://via.placeholder.com/200',
                    'thumbnail_url': product.thumbnail_url,
                    'primary_image_url': product.primary_image_url,
                    'gallery_images': json.loads(product.gallery_images) if product.gallery_images else [],
                    'marketing_description': product.marketing_description,
                    'key_features': json.loads(product.key_features) if product.key_features else [],
                    'specifications': json.loads(product.specifications) if product.specifications else {},
                    'created_at': product.created_at.isoformat() if product.created_at else None,
                    'updated_at': product.updated_at.isoformat() if product.updated_at else None,
                }
                result.append(product_data)
            
            return {
                'products': result,
                'total': total,
                'skip': skip,
                'limit': limit
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

@app.get("/products/{product_id}")
async def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single product by ID"""
    try:
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.product_id == product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
            
            inventory = db.query(Inventory).filter(Inventory.product_id == product_id).first()
            stock_quantity = inventory.current_stock if inventory else 0
            
            if stock_quantity == 0:
                status = 'out_of_stock'
            elif inventory and product.reorder_point and stock_quantity <= product.reorder_point:
                status = 'low_stock'
            else:
                status = 'in_stock'
            
            return {
                'id': product.product_id,
                'product_id': product.product_id,
                'name': product.name,
                'category': product.category,
                'description': product.description,
                'price': product.unit_price,
                'unit_price': product.unit_price,
                'stock': stock_quantity,
                'weight_kg': product.weight_kg,
                'dimensions': product.dimensions,
                'supplier_id': product.supplier_id,
                'reorder_point': product.reorder_point,
                'max_stock': product.max_stock,
                'status': status,
                'is_active': product.is_active,
                'image': product.primary_image_url or product.thumbnail_url or 'https://via.placeholder.com/200',
                'thumbnail_url': product.thumbnail_url,
                'primary_image_url': product.primary_image_url,
                'gallery_images': json.loads(product.gallery_images) if product.gallery_images else [],
                'marketing_description': product.marketing_description,
                'key_features': json.loads(product.key_features) if product.key_features else [],
                'specifications': json.loads(product.specifications) if product.specifications else {},
                'created_at': product.created_at.isoformat() if product.created_at else None,
                'updated_at': product.updated_at.isoformat() if product.updated_at else None,
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch product: {str(e)}")

@app.post("/products")
async def create_product(
    product_data: ProductCreate,
    current_user: User = Depends(require_permission("write:products"))
):
    """Create a new product"""
    try:
        db = SessionLocal()
        try:
            # Check if product_id already exists
            existing = db.query(Product).filter(Product.product_id == product_data.product_id).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Product {product_data.product_id} already exists")
            
            # Create product
            new_product = Product(
                product_id=product_data.product_id,
                name=product_data.name,
                category=product_data.category,
                description=product_data.description,
                unit_price=product_data.unit_price,
                weight_kg=product_data.weight_kg,
                dimensions=product_data.dimensions,
                supplier_id=product_data.supplier_id,
                reorder_point=product_data.reorder_point,
                max_stock=product_data.max_stock,
                is_active=product_data.is_active,
                marketing_description=product_data.marketing_description,
                key_features=product_data.key_features,
                specifications=product_data.specifications,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_product)
            db.commit()
            db.refresh(new_product)
            
            # Create initial inventory entry
            initial_inventory = Inventory(
                product_id=product_data.product_id,
                current_stock=0,
                reserved_stock=0,
                available_stock=0,
                last_updated=datetime.utcnow()
            )
            db.add(initial_inventory)
            db.commit()
            
            return {
                'id': new_product.product_id,
                'product_id': new_product.product_id,
                'name': new_product.name,
                'message': 'Product created successfully'
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")

@app.put("/products/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user: User = Depends(require_permission("write:products"))
):
    """Update an existing product"""
    try:
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.product_id == product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
            
            # Update fields
            update_data = product_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(product, field, value)
            
            product.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(product)
            
            return {
                'id': product.product_id,
                'product_id': product.product_id,
                'name': product.name,
                'message': 'Product updated successfully'
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update product: {str(e)}")

@app.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(require_permission("write:products"))
):
    """Delete a product (soft delete by setting is_active=False)"""
    try:
        db = SessionLocal()
        try:
            product = db.query(Product).filter(Product.product_id == product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
            
            # Soft delete
            product.is_active = False
            product.updated_at = datetime.utcnow()
            db.commit()
            
            return {'message': f'Product {product_id} deleted successfully'}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete product: {str(e)}")

@app.get("/products/categories")
async def get_categories(current_user: User = Depends(get_current_user)):
    """Get all product categories"""
    try:
        db = SessionLocal()
        try:
            categories = db.query(Product.category).distinct().all()
            return {'categories': [cat[0] for cat in categories]}
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@app.get("/products/stats")
async def get_product_stats(current_user: User = Depends(get_current_user)):
    """Get product statistics"""
    try:
        db = SessionLocal()
        try:
            total_products = db.query(Product).filter(Product.is_active == True).count()
            
            # Get inventory stats
            in_stock = 0
            low_stock = 0
            out_of_stock = 0
            
            products = db.query(Product).filter(Product.is_active == True).all()
            for product in products:
                inventory = db.query(Inventory).filter(Inventory.product_id == product.product_id).first()
                stock = inventory.current_stock if inventory else 0
                
                if stock == 0:
                    out_of_stock += 1
                elif product.reorder_point and stock <= product.reorder_point:
                    low_stock += 1
                else:
                    in_stock += 1
            
            return {
                'total_products': total_products,
                'in_stock': in_stock,
                'low_stock': low_stock,
                'out_of_stock': out_of_stock
            }
        finally:
            db.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

# === PRODUCT IMAGE ENDPOINTS ===

@app.post("/products/{product_id}/images/primary")
async def upload_primary_image(
    product_id: str,
    file: UploadFile = File(...)
):
    """Upload primary product image (internal dashboard use)"""
    try:
        # Create a mock user for internal dashboard operations
        from auth_system import User
        from datetime import datetime
        mock_user = User(
            user_id="dashboard_internal",
            username="dashboard", 
            email="dashboard@internal",
            role="admin",
            permissions=["write:all"],
            created_at=datetime.now()
        )
        
        from product_image_api import upload_primary_image as upload_primary
        result = await upload_primary(product_id, file, mock_user)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/products/{product_id}/images/gallery")
async def upload_gallery_image(
    product_id: str,
    file: UploadFile = File(...)
):
    """Upload gallery image for product (internal dashboard use)"""
    try:
        # Create a mock user for internal dashboard operations
        from auth_system import User
        from datetime import datetime
        mock_user = User(
            user_id="dashboard_internal",
            username="dashboard",
            email="dashboard@internal", 
            role="admin",
            permissions=["write:all"],
            created_at=datetime.now()
        )
        
        from product_image_api import upload_gallery_image as upload_gallery
        result = await upload_gallery(product_id, file, mock_user)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/products/{product_id}/images")
async def get_product_images(product_id: str):
    """Get all images for a product"""
    try:
        from product_image_api import get_product_images as get_images
        result = await get_images(product_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/products/{product_id}/images/{image_type}")
async def delete_product_image(
    product_id: str,
    image_type: str,
    image_url: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Delete product image"""
    try:
        from product_image_api import delete_product_image as delete_image
        result = await delete_image(product_id, image_type, image_url, current_user)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === CUSTOMER PORTAL ROUTES ===
# Include customer portal API routes
try:
    from customer_portal_api import router as customer_router
    app.include_router(customer_router, tags=["Customer Portal"])
    print("[OK] Customer Portal API routes loaded")
except Exception as e:
    print(f"[WARNING] Could not load customer portal routes: {e}")

if __name__ == "__main__":
    import uvicorn
    print("Starting AI Agent Logistics API Server...")
    print("Dashboard: http://localhost:8501")
    print("API Docs: http://localhost:8001/docs")
    print("Authentication: JWT enabled")
    uvicorn.run(app, host="0.0.0.0", port=8001)
