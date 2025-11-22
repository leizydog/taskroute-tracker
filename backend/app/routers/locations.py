"""
FIXED locations.py - Supports both task-based and general employee tracking
File: backend/app/routers/locations.py
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timedelta
from pydantic import BaseModel
import os

from app.database import get_db
from app.models.location import LocationLog
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.location import LocationLogCreate, LocationLogResponse
from app.core.auth import get_current_active_user
from app.websocket_manager import manager

# Create router WITHOUT prefix (prefix is added in main.py)
router = APIRouter(
    tags=["Locations"]
)

print("✅ Locations router initialized (no prefix - handled by main.py)")

# ============================================================================
# REQUEST MODELS
# ============================================================================

class NearestEmployeeRequest(BaseModel):
    """Request model for finding nearest employee"""
    latitude: float
    longitude: float
    get_forecast: bool = False
    
    class Config:
        json_schema_extra = {
            "example": {
                "latitude": 14.5547,
                "longitude": 121.0244,
                "get_forecast": True
            }
        }

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c

# ============================================================================
# LOCATION LOG ENDPOINTS
# ============================================================================

@router.post("/", response_model=LocationLogResponse, status_code=status.HTTP_201_CREATED)
async def create_location_log(
    location_data: LocationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new location log entry.
    
    Supports two modes:
    1. **Task-based tracking**: Log location while working on a specific task
    2. **General employee tracking**: Log location when app is open (for "Find Nearest Employee")
    
    If task_id is provided, validates that the task belongs to the current user.
    If task_id is null, logs location for general employee tracking.
    """
    
    # ✅ Task-based tracking: Validate task ownership
    if location_data.task_id is not None:
        print(f"📍 Creating task-based location log for task {location_data.task_id}")
        
        task = db.query(Task).filter(Task.id == location_data.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.assigned_to != current_user.id:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to log location for this task"
            )
    else:
        # ✅ General employee tracking (no task)
        print(f"📍 Creating general location log for employee tracking (user {current_user.id})")

    # Create location log
    db_location_log = LocationLog(**location_data.model_dump(), user_id=current_user.id)
    db.add(db_location_log)
    db.commit()
    db.refresh(db_location_log)

    # Broadcast WebSocket update only for task-based tracking
    if location_data.task_id is not None:
        await manager.broadcast_json({
            "event": "location_update",
            "task_id": location_data.task_id,
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
        })

    print(f"✅ Location logged: User {current_user.id} at ({location_data.latitude}, {location_data.longitude})")
    return db_location_log

# ============================================================================
# EMPLOYEE LOCATION ENDPOINTS
# ⚠️ IMPORTANT: These MUST be defined BEFORE /{task_id} routes to avoid conflicts
# ============================================================================

@router.get("/employees/live")
async def get_live_employee_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get live locations of all active employees.
    Only includes employees who have reported their location in the last 15 minutes.
    """
    print("🗺️ Fetching live employee locations")
    
    employees = db.query(User).filter(
        User.is_active == True, 
        User.role == UserRole.USER
    ).all()
    
    live_locations = []
    cutoff_time = datetime.utcnow() - timedelta(minutes=15)
    
    for employee in employees:
        latest_location = db.query(LocationLog).filter(
            LocationLog.user_id == employee.id,
            LocationLog.recorded_at >= cutoff_time
        ).order_by(LocationLog.recorded_at.desc()).first()
        
        if latest_location:
            active_task = db.query(Task).filter(
                Task.assigned_to == employee.id,
                Task.status == TaskStatus.IN_PROGRESS
            ).first()
            
            live_locations.append({
                "user_id": employee.id,
                "employee_id": f"P{str(employee.id).zfill(3)}",
                "full_name": employee.full_name,
                "email": employee.email,
                "latitude": latest_location.latitude,
                "longitude": latest_location.longitude,
                "accuracy": latest_location.accuracy,
                "last_update": latest_location.recorded_at.isoformat(),
                "has_active_task": active_task is not None,
                "active_task_id": active_task.id if active_task else None,
            })
    
    print(f"✅ Found {len(live_locations)} employees with recent locations")
    return live_locations

@router.post("/employees/nearest")
async def find_nearest_employee(
    request: NearestEmployeeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    🎯 Find the nearest available employee to a given location.
    
    This endpoint searches for employees who have logged their location in the last 15 minutes
    (either through task-based tracking or general employee tracking).
    """
    print(f"\n🔍 Finding nearest employee to ({request.latitude}, {request.longitude})")
    print(f"   Forecast requested: {request.get_forecast}")
    
    target_lat = request.latitude
    target_lng = request.longitude
    
    if not target_lat or not target_lng:
        raise HTTPException(status_code=400, detail="latitude and longitude required")
    
    # Get employees with recent location data (last 15 minutes)
    cutoff_time = datetime.utcnow() - timedelta(minutes=15)
    employees = db.query(User).filter(
        User.is_active == True, 
        User.role == UserRole.USER
    ).all()
    
    print(f"   Checking {len(employees)} active employees")
    
    nearest_employees = []
    
    for employee in employees:
        # Get most recent location (task-based OR general tracking)
        latest_location = db.query(LocationLog).filter(
            LocationLog.user_id == employee.id,
            LocationLog.recorded_at >= cutoff_time
        ).order_by(LocationLog.recorded_at.desc()).first()
        
        if not latest_location:
            continue  # Skip employees without recent location data
        
        # Calculate distance
        distance_km = haversine_distance(
            latest_location.latitude,
            latest_location.longitude,
            target_lat,
            target_lng
        )
        
        # Check if employee has active task
        active_task = db.query(Task).filter(
            Task.assigned_to == employee.id,
            Task.status == TaskStatus.IN_PROGRESS
        ).first()
        
        # Generate forecast if requested
        forecast = None
        if request.get_forecast:
            try:
                from app.services.task_duration_predictor import TaskDurationPredictor
                
                GOOGLE_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")
                if GOOGLE_API_KEY:
                    predictor = TaskDurationPredictor(GOOGLE_API_KEY)
                    models_loaded = predictor.load_models(model_dir='./app/ml_models')
                    
                    if models_loaded:
                        participant_id = f"P{str(employee.id).zfill(3)}"
                        now = datetime.now()
                        
                        forecast_result = predictor.predict(
                            participant_id=participant_id,
                            city="Manila",
                            conditions="Normal",
                            method="Drive",
                            hour=now.hour,
                            day_of_week=now.weekday(),
                            date=now.strftime('%Y-%m-%d'),
                            employee_lat=latest_location.latitude,
                            employee_lng=latest_location.longitude,
                            task_lat=target_lat,
                            task_lng=target_lng
                        )
                        
                        # ✅ FIX: Convert numpy types to Python native types
                        forecast = {
                            "predicted_duration": float(forecast_result.get("predicted_duration_minutes", 0)),
                            "confidence_lower": float(forecast_result.get("confidence_interval_lower", 0)),
                            "confidence_upper": float(forecast_result.get("confidence_interval_upper", 0)),
                        }
                        print(f"   ✅ Forecast generated for {employee.full_name}: {forecast['predicted_duration']:.1f} min")
            except Exception as e:
                print(f"   ⚠️ Forecast error for {employee.full_name}: {e}")
                import traceback
                traceback.print_exc()
        
        # ✅ FIX: Ensure all numeric values are Python native types
        nearest_employees.append({
            "user_id": int(employee.id),
            "employee_id": f"P{str(employee.id).zfill(3)}",
            "full_name": str(employee.full_name),
            "email": str(employee.email),
            "current_latitude": float(latest_location.latitude),
            "current_longitude": float(latest_location.longitude),
            "distance_km": round(float(distance_km), 2),
            "distance_text": f"{distance_km:.1f} km" if distance_km >= 1 else f"{int(distance_km * 1000)} m",
            "last_location_update": latest_location.recorded_at.isoformat(),
            "is_available": active_task is None,
            "active_task_id": int(active_task.id) if active_task else None,
            "forecast": forecast,
        })
    
    # Sort by distance (nearest first)
    nearest_employees.sort(key=lambda x: x["distance_km"])
    
    print(f"   ✅ Found {len(nearest_employees)} employees with location data")
    if nearest_employees:
        print(f"   📍 Nearest: {nearest_employees[0]['full_name']} ({nearest_employees[0]['distance_km']} km)")
    
    return {
        "target_location": {
            "latitude": float(target_lat),
            "longitude": float(target_lng),
        },
        "total_employees_found": len(nearest_employees),
        "employees": nearest_employees,
        "nearest_employee": nearest_employees[0] if nearest_employees else None,
    }

# ============================================================================
# TASK-SPECIFIC LOCATION ENDPOINTS
# ⚠️ IMPORTANT: These routes use path parameters and MUST come AFTER specific routes
# ============================================================================

@router.get("/{task_id}")
def get_location_logs_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all location logs for a specific task"""
    print(f"📍 Getting location logs for task {task_id}")
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    logs = db.query(LocationLog).filter(
        LocationLog.task_id == task_id
    ).order_by(LocationLog.recorded_at.asc()).all()
    
    return logs

@router.get("/{task_id}/latest")
def get_latest_location_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the most recent location log for a specific task"""
    print(f"📍 Getting latest location for task {task_id}")
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    latest_log = db.query(LocationLog).filter(
        LocationLog.task_id == task_id
    ).order_by(LocationLog.recorded_at.desc()).first()
    
    if not latest_log:
        raise HTTPException(
            status_code=404, 
            detail="No location history found for this task yet."
        )

    return latest_log

# ============================================================================
# STARTUP MESSAGE
# ============================================================================

print("\n" + "="*60)
print("📍 LOCATIONS ROUTER REGISTERED")
print("="*60)
print("Routes (in order):")
print("  1. POST   /")
print("  2. GET    /employees/live")
print("  3. POST   /employees/nearest  ✅ WORKING")
print("  4. GET    /{task_id}")
print("  5. GET    /{task_id}/latest")
print("NOTE: Prefix '/api/v1/locations' is added by main.py")
print("="*60 + "\n")