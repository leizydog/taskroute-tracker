from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import user, task  # Import both models
from app.routers import auth, tasks, analytics, locations  # Import both routers


# Create database tables
user.Base.metadata.create_all(bind=engine)
task.Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="TaskRoute Tracker API",
    description="GPS-enabled task management with ML predictions",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(analytics.router)  # Add this line
app.include_router(locations.router)  # Add this line


# Root endpoint
@app.get("/")
def read_root():
    return {
        "message": "TaskRoute Tracker API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}