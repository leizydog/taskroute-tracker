from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict

from app.database import get_db
from app.models.location import LocationLog
from app.models.task import Task
from app.models.user import User
from app.schemas.location import LocationLogCreate, LocationLogResponse
from app.core.auth import get_current_active_user
from app.websocket_manager import manager
from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/locations",
    tags=["Locations"]
)

@router.post("/", response_model=LocationLogResponse, status_code=status.HTTP_201_CREATED)
async def create_location_log(
    location_data: LocationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == location_data.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to log location for this task")

    # In the original code, `recorded_at` is part of LocationLogCreate but might be null.
    # The database model has a server_default for `recorded_at`. Let's ensure we handle both cases.
    # Pydantic's model_dump will handle the data correctly. We just need to make sure the user_id is set.
    db_location_log = LocationLog(**location_data.model_dump(), user_id=current_user.id)
    db.add(db_location_log)
    db.commit()
    db.refresh(db_location_log)

    await manager.broadcast_json({
        "event": "location_update",
        "task_id": location_data.task_id,
        "latitude": location_data.latitude,
        "longitude": location_data.longitude,
        "user_id": current_user.id,
        "user_name": current_user.full_name,
    })

    return db_location_log

@router.get("/{task_id}", response_model=List[LocationLogResponse])
def get_location_logs_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Order by `recorded_at` instead of `timestamp`
    logs = db.query(LocationLog).filter(LocationLog.task_id == task_id).order_by(LocationLog.recorded_at.asc()).all()
    return logs

@router.get("/{task_id}/latest", response_model=Optional[LocationLogResponse])
def get_latest_location_for_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # --- BUG FIX ---
    # The column is named `recorded_at` in the model, not `timestamp`.
    latest_log = db.query(LocationLog).filter(LocationLog.task_id == task_id).order_by(LocationLog.recorded_at.desc()).first()
    
    if not latest_log:
        # Explicitly return a 404 if no log is found. This is better practice
        # than returning null with a 200 OK, as it's more descriptive.
        raise HTTPException(status_code=404, detail="No location history found for this task yet.")

    return latest_log

# Add to your locations.py router:

from math import radians, cos, sin, asin, sqrt
from typing import List, Dict
from datetime import datetime, timedelta

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in kilometers"""
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    return R * c


@router.get("/employees/live", response_model=List[Dict])
async def get_live_employee_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get live locations of all active employees.
    Only includes employees who have reported their location in the last 15 minutes.
    """
    
    # Get all active employees
    employees = db.query(User).filter(User.is_active == True, User.role == 'user').all()
    
    live_locations = []
    cutoff_time = datetime.utcnow() - timedelta(minutes=15)
    
    for employee in employees:
        # Get most recent location log for this employee
        latest_location = db.query(LocationLog).filter(
            LocationLog.user_id == employee.id,
            LocationLog.recorded_at >= cutoff_time
        ).order_by(LocationLog.recorded_at.desc()).first()
        
        if latest_location:
            # Check if employee has an active task
            active_task = db.query(Task).filter(
                Task.assigned_to == employee.id,
                Task.status == TaskStatus.IN_PROGRESS
            ).first()
            
            live_locations.append({
                "user_id": employee.id,
                "employee_id": f"P{str(employee.id).zfill(3)}",  # P001, P002, etc.
                "full_name": employee.full_name,
                "email": employee.email,
                "latitude": latest_location.latitude,
                "longitude": latest_location.longitude,
                "accuracy": latest_location.accuracy,
                "last_update": latest_location.recorded_at.isoformat(),
                "has_active_task": active_task is not None,
                "active_task_id": active_task.id if active_task else None,
            })
    
    return live_locations


@router.post("/employees/nearest")
async def find_nearest_employee(
    location_data: Dict,  # {"latitude": 14.5995, "longitude": 120.9842}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Find the nearest available employee to a given location.
    
    Returns employees sorted by distance with their:
    - Current location
    - Distance to target
    - Availability status
    - Forecasted duration for the task
    """
    
    target_lat = location_data.get("latitude")
    target_lng = location_data.get("longitude")
    
    if not target_lat or not target_lng:
        raise HTTPException(status_code=400, detail="latitude and longitude required")
    
    # Get live employee locations
    cutoff_time = datetime.utcnow() - timedelta(minutes=15)
    employees = db.query(User).filter(User.is_active == True, User.role == 'user').all()
    
    nearest_employees = []
    
    for employee in employees:
        # Get latest location
        latest_location = db.query(LocationLog).filter(
            LocationLog.user_id == employee.id,
            LocationLog.recorded_at >= cutoff_time
        ).order_by(LocationLog.recorded_at.desc()).first()
        
        if not latest_location:
            continue  # Skip employees without recent location
        
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
        
        # Get task forecast if requested
        forecast = None
        if location_data.get("get_forecast", False):
            from app.core.forecasting import predict_duration
            
            forecast_data = {
                "Date": datetime.now().strftime("%Y-%m-%d"),
                "StartTime": datetime.now().isoformat(),
                "latitude": target_lat,
                "longitude": target_lng,
                "ParticipantID": f"P{str(employee.id).zfill(3)}",
            }
            
            forecast_result = predict_duration(forecast_data)
            if "error" not in forecast_result:
                forecast = {
                    "predicted_duration": forecast_result["predicted_duration_minutes"],
                    "confidence_lower": forecast_result["confidence_interval"]["lower_minutes"],
                    "confidence_upper": forecast_result["confidence_interval"]["upper_minutes"],
                }
        
        nearest_employees.append({
            "user_id": employee.id,
            "employee_id": f"P{str(employee.id).zfill(3)}",
            "full_name": employee.full_name,
            "email": employee.email,
            "current_latitude": latest_location.latitude,
            "current_longitude": latest_location.longitude,
            "distance_km": round(distance_km, 2),
            "distance_text": f"{distance_km:.1f} km" if distance_km >= 1 else f"{int(distance_km * 1000)} m",
            "last_location_update": latest_location.recorded_at.isoformat(),
            "is_available": active_task is None,
            "active_task_id": active_task.id if active_task else None,
            "forecast": forecast,
        })
    
    # Sort by distance
    nearest_employees.sort(key=lambda x: x["distance_km"])
    
    return {
        "target_location": {
            "latitude": target_lat,
            "longitude": target_lng,
        },
        "total_employees_found": len(nearest_employees),
        "employees": nearest_employees,
        "nearest_employee": nearest_employees[0] if nearest_employees else None,
    }
