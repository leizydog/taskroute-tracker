from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # ✅ Import this
from pathlib import Path # ✅ Import this
from app.database import engine
from app.models import user, task, audit
from app.routers import auth, tasks, locations, analytics, users, predictions, admin, reports
from app.websocket_manager import manager
from dotenv import load_dotenv
import os

# -------------------------
# Load environment variables
# -------------------------
load_dotenv() 


# Setup Static Directory
STATIC_DIR = Path("static")
AVATAR_DIR = STATIC_DIR / "avatars"
SIGNATURES_DIR = STATIC_DIR / "signatures"  # ✅ Add this
PHOTOS_DIR = STATIC_DIR / "photos"          # ✅ Add this

AVATAR_DIR.mkdir(parents=True, exist_ok=True)
SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)     # ✅ Add this
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)         # ✅ Add this


# -------------------------
# Initialize predictors
# -------------------------
from app.services.task_duration_predictor import TaskDurationPredictor
from app.services.multi_destination_predictor import MultiDestinationPredictor

GOOGLE_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")
predictor = None
multi_predictor = None

if GOOGLE_API_KEY:
    predictor = TaskDurationPredictor(GOOGLE_API_KEY)
    try:
        models_loaded = predictor.load_models(model_dir='./app/ml_models')
        if models_loaded:
            print("✅ ML models loaded successfully for predictions")
            multi_predictor = MultiDestinationPredictor(predictor)
            print("✅ Multi-destination predictor initialized")
        else:
            print("⚠️  Warning: Could not load ML models")
            predictor = None
    except Exception as e:
        print(f"⚠️  Warning: Could not load ML models: {e}")
        predictor = None
else:
    print("⚠️  Warning: GOOGLE_DIRECTIONS_API_KEY not set")

# -------------------------
# Create database tables
# -------------------------
user.Base.metadata.create_all(bind=engine)
task.Base.metadata.create_all(bind=engine)
audit.Base.metadata.create_all(bind=engine)

# -------------------------
# FastAPI app initialization
# -------------------------
app = FastAPI(
    title="TaskRoute Tracker API",
    description="GPS-enabled task management with ML predictions",
    version="1.0.0"
)

# ✅ NEW: Setup Static Directory for Images
# This ensures a 'static/avatars' folder exists
STATIC_DIR = Path("static")
AVATAR_DIR = STATIC_DIR / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

# Mount the static directory to serve files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Configure CORS
# ✅ UPDATE YOUR CORS CONFIGURATION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://taskroute-tracker.vercel.app",  # <--- ADD THIS (Your Production URL)
    ],
    # This Regex allows all Vercel Preview URLs (e.g., taskroute-tracker-git-main...)
    allow_origin_regex=r"https://taskroute-tracker.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(locations.router, prefix="/api/v1/locations")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1") # Register it


# WebSocket endpoint
@app.websocket("/ws/location")
async def websocket_endpoint(websocket: WebSocket):
    print(f"🔌 WebSocket connection attempt from {websocket.client}")
    try:
        await manager.connect(websocket)
        print(f"✅ WebSocket connected successfully")
        while True:
            try:
                data = await websocket.receive_text()
                print(f"📨 Received from client: {data}")
                await websocket.send_json({"type": "ack", "message": "Server received your message"})
            except WebSocketDisconnect:
                print("🔌 Client disconnected normally")
                break
            except Exception as e:
                print(f"❌ Error receiving data: {e}")
                break
    except Exception as e:
        print(f"❌ WebSocket connection error: {e}")
    finally:
        manager.disconnect(websocket)
        print(f"🔌 WebSocket cleanup complete")

@app.get("/")
def read_root():
    return {"message": "TaskRoute Tracker API", "version": "1.0.0", "status": "running", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    print("🚀 FastAPI server starting...")
    print("📍 WebSocket endpoint available at: ws://localhost:8000/ws/location")
    
    # Add ARCHIVED to TaskStatus enum if it doesn't exist
    # This is needed because SQLAlchemy's create_all doesn't update existing enums
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Check if ARCHIVED already exists in the enum
            result = conn.execute(text(
                "SELECT 1 FROM pg_enum WHERE enumlabel = 'ARCHIVED' AND enumtypid = "
                "(SELECT oid FROM pg_type WHERE typname = 'taskstatus')"
            ))
            if result.fetchone() is None:
                # Add ARCHIVED to the enum
                conn.execute(text("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'ARCHIVED'"))
                conn.commit()
                print("✅ Added ARCHIVED status to taskstatus enum")
            else:
                print("✅ ARCHIVED status already exists in taskstatus enum")
    except Exception as e:
        print(f"⚠️ Could not update taskstatus enum: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    print("👋 FastAPI server shutting down...")