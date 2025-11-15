# ============================================================================
# FASTAPI BACKEND - TASK DURATION PREDICTION ENDPOINT
# ============================================================================
# Add this to your existing FastAPI backend
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import os
from sqlalchemy.orm import Session

# Import your predictor class
from services.task_duration_predictor import TaskDurationPredictor
from core.database import get_db
from core.auth import get_current_user
from models.user import User

# Initialize router
router = APIRouter(prefix="/api/v1/predictions", tags=["predictions"])

# Initialize predictor (singleton)
GOOGLE_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")
predictor = TaskDurationPredictor(GOOGLE_API_KEY)

# Load models on startup
try:
    predictor.load_models(model_dir='./ml_models')
    print("✓ ML models loaded successfully")
except Exception as e:
    print(f"⚠️  Warning: Could not load ML models: {e}")
    predictor = None

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class TaskDurationRequest(BaseModel):
    """Request model for task duration prediction"""
    
    # Task details
    task_id: Optional[int] = Field(None, description="Existing task ID (optional)")
    city: str = Field(..., description="City where task is located")
    task_title: Optional[str] = Field(None, description="Task title")
    
    # Location
    employee_lat: float = Field(..., description="Employee's current latitude")
    employee_lng: float = Field(..., description="Employee's current longitude")
    task_lat: float = Field(..., description="Task destination latitude")
    task_lng: float = Field(..., description="Task destination longitude")
    
    # Context
    conditions: str = Field(
        default="Normal", 
        description="Current conditions: Normal, Heavy Traffic, Rain, Road Work, Rush Hour, Holiday"
    )
    method: str = Field(
        default="Drive",
        description="Transportation method: Drive, Walk, Bike, Public Transport"
    )
    
    # Timing (optional - defaults to current time)
    scheduled_hour: Optional[int] = Field(None, ge=0, le=23, description="Hour of task (0-23)")
    scheduled_day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Monday)")
    scheduled_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    
    class Config:
        schema_extra = {
            "example": {
                "city": "Makati",
                "employee_lat": 14.6531,
                "employee_lng": 121.0498,
                "task_lat": 14.5547,
                "task_lng": 121.0244,
                "conditions": "Heavy Traffic",
                "method": "Drive",
                "scheduled_hour": 18,
                "scheduled_day_of_week": 4,
                "scheduled_date": "2025-11-21"
            }
        }


class RouteDetails(BaseModel):
    """Google Directions route details"""
    start_address: str
    end_address: str
    duration_text: str
    polyline: str
    steps_count: int


class TaskDurationResponse(BaseModel):
    """Response model for task duration prediction"""
    
    # Overall prediction
    predicted_duration_minutes: float
    predicted_duration_hours: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    
    # Time breakdown
    travel_time_minutes: float
    work_time_minutes: float
    travel_percentage: float
    
    # Route information
    distance_km: float
    distance_category: str
    route_has_traffic_data: bool
    route_fallback: bool
    
    # Employee KPI
    employee_avg_duration: float
    employee_reliability: float
    employee_success_rate: float
    
    # Context
    condition_impact: str
    method: str
    prophet_baseline: float
    
    # Google route details (optional)
    google_route_details: Optional[RouteDetails]
    
    # Metadata
    prediction_timestamp: str
    model_version: str = "2.0-with-directions"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/predict-duration", response_model=TaskDurationResponse)
async def predict_task_duration(
    request: TaskDurationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Predict task duration based on employee location and route
    
    This endpoint:
    1. Gets real-time route data from Google Directions API
    2. Considers employee's historical performance (KPI)
    3. Accounts for current conditions (traffic, weather, etc.)
    4. Provides breakdown: Total Time = Travel Time + Work Time
    """
    
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Prediction service is not available. ML models not loaded."
        )
    
    try:
        # Use current time if not specified
        now = datetime.now()
        hour = request.scheduled_hour if request.scheduled_hour is not None else now.hour
        day_of_week = request.scheduled_day_of_week if request.scheduled_day_of_week is not None else now.weekday()
        date_str = request.scheduled_date if request.scheduled_date else now.strftime('%Y-%m-%d')
        
        # Make prediction
        prediction = predictor.predict(
            participant_id=f"P{current_user.id:03d}",  # Format: P001, P002, etc.
            city=request.city,
            conditions=request.conditions,
            method=request.method,
            hour=hour,
            day_of_week=day_of_week,
            date=date_str,
            employee_lat=request.employee_lat,
            employee_lng=request.employee_lng,
            task_lat=request.task_lat,
            task_lng=request.task_lng
        )
        
        # Convert Google route details to response model
        google_details = None
        if prediction.get('google_route_details'):
            grd = prediction['google_route_details']
            google_details = RouteDetails(
                start_address=grd['start_address'],
                end_address=grd['end_address'],
                duration_text=grd['duration_text'],
                polyline=grd['polyline'],
                steps_count=grd['steps_count']
            )
        
        # Build response
        response = TaskDurationResponse(
            predicted_duration_minutes=prediction['predicted_duration_minutes'],
            predicted_duration_hours=prediction['predicted_duration_hours'],
            confidence_interval_lower=prediction['confidence_interval_lower'],
            confidence_interval_upper=prediction['confidence_interval_upper'],
            travel_time_minutes=prediction['travel_time_minutes'],
            work_time_minutes=prediction['work_time_minutes'],
            travel_percentage=prediction['travel_percentage'],
            distance_km=prediction['distance_km'],
            distance_category=prediction['distance_category'],
            route_has_traffic_data=prediction['route_has_traffic_data'],
            route_fallback=prediction['route_fallback'],
            employee_avg_duration=prediction['employee_avg_duration'],
            employee_reliability=prediction['employee_reliability'],
            employee_success_rate=prediction['employee_success_rate'],
            condition_impact=prediction['condition_impact'],
            method=prediction['method'],
            prophet_baseline=prediction['prophet_baseline'],
            google_route_details=google_details,
            prediction_timestamp=datetime.now().isoformat()
        )
        
        # Optional: Log prediction to database for analytics
        # await log_prediction(db, current_user.id, request, response)
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/predict-multiple")
async def predict_multiple_tasks(
    requests: list[TaskDurationRequest],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Predict duration for multiple tasks at once
    Useful for task assignment optimization
    """
    
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Prediction service is not available"
        )
    
    if len(requests) > 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum 20 tasks per batch prediction"
        )
    
    predictions = []
    
    for req in requests:
        try:
            # Use current time if not specified
            now = datetime.now()
            hour = req.scheduled_hour if req.scheduled_hour is not None else now.hour
            day_of_week = req.scheduled_day_of_week if req.scheduled_day_of_week is not None else now.weekday()
            date_str = req.scheduled_date if req.scheduled_date else now.strftime('%Y-%m-%d')
            
            prediction = predictor.predict(
                participant_id=f"P{current_user.id:03d}",
                city=req.city,
                conditions=req.conditions,
                method=req.method,
                hour=hour,
                day_of_week=day_of_week,
                date=date_str,
                employee_lat=req.employee_lat,
                employee_lng=req.employee_lng,
                task_lat=req.task_lat,
                task_lng=req.task_lng
            )
            
            predictions.append({
                "task_id": req.task_id,
                "task_title": req.task_title,
                "prediction": prediction,
                "success": True
            })
            
        except Exception as e:
            predictions.append({
                "task_id": req.task_id,
                "task_title": req.task_title,
                "error": str(e),
                "success": False
            })
    
    return {
        "predictions": predictions,
        "total": len(requests),
        "successful": sum(1 for p in predictions if p['success']),
        "failed": sum(1 for p in predictions if not p['success'])
    }


@router.get("/available-conditions")
async def get_available_conditions():
    """Get list of available condition options"""
    return {
        "conditions": [
            "Normal",
            "Heavy Traffic",
            "Rain",
            "Road Work",
            "Rush Hour",
            "Holiday"
        ]
    }


@router.get("/available-methods")
async def get_available_methods():
    """Get list of available transportation methods"""
    return {
        "methods": [
            "Drive",
            "Walk",
            "Bike",
            "Public Transport"
        ]
    }


@router.get("/health")
async def check_prediction_service():
    """Check if prediction service is available"""
    return {
        "service": "prediction",
        "status": "healthy" if predictor is not None else "unavailable",
        "google_api_configured": GOOGLE_API_KEY is not None and len(GOOGLE_API_KEY) > 0,
        "models_loaded": predictor is not None
    }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def log_prediction(db: Session, user_id: int, request: TaskDurationRequest, response: TaskDurationResponse):
    """
    Optional: Log predictions to database for analytics and model improvement
    """
    # TODO: Implement if you want to track predictions
    pass


# ============================================================================
# ADD TO YOUR MAIN APP
# ============================================================================

"""
In your main.py or app.py, add:

from routers import prediction_router

app.include_router(prediction_router.router)
"""