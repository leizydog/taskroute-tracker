"""
TaskRoute: Task Duration Predictions API Router (COMPLETE WITH MULTI-DESTINATION)
File: backend/app/routers/predictions.py
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import os
from sqlalchemy.orm import Session
import traceback

from app.services.task_duration_predictor import TaskDurationPredictor
from app.services.multi_destination_predictor import MultiDestinationPredictor
from app.database import get_db
from app.core.auth import get_current_user
from app.models.user import User


# ============================================================================
# INITIALIZE ROUTER AND PREDICTORS
# ============================================================================

router = APIRouter(prefix="/predictions", tags=["predictions"])

# Initialize predictors (singleton)
GOOGLE_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")
predictor = None
multi_predictor = None

if GOOGLE_API_KEY:
    predictor = TaskDurationPredictor(GOOGLE_API_KEY)
    # Load models on startup
    try:
        models_loaded = predictor.load_models(model_dir='./app/ml_models')
        if models_loaded:
            print("✅ ML models loaded successfully for predictions")
            # Initialize multi-destination predictor
            multi_predictor = MultiDestinationPredictor(predictor)
            print("✅ Multi-destination predictor initialized")
        else:
            print("⚠️  Warning: Could not load ML models")
            predictor = None
    except Exception as e:
        print(f"⚠️  Warning: Could not load ML models: {e}")
        traceback.print_exc()
        predictor = None
else:
    print("⚠️  Warning: GOOGLE_DIRECTIONS_API_KEY not set")


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class DestinationInput(BaseModel):
    """Single destination in a multi-stop route"""
    sequence: int = Field(..., description="Order in route (1, 2, 3...)")
    location_name: str = Field(..., description="Name of this stop")
    latitude: float = Field(..., description="Destination latitude")
    longitude: float = Field(..., description="Destination longitude")
    
    class Config:
        schema_extra = {
            "example": {
                "sequence": 1,
                "location_name": "Client Office A",
                "latitude": 14.5547,
                "longitude": 121.0244
            }
        }


class MultiDestinationRequest(BaseModel):
    """Request model for multi-destination task prediction"""
    
    # Employee location
    employee_lat: float = Field(..., description="Employee's current latitude")
    employee_lng: float = Field(..., description="Employee's current longitude")
    
    # Destinations (in order)
    destinations: List[DestinationInput] = Field(
        ..., 
        description="List of destinations in sequence order (minimum 2)",
        min_items=2
    )
    
    # Context
    city: str = Field(default="Manila", description="Primary city for the route")
    conditions: str = Field(
        default="Normal", 
        description="Current conditions: Normal, Heavy Traffic, Rain, Road Work, Rush Hour, Holiday"
    )
    method: str = Field(
        default="Drive",
        description="Transportation method: Drive, Walk, Bike, Public Transport"
    )
    
    # Timing (optional - defaults to current time)
    scheduled_hour: Optional[int] = Field(None, ge=0, le=23, description="Hour of task start (0-23)")
    scheduled_day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Monday)")
    scheduled_date: Optional[str] = Field(None, description="Date in YYYY-MM-DD format")
    
    # Route optimization
    optimize_order: bool = Field(
        default=False, 
        description="If true, API will suggest optimal stop order"
    )
    
    class Config:
        schema_extra = {
            "example": {
                "employee_lat": 14.5657,
                "employee_lng": 121.0346,
                "destinations": [
                    {
                        "sequence": 1,
                        "location_name": "Ayala Center",
                        "latitude": 14.5547,
                        "longitude": 121.0244
                    },
                    {
                        "sequence": 2,
                        "location_name": "BGC",
                        "latitude": 14.5176,
                        "longitude": 121.0509
                    },
                    {
                        "sequence": 3,
                        "location_name": "Ortigas Center",
                        "latitude": 14.5818,
                        "longitude": 121.0611
                    }
                ],
                "city": "Makati",
                "conditions": "Heavy Traffic",
                "method": "Drive",
                "scheduled_hour": 14,
                "optimize_order": True
            }
        }


class TaskDurationRequest(BaseModel):
    """Request model for single-destination task duration prediction"""
    
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


class LegDetail(BaseModel):
    """Details for one leg of a multi-destination route"""
    leg_number: int
    from_location: str
    to_location: str
    distance_km: float
    travel_time_minutes: float
    departure_time: str
    arrival_time: str
    has_traffic_data: bool


class MultiDestinationResponse(BaseModel):
    """Response model for multi-destination prediction"""
    
    # Overall summary
    predicted_duration_minutes: float
    predicted_duration_hours: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    
    # Time breakdown
    total_travel_time_minutes: float
    total_work_time_minutes: float
    travel_percentage: float
    
    # Route information
    total_distance_km: float
    number_of_stops: int
    number_of_legs: int
    
    # Employee KPI
    employee_reliability: float
    employee_success_rate: float
    
    # Timing
    estimated_start_time: str
    estimated_completion_time: str
    
    # Detailed breakdown
    legs: List[LegDetail]
    
    # Context
    condition_impact: str
    method: str
    city: str
    
    # Metadata
    is_multi_destination: bool
    prediction_timestamp: str


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/predict-multi-destination", response_model=MultiDestinationResponse)
async def predict_multi_destination_duration(
    request: MultiDestinationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    🗺️ Predict duration for multi-destination tasks
    
    This endpoint:
    1. Calculates route for multiple stops in sequence
    2. Gets travel time between each stop using Google Directions API
    3. Estimates work time at each location
    4. Provides detailed breakdown by leg
    5. Optionally optimizes stop order to minimize total duration
    """
    
    if multi_predictor is None or predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Multi-destination prediction service is not available. ML models not loaded."
        )
    
    try:
        # Validate inputs
        print(f"\n🗺️ Multi-destination prediction request from user {current_user.id}")
        print(f"   Employee location: ({request.employee_lat}, {request.employee_lng})")
        print(f"   Destinations: {len(request.destinations)}")
        
        # Use current time if not specified
        now = datetime.now()
        hour = request.scheduled_hour if request.scheduled_hour is not None else now.hour
        day_of_week = request.scheduled_day_of_week if request.scheduled_day_of_week is not None else now.weekday()
        date_str = request.scheduled_date if request.scheduled_date else now.strftime('%Y-%m-%d')
        
        # Format participant ID
        participant_id = f"P{current_user.id:03d}"
        print(f"   ParticipantID: {participant_id}")
        
        # Convert destinations to dict format
        destinations = [
            {
                'sequence': dest.sequence,
                'location_name': dest.location_name,
                'latitude': dest.latitude,
                'longitude': dest.longitude
            }
            for dest in request.destinations
        ]
        
        # Validate coordinates
        for i, dest in enumerate(destinations):
            if not (-90 <= dest['latitude'] <= 90) or not (-180 <= dest['longitude'] <= 180):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid coordinates for destination {i+1}: ({dest['latitude']}, {dest['longitude']})"
                )
        
        # Check if route optimization is requested
        if request.optimize_order:
            print("   🔄 Route optimization requested")
            # Get optimization analysis
            optimization_result = multi_predictor.optimize_route_order(
                participant_id=participant_id,
                destinations=destinations,
                employee_lat=request.employee_lat,
                employee_lng=request.employee_lng,
                city=request.city,
                conditions=request.conditions,
                method=request.method,
                start_hour=hour,
                start_day_of_week=day_of_week,
                start_date=date_str
            )
            
            if optimization_result.get('should_use_optimized'):
                # Use optimized order
                prediction = optimization_result['optimized_prediction']
                prediction['optimization_applied'] = True
                prediction['time_saved_minutes'] = optimization_result['time_saved_minutes']
                prediction['improvement_percentage'] = optimization_result['improvement_percentage']
                print(f"   ✅ Using optimized route (saves {optimization_result['time_saved_minutes']:.1f} min)")
            else:
                # Use original order
                prediction = multi_predictor.predict_multi_destination(
                    participant_id=participant_id,
                    destinations=destinations,
                    employee_lat=request.employee_lat,
                    employee_lng=request.employee_lng,
                    city=request.city,
                    conditions=request.conditions,
                    method=request.method,
                    start_hour=hour,
                    start_day_of_week=day_of_week,
                    start_date=date_str
                )
                prediction['optimization_applied'] = False
                print("   ℹ️ Original order used (optimization not beneficial)")
        else:
            # Standard prediction without optimization
            print("   📍 Using original destination order")
            prediction = multi_predictor.predict_multi_destination(
                participant_id=participant_id,
                destinations=destinations,
                employee_lat=request.employee_lat,
                employee_lng=request.employee_lng,
                city=request.city,
                conditions=request.conditions,
                method=request.method,
                start_hour=hour,
                start_day_of_week=day_of_week,
                start_date=date_str
            )
        
        # Convert legs to response models
        legs_response = [
            LegDetail(
                leg_number=leg['leg_number'],
                from_location=leg['from_location'],
                to_location=leg['to_location'],
                distance_km=leg['distance_km'],
                travel_time_minutes=leg['travel_time_minutes'],
                departure_time=leg['departure_time'],
                arrival_time=leg['arrival_time'],
                has_traffic_data=leg['has_traffic_data']
            )
            for leg in prediction['legs']
        ]
        
        # Build response
        response = MultiDestinationResponse(
            predicted_duration_minutes=prediction['predicted_duration_minutes'],
            predicted_duration_hours=prediction['predicted_duration_hours'],
            confidence_interval_lower=prediction['confidence_interval_lower'],
            confidence_interval_upper=prediction['confidence_interval_upper'],
            total_travel_time_minutes=prediction['total_travel_time_minutes'],
            total_work_time_minutes=prediction['total_work_time_minutes'],
            travel_percentage=prediction['travel_percentage'],
            total_distance_km=prediction['total_distance_km'],
            number_of_stops=prediction['number_of_stops'],
            number_of_legs=prediction['number_of_legs'],
            employee_reliability=prediction['employee_reliability'],
            employee_success_rate=prediction['employee_success_rate'],
            estimated_start_time=prediction['estimated_start_time'],
            estimated_completion_time=prediction['estimated_completion_time'],
            legs=legs_response,
            condition_impact=prediction['condition_impact'],
            method=prediction['method'],
            city=prediction['city'],
            is_multi_destination=prediction['is_multi_destination'],
            prediction_timestamp=prediction['prediction_timestamp']
        )
        
        print(f"   ✅ Prediction complete: {prediction['predicted_duration_minutes']:.1f} min")
        return response
        
    except HTTPException:
        raise
    except ValueError as ve:
        print(f"❌ Validation error: {ve}")
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail=str(ve)
        )
    except Exception as e:
        print(f"❌ Multi-destination prediction error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Multi-destination prediction failed: {str(e)}"
        )


@router.post("/predict-duration")
async def predict_task_duration(
    request: TaskDurationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    🎯 Predict task duration for single destination
    
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
        print(f"\n🎯 Single-destination prediction request from user {current_user.id}")
        print(f"   Employee: ({request.employee_lat}, {request.employee_lng})")
        print(f"   Task: ({request.task_lat}, {request.task_lng})")
        
        # Use current time if not specified
        now = datetime.now()
        hour = request.scheduled_hour if request.scheduled_hour is not None else now.hour
        day_of_week = request.scheduled_day_of_week if request.scheduled_day_of_week is not None else now.weekday()
        date_str = request.scheduled_date if request.scheduled_date else now.strftime('%Y-%m-%d')
        
        # Format participant ID
        participant_id = f"P{current_user.id:03d}"
        print(f"   ParticipantID: {participant_id}")
        
        # Make prediction
        prediction = predictor.predict(
            participant_id=participant_id,
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
        
        print(f"   ✅ Prediction complete: {prediction['predicted_duration_minutes']:.1f} min")
        
        return {
            "status": "success",
            "prediction": prediction,
            "metadata": {
                "participant_id": participant_id,
                "prediction_time": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@router.get("/health")
async def check_prediction_service():
    """Check if prediction service is available"""
    return {
        "service": "prediction",
        "status": "healthy" if predictor is not None else "unavailable",
        "google_api_configured": GOOGLE_API_KEY is not None and len(GOOGLE_API_KEY) > 0,
        "models_loaded": predictor is not None,
        "multi_destination_available": multi_predictor is not None
    }