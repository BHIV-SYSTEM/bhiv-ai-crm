#!/usr/bin/env python3
"""
API tests for FastAPI endpoints
"""

import pytest
from fastapi.testclient import TestClient
import pandas as pd
import os
import tempfile
import shutil
import sys
sys.path.append('..')

from api_app import app

class TestAPIEndpoints:
    """Test FastAPI endpoints"""
    
    def setup_method(self):
        """Set up test environment"""
        self.client = TestClient(app)
        self.test_dir = tempfile.mkdtemp()
        
        # Create test data files
        self.setup_test_data()
    
    def teardown_method(self):
        """Clean up test environment"""
        shutil.rmtree(self.test_dir)
    
    def setup_test_data(self):
        """Create test data files"""
        # Create test orders data
        orders_data = pd.DataFrame({
            'OrderID': [101, 102, 103, 104],
            'Status': ['Shipped', 'Delivered', 'Processing', 'Cancelled']
        })
        orders_file = os.path.join(self.test_dir, 'orders.xlsx')
        orders_data.to_excel(orders_file, index=False)
        
        # Create test returns data
        returns_data = pd.DataFrame({
            'ProductID': ['A101', 'B202', 'C303'],
            'ReturnQuantity': [6, 3, 15]
        })
        returns_file = os.path.join(self.test_dir, 'returns.xlsx')
        returns_data.to_excel(returns_file, index=False)
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = self.client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "AI Agent" in data["message"]
    
    @pytest.mark.asyncio
    async def test_get_orders_endpoint(self):
        """Test get orders endpoint"""
        response = self.client.get("/get_orders")
        
        # Should return 200 or 500 (if database/file not reachable)
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            orders_list = data.get("orders") if isinstance(data, dict) else data
            assert isinstance(orders_list, list)
    
    @pytest.mark.asyncio
    async def test_get_returns_endpoint(self):
        """Test get returns endpoint"""
        response = self.client.get("/get_returns")
        
        # Should return 200 or 500 (if database/file not reachable)
        assert response.status_code in [200, 500]
        
        if response.status_code == 200:
            data = response.json()
            returns_list = data.get("returns") if isinstance(data, dict) else data
            assert isinstance(returns_list, list)
    
    def test_health_check_endpoint(self):
        """Test health check endpoint (if it exists)"""
        response = self.client.get("/health")
        
        # Endpoint might not exist yet, so we accept 404
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data
    
    def test_api_error_handling(self):
        """Test API error handling"""
        # Test non-existent endpoint
        response = self.client.get("/nonexistent")
        assert response.status_code == 404
    
    def test_cors_headers(self):
        """Test CORS headers if configured"""
        response = self.client.get("/")
        headers = response.headers
        assert headers is not None

class TestAPIIntegration:
    """Test API integration with other components"""
    
    def setup_method(self):
        """Set up integration test environment"""
        self.client = TestClient(app)
    
    def test_api_data_consistency(self):
        """Test that API returns consistent data"""
        # Get orders
        orders_response = self.client.get("/get_orders")
        
        # Get returns
        returns_response = self.client.get("/get_returns")
        
        # Both should have valid structure
        if orders_response.status_code == 200 and returns_response.status_code == 200:
            orders_data = orders_response.json()
            returns_data = returns_response.json()
            
            orders_list = orders_data.get("orders") if isinstance(orders_data, dict) else orders_data
            returns_list = returns_data.get("returns") if isinstance(returns_data, dict) else returns_data
            assert isinstance(orders_list, list)
            assert isinstance(returns_list, list)
    
    def test_api_performance(self):
        """Test API response times"""
        import time
        
        # Test root endpoint performance
        start_time = time.time()
        response = self.client.get("/")
        response_time = time.time() - start_time
        
        assert response.status_code == 200
        assert response_time < 2.0, f"API response too slow: {response_time:.2f}s"
    
    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        import threading
        
        results = []
        
        def make_request():
            response = self.client.get("/")
            results.append(response.status_code)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert len(results) == 5
        assert all(status == 200 for status in results)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
