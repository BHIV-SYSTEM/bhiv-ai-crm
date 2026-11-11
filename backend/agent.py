import os
from datetime import datetime
import pandas as pd
from human_review import review_system
from database.service import DatabaseService

try:
    from notification_service import send_info_alert, send_success_alert, send_warning_alert, send_critical_alert
    NOTIFICATIONS_ENABLED = True
except ImportError:
    NOTIFICATIONS_ENABLED = False
    def send_info_alert(*args, **kwargs): pass
    def send_success_alert(*args, **kwargs): pass
    def send_warning_alert(*args, **kwargs): pass
    def send_critical_alert(*args, **kwargs): pass

# === Config ===
THRESHOLD = 5
RETURNS_FILE = "returns.xlsx"
RESTOCK_FILE = "restock.xlsx"
LOG_FILE = "agent_log.csv"

# === Step 1: Sense ===
def sense():
    if os.path.exists(RETURNS_FILE):
        if RETURNS_FILE.endswith(".xlsx"):
            return pd.read_excel(RETURNS_FILE)
        return pd.read_csv(RETURNS_FILE)
    print("🔍 Reading returns data from database...")
    try:
        with DatabaseService() as db_service:
            returns = db_service.get_returns(processed=False)
        return returns
    except Exception as e:
        print(f"Database unavailable: {e}")
        return pd.DataFrame(columns=["ProductID", "ReturnQuantity"])

# === Step 2: Plan ===
def plan(returns):
    print("🧠 Planning restock actions...")
    restocks = []
    if isinstance(returns, pd.DataFrame):
        for _, row in returns.iterrows():
            qty = row.get("ReturnQuantity")
            pid = row.get("ProductID")
            if qty is not None and qty > THRESHOLD:
                restocks.append({
                    "ProductID": pid,
                    "RestockQuantity": int(qty)
                })
        return restocks

    for item in returns:
        qty = item.get("ReturnQuantity") or item.get("return_quantity")
        pid = item.get("ProductID") or item.get("product_id")
        if qty is not None and qty > THRESHOLD:
            restocks.append({
                "ProductID": pid,
                "RestockQuantity": qty
            })
    return restocks

# === Step 3: Act ===
def act(restocks):
    if restocks:
        # Send alert about restock processing
        send_info_alert("Restock Processing Started", 
                       f"Processing {len(restocks)} restock requests",
                       {"total_requests": len(restocks), "timestamp": datetime.now().isoformat()})
        
        approved_restocks = []
        review_items = []

        for restock in restocks:
            action_data = {
                "product_id": restock["ProductID"],
                "quantity": restock["RestockQuantity"]
            }

            try:
                needs_review = review_system.requires_human_review("restock", action_data)
            except TypeError:
                needs_review = review_system.requires_human_review(action_data)

            if needs_review:
                decision = f"Restock {restock['ProductID']} with quantity {restock['RestockQuantity']}"
                try:
                    review_id = review_system.submit_for_review("restock", action_data, decision)
                except TypeError:
                    review_id = review_system.submit_for_review(action_data)
                print(f"⏳ Restock for {restock['ProductID']} pending human review (ID: {review_id})")
                review_items.append(restock)

                send_warning_alert("Human Review Required", 
                                 f"Restock for {restock['ProductID']} requires human review",
                                 {"product_id": restock["ProductID"], 
                                  "quantity": restock["RestockQuantity"],
                                  "review_id": review_id})
            else:
                approved_restocks.append(restock)

        # Write approved restocks to file if RESTOCK_FILE path is set and approved restocks exist
        if approved_restocks:
            try:
                df = pd.DataFrame(approved_restocks)
                if RESTOCK_FILE.endswith(".xlsx"):
                    df.to_excel(RESTOCK_FILE, index=False)
                else:
                    df.to_csv(RESTOCK_FILE, index=False)
            except Exception as e:
                print(f"Warning writing restock file: {e}")

            # Write to log file if set (one entry per approved item for correct row counts)
            try:
                log_entries = []
                for r in approved_restocks:
                    log_entries.append({
                        "Timestamp": datetime.now().isoformat(),
                        "Action": "AutoApproved",
                        "ProductID": r["ProductID"],
                        "RestockQuantity": r["RestockQuantity"],
                        "Status": "Approved"
                    })
                log_df = pd.DataFrame(log_entries)
                file_exists = os.path.exists(LOG_FILE)
                log_df.to_csv(LOG_FILE, mode='a' if file_exists else 'w', index=False, header=not file_exists)
            except Exception as e:
                print(f"Warning writing log file: {e}")

        # Database actions if available
        try:
            with DatabaseService() as db_service:
                for restock in approved_restocks:
                    confidence = 0.95
                    try:
                        confidence = review_system.calculate_confidence("restock", {"product_id": restock["ProductID"], "quantity": restock["RestockQuantity"]})
                    except Exception:
                        pass
                    created = db_service.create_restock_request(
                        restock["ProductID"], restock["RestockQuantity"], confidence
                    )
                    if created:
                        db_service.log_agent_action(
                            action="RestockRequest",
                            product_id=restock["ProductID"],
                            quantity=restock["RestockQuantity"],
                            confidence=confidence,
                            human_review=False,
                            details="Auto-approved restock request created"
                        )
                        try:
                            db_service.mark_returns_processed(restock["ProductID"])
                        except Exception:
                            pass
        except Exception:
            pass

        # Send success alert for approved restocks
        if approved_restocks:
            send_success_alert("Restocks Approved", 
                             f"Successfully processed {len(approved_restocks)} automatic restocks",
                             {"approved_count": len(approved_restocks),
                              "products": [r["ProductID"] for r in approved_restocks]})

        if len(approved_restocks) < len(restocks):
            print(f"ℹ️ {len(restocks) - len(approved_restocks)} restock(s) pending human review")
    else:
        print("ℹ️ No restock needed.")
        send_info_alert("Restock Check Complete", "No restocks needed at this time")

# === Log actions ===
def log_actions(restocks):
    try:
        with DatabaseService() as db_service:
            for item in restocks:
                confidence = 0.95
                try:
                    confidence = review_system.calculate_confidence("restock", {"product_id": item["ProductID"], "quantity": item["RestockQuantity"]})
                except Exception:
                    pass
                db_service.log_agent_action(
                    action="RestockRequest",
                    product_id=item["ProductID"],
                    quantity=item["RestockQuantity"],
                    confidence=confidence,
                    human_review=False,
                    details="Auto-approved restock request created"
                )
        print("📜 Actions logged to database.")
    except Exception as e:
        print(f"Could not log to database: {e}")

# === Main Agent Flow ===
def run_agent():
    try:
        send_info_alert("Agent Cycle Started", "Restock agent beginning processing cycle")
        returns = sense()
        plan_result = plan(returns)
        act(plan_result)
        send_success_alert("Agent Cycle Complete", "Restock agent completed processing cycle successfully")
        return True
    except Exception as e:
        error_msg = f"Agent error: {str(e)}"
        print(f"⚠️  {error_msg}")
        send_critical_alert("Agent Error", error_msg, 
                           {"error_type": type(e).__name__,
                            "error_details": str(e),
                            "timestamp": datetime.now().isoformat()})
        return False

# === Run ===
if __name__ == "__main__":
    run_agent()
