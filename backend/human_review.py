import os
import pandas as pd
import json
from datetime import datetime
from typing import Dict, List, Optional

class HumanReviewSystem:
    def __init__(self):
        self.pending_reviews_file = "data/pending_reviews.json"
        self.review_log_file = "data/review_log.csv"
        self.confidence_threshold = 0.7
        
    def calculate_confidence(self, action_type: str, data: Dict) -> float:
        """Calculate confidence score for agent decisions"""    
        confidence = 0.8  # Start with base confidence
        
        if action_type == "restock":
            # Lower confidence for very high quantities
            quantity = data.get("quantity", 0)
            if quantity > 25:   
                confidence = 0.5  # Low confidence for very high quantities
            elif quantity > 20:
                confidence = 0.6
            elif quantity > 10:
                confidence = 0.7
                
            # Lower confidence if no historical data
            if not self._has_historical_data(data.get("product_id")):
                confidence -= 0.1
                
        elif action_type == "chatbot_response":
            # Lower confidence for complex queries
            query = data.get("query", "").lower()
            urgent_words = ["urgent", "emergency", "complaint", "refund"]
            urgent_count = sum(1 for word in urgent_words if word in query)
            
            if urgent_count >= 2:
                confidence = 0.3  # Very low confidence for multiple urgent keywords
            elif urgent_count == 1:
                confidence = 0.6  # Medium confidence for single urgent keyword
                
        return max(0.1, min(1.0, confidence))
    
    def _has_historical_data(self, product_id: str) -> bool:
        """Check if we have historical data for this product"""
        try:
            returns_df = pd.read_excel("data/returns.xlsx")
            return product_id in returns_df["ProductID"].values
        except:
            return False
    
    def requires_human_review(self, action_type: str, data: Optional[Dict] = None) -> bool:
        """Determine if action requires human review"""
        if data is None and isinstance(action_type, dict):
            data = action_type
            action_type = "restock"
        elif data is None and isinstance(action_type, str):
            data = {"query": action_type}
            action_type = "chatbot_response"
        confidence = self.calculate_confidence(action_type, data or {})
        return confidence < self.confidence_threshold
    
    def submit_for_review(self, action_type: str, data: Optional[Dict] = None, agent_decision: Optional[str] = None) -> str:
        """Submit decision for human review"""
        if data is None and isinstance(action_type, str) and agent_decision is None:
            data = {"query": action_type}
            action_type = "chatbot_response"
            agent_decision = "Handle urgent customer query"
        elif data is None and isinstance(action_type, dict):
            data = action_type
            action_type = "restock"
            agent_decision = "Restock decision"

        review_id = f"{action_type}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        confidence = self.calculate_confidence(action_type, data or {})
        
        review_item = {
            "review_id": review_id,
            "timestamp": datetime.now().isoformat(),
            "action_type": action_type,
            "confidence": confidence,
            "data": data,
            "agent_decision": agent_decision or "Requires review",
            "status": "pending",
            "human_decision": None,
            "human_notes": None
        }
        
        # Ensure parent dir exists
        parent_dir = os.path.dirname(self.pending_reviews_file)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

        # Load existing pending reviews
        try:
            with open(self.pending_reviews_file, 'r', encoding='utf-8') as f:
                pending_reviews = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pending_reviews = []
        
        pending_reviews.append(review_item)
        
        # Save updated pending reviews
        with open(self.pending_reviews_file, 'w', encoding='utf-8') as f:
            json.dump(pending_reviews, f, indent=2)
        
        print(f"⚠️  Action submitted for human review (ID: {review_id}, Confidence: {confidence:.2f})")
        return review_id
    
    def get_pending_reviews(self) -> List[Dict]:
        """Get all pending reviews"""
        try:
            with open(self.pending_reviews_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def approve_decision(self, review_id: str, notes: str = "") -> bool:
        """Approve a pending decision"""
        return self._update_review_status(review_id, "approved", notes)
    
    def reject_decision(self, review_id: str, notes: str = "") -> bool:
        """Reject a pending decision"""
        return self._update_review_status(review_id, "rejected", notes)
    
    def _update_review_status(self, review_id: str, decision: str, notes: str) -> bool:
        """Update review status and log the decision"""
        pending_reviews = self.get_pending_reviews()
        
        for review in pending_reviews:
            if review["review_id"] == review_id:
                review["status"] = decision
                review["human_decision"] = decision
                review["human_notes"] = notes
                review["reviewed_at"] = datetime.now().isoformat()
                
                # Log the review
                self._log_review(review)
                
                # Remove from pending
                pending_reviews.remove(review)
                
                # Save updated pending reviews
                with open(self.pending_reviews_file, 'w', encoding='utf-8') as f:
                    json.dump(pending_reviews, f, indent=2)
                
                print(f"✅ Review {review_id} {decision}")
                return True
        
        print(f"❌ Review {review_id} not found")
        return False
    
    def _log_review(self, review: Dict):
        """Log completed review to CSV"""
        parent_dir = os.path.dirname(self.review_log_file)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

        log_entry = {
            "timestamp": review.get("reviewed_at", datetime.now().isoformat()),
            "review_id": review["review_id"],
            "action_type": review["action_type"],
            "confidence": review["confidence"],
            "agent_decision": review.get("agent_decision", ""),
            "human_decision": review["human_decision"],
            "notes": review.get("human_notes", "")
        }
        
        df = pd.DataFrame([log_entry])
        file_exists = os.path.exists(self.review_log_file)
        df.to_csv(self.review_log_file, mode='a' if file_exists else 'w', index=False, header=not file_exists)

# Global instance
review_system = HumanReviewSystem()
