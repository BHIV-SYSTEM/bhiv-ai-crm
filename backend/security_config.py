#!/usr/bin/env python3
"""
Security Configuration for AI Agent Logistics
Centralized security settings and hardening configurations
"""

import os
from typing import Dict, List
from datetime import timedelta

class SecurityConfig:
    """Centralized security configuration"""
    
    # JWT Configuration
    JWT_PRIVATE_KEY = os.getenv("JWT_PRIVATE_KEY")
    JWT_PUBLIC_KEY = os.getenv("JWT_PUBLIC_KEY")
    JWT_ALGORITHM = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # Password Policy
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_REQUIRE_UPPERCASE = True
    PASSWORD_REQUIRE_LOWERCASE = True
    PASSWORD_REQUIRE_NUMBERS = True
    PASSWORD_REQUIRE_SPECIAL = True
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE = int(os.getenv("RATE_LIMIT_RPM", "60"))
    RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "10"))
    
    # CORS Configuration
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:8501",
        "https://yourdomain.com"
    ]
    
    # Security Headers
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' ws: wss:;"
        ),
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    }
    
    # Session Configuration
    SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", "60"))
    MAX_CONCURRENT_SESSIONS = int(os.getenv("MAX_CONCURRENT_SESSIONS", "5"))
    
    # API Security
    MAX_REQUEST_SIZE = int(os.getenv("MAX_REQUEST_SIZE", "10485760"))  # 10MB
    REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    
    # Database Security
    DB_CONNECTION_TIMEOUT = int(os.getenv("DB_CONNECTION_TIMEOUT", "30"))
    DB_MAX_CONNECTIONS = int(os.getenv("DB_MAX_CONNECTIONS", "20"))
    
    # Logging Configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_SENSITIVE_DATA = os.getenv("LOG_SENSITIVE_DATA", "false").lower() == "true"
    
    # Environment
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production"""
        return cls.ENVIRONMENT.lower() == "production"
    
    @classmethod
    def get_cors_origins(cls) -> List[str]:
        """Get CORS origins based on environment"""
        if cls.is_production():
            return [origin for origin in cls.ALLOWED_ORIGINS if not origin.startswith("http://localhost")]
        return cls.ALLOWED_ORIGINS
    
    @classmethod
    def validate_password(cls, password: str) -> Dict[str, bool]:
        """Validate password against security policy"""
        checks = {
            "min_length": len(password) >= cls.PASSWORD_MIN_LENGTH,
            "has_uppercase": any(c.isupper() for c in password) if cls.PASSWORD_REQUIRE_UPPERCASE else True,
            "has_lowercase": any(c.islower() for c in password) if cls.PASSWORD_REQUIRE_LOWERCASE else True,
            "has_numbers": any(c.isdigit() for c in password) if cls.PASSWORD_REQUIRE_NUMBERS else True,
            "has_special": any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password) if cls.PASSWORD_REQUIRE_SPECIAL else True
        }
        
        return {
            "valid": all(checks.values()),
            "checks": checks
        }

class SecurityHardening:
    """Security hardening utilities"""
    
    @staticmethod
    def sanitize_input(input_str: str) -> str:
        """Sanitize user input"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        # Remove potentially dangerous characters
        dangerous_chars = ["<", ">", "&", "\"", "'", ";", "(", ")", "{", "}", "[", "]"]
        sanitized = input_str
        
        for char in dangerous_chars:
            sanitized = sanitized.replace(char, "")
        
        return sanitized.strip()
    
    @staticmethod
    def mask_sensitive_data(data: str, mask_char: str = "*", visible_chars: int = 4) -> str:
        """Mask sensitive data for logging"""
        if not data or len(data) <= visible_chars:
            return mask_char * len(data) if data else ""
        
        return data[:visible_chars] + mask_char * (len(data) - visible_chars)
    
    @staticmethod
    def validate_file_upload(filename: str, max_size: int = 10485760) -> Dict[str, bool]:
        """Validate file upload security"""
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".pdf", ".txt", ".csv", ".xlsx"}
        dangerous_extensions = {".exe", ".bat", ".sh", ".ps1", ".php", ".jsp", ".asp"}
        
        file_ext = os.path.splitext(filename.lower())[1]
        
        return {
            "valid": (
                file_ext in allowed_extensions and 
                file_ext not in dangerous_extensions and
                len(filename) < 255
            ),
            "allowed_extension": file_ext in allowed_extensions,
            "safe_extension": file_ext not in dangerous_extensions,
            "valid_filename": len(filename) < 255
        }
    
    @staticmethod
    def generate_secure_headers() -> Dict[str, str]:
        """Generate secure HTTP headers"""
        return SecurityConfig.SECURITY_HEADERS.copy()

class AuditLogger:
    """Security audit logging"""
    
    @staticmethod
    def log_authentication_attempt(username: str, success: bool, ip_address: str = None):
        """Log authentication attempts"""
        status = "SUCCESS" if success else "FAILED"
        masked_username = SecurityHardening.mask_sensitive_data(username, visible_chars=2)
        
        print(f"🔒 AUTH {status}: User {masked_username} from {ip_address or 'unknown'}")
    
    @staticmethod
    def log_permission_check(username: str, permission: str, granted: bool):
        """Log permission checks"""
        status = "GRANTED" if granted else "DENIED"
        masked_username = SecurityHardening.mask_sensitive_data(username, visible_chars=2)
        
        print(f"🛡️  PERMISSION {status}: {masked_username} requested {permission}")
    
    @staticmethod
    def log_sensitive_operation(username: str, operation: str, resource: str = None):
        """Log sensitive operations"""
        masked_username = SecurityHardening.mask_sensitive_data(username, visible_chars=2)
        resource_info = f" on {resource}" if resource else ""
        
        print(f"⚠️  SENSITIVE OP: {masked_username} performed {operation}{resource_info}")
    
    @staticmethod
    def log_security_event(event_type: str, details: str, severity: str = "INFO"):
        """Log security events"""
        print(f"🚨 SECURITY {severity}: {event_type} - {details}")

# Environment-specific configurations
if SecurityConfig.is_production():
    # Production hardening
    SecurityConfig.DEBUG_MODE = False
    SecurityConfig.LOG_SENSITIVE_DATA = False
    SecurityConfig.ACCESS_TOKEN_EXPIRE_MINUTES = 15  # Shorter in production
    SecurityConfig.RATE_LIMIT_REQUESTS_PER_MINUTE = 30  # Stricter in production

# Export commonly used configurations
JWT_PRIVATE_KEY = SecurityConfig.JWT_PRIVATE_KEY
JWT_PUBLIC_KEY = SecurityConfig.JWT_PUBLIC_KEY
JWT_ALGORITHM = SecurityConfig.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = SecurityConfig.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = SecurityConfig.REFRESH_TOKEN_EXPIRE_DAYS

if __name__ == "__main__":
    print("🔒 Security Configuration Test")
    print("=" * 50)
    
    # Test password validation
    test_passwords = ["weak", "StrongPass123!", "NoNumbers!", "nonumbers123"]
    
    print("🔑 Password Validation Tests:")
    for password in test_passwords:
        result = SecurityConfig.validate_password(password)
        status = "✅ VALID" if result["valid"] else "❌ INVALID"
        print(f"   {password}: {status}")
        if not result["valid"]:
            failed_checks = [check for check, passed in result["checks"].items() if not passed]
            print(f"      Failed: {', '.join(failed_checks)}")
    
    # Test input sanitization
    print(f"\n🧹 Input Sanitization:")
    test_inputs = ["<script>alert('xss')</script>", "normal input", "user@domain.com"]
    for test_input in test_inputs:
        sanitized = SecurityHardening.sanitize_input(test_input)
        print(f"   '{test_input}' → '{sanitized}'")
    
    # Test data masking
    print(f"\n🎭 Data Masking:")
    sensitive_data = ["password123", "user@email.com", "1234567890"]
    for data in sensitive_data:
        masked = SecurityHardening.mask_sensitive_data(data)
        print(f"   '{data}' → '{masked}'")
    
    print(f"\n🌍 Environment: {SecurityConfig.ENVIRONMENT}")
    print(f"🔒 Production Mode: {SecurityConfig.is_production()}")
    print(f"🚀 Security configuration ready!")
