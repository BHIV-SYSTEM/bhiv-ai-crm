import sys
import os

# Reconfigure stdout to utf-8 to handle emojis in Windows terminal
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Add the current directory to the path so we can import api_app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn
    print("=" * 80)
    print("🚀 Starting FastAPI SETU Backend Server (Port 8001)...")
    print("=" * 80)
    uvicorn.run("api_app:app", host="0.0.0.0", port=8001, reload=True)
