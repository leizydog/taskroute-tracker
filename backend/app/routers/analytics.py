# Updated: backend/app/routers/analytics.py
# âœ… MIGRATED TO USE task_duration_predictor.py

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from pydantic import BaseModel
import pandas as pd
import os
import numpy as np


from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.core.auth import get_current_active_user

# âœ… NEW: Import the Google Directions-based predictor
from app.services.task_duration_predictor import TaskDurationPredictor
from dotenv import load_dotenv


router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])

# ============================================================================
# INITIALIZE PREDICTOR (SINGLETON)
# ============================================================================
load_dotenv("/app/.env")  
GOOGLE_API_KEY = os.getenv("GOOGLE_DIRECTIONS_API_KEY")
predictor = None

if GOOGLE_API_KEY:
    predictor = TaskDurationPredictor(GOOGLE_API_KEY)
    try:
        models_loaded = predictor.load_models(model_dir='./app/ml_models')
        if models_loaded:
            print("âœ… ML models loaded successfully for analytics")
        else:
            print("âš ï¸  Warning: Could not load ML models")
            predictor = None
    except Exception as e:
        print(f"âš ï¸  Warning: Could not load ML models: {e}")
        predictor = None
else:
    print("âš ï¸  Warning: GOOGLE_DIRECTIONS_API_KEY not set")


# Add this helper somewhere at the top of analytics.py
def np_to_python(obj):
    """Recursively convert NumPy types to native Python types for JSON serialization"""
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, dict):
        return {k: np_to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [np_to_python(i) for i in obj]
    return obj

def make_aware(dt):
    """Convert naive datetime to UTC timezone-aware datetime"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        # Naive datetime - assume it's UTC
        from datetime import timezone
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ============================================================================
# FORECASTING SCHEMAS
# ============================================================================

class TaskForecastInput(BaseModel):
    """Input schema for task duration forecasting with Google Directions"""
    
    # Required fields
    employee_lat: float
    employee_lng: float
    task_lat: float
    task_lng: float
    
    # Context (with smart defaults)
    city: Optional[str] = "Manila"
    conditions: Optional[str] = "Normal"
    method: Optional[str] = "Drive"
    
    # Timing (defaults to current time if not provided)
    scheduled_hour: Optional[int] = None
    scheduled_day_of_week: Optional[int] = None
    scheduled_date: Optional[str] = None
    
    # Employee ID (optional - uses current user if not provided)
    ParticipantID: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "employee_lat": 14.5657,
                "employee_lng": 121.0346,
                "task_lat": 14.5547,
                "task_lng": 121.0244,
                "city": "Makati",
                "conditions": "Heavy Traffic",
                "method": "Drive",
                "scheduled_hour": 18
            }
        }


class EmployeeComparisonInput(BaseModel):
    """Compare forecast for multiple employees"""
    
    # Location
    employee_lat: float
    employee_lng: float
    task_lat: float
    task_lng: float
    
    # Context
    city: str = "Manila"
    conditions: str = "Normal"
    method: str = "Drive"
    
    # Timing
    scheduled_hour: Optional[int] = None
    scheduled_day_of_week: Optional[int] = None
    scheduled_date: Optional[str] = None
    
    # Employees to compare
    employee_ids: List[str]


# ============================================================================
# FORECASTING ENDPOINTS
# ============================================================================

@router.post("/forecast")
async def get_task_forecast(
    input_data: TaskForecastInput,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    ðŸŽ¯ Main forecasting endpoint - predicts task duration using Google Directions API.
    
    Returns:
    - Total predicted duration
    - Travel time breakdown
    - Work time estimate
    - Route details
    - Employee KPI context
    """
    
    if predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction service is not available. ML models not loaded."
        )
    
    try:
        # Use current time if not specified
        now = datetime.now()
        hour = input_data.scheduled_hour if input_data.scheduled_hour is not None else now.hour
        day_of_week = input_data.scheduled_day_of_week if input_data.scheduled_day_of_week is not None else now.weekday()
        date_str = input_data.scheduled_date if input_data.scheduled_date else now.strftime('%Y-%m-%d')
        
        # Format participant ID
        participant_id = input_data.ParticipantID or f"P{current_user.id:03d}"
        
        # Make prediction
        prediction = predictor.predict(
            participant_id=participant_id,
            city=input_data.city,
            conditions=input_data.conditions,
            method=input_data.method,
            hour=hour,
            day_of_week=day_of_week,
            date=date_str,
            employee_lat=input_data.employee_lat,
            employee_lng=input_data.employee_lng,
            task_lat=input_data.task_lat,
            task_lng=input_data.task_lng
        )
        
        return np_to_python({
            "status": "success",
            "prediction": prediction,
            "metadata": {
                "participant_id": participant_id,
                "prediction_time": datetime.now().isoformat(),
                "uses_google_directions": True
            }
        })

        
    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/forecast/compare-employees")
async def compare_employee_forecasts(
    input_data: EmployeeComparisonInput,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    ðŸ” Compare multiple employees for the same task.
    
    Returns forecasts sorted by predicted duration (fastest first).
    Useful for supervisors to choose the best employee for a task.
    """
    
    # Permission check
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and admins can compare employee forecasts"
        )
    
    if predictor is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction service is not available"
        )
    
    try:
        # Use current time if not specified
        now = datetime.now()
        hour = input_data.scheduled_hour if input_data.scheduled_hour is not None else now.hour
        day_of_week = input_data.scheduled_day_of_week if input_data.scheduled_day_of_week is not None else now.weekday()
        date_str = input_data.scheduled_date if input_data.scheduled_date else now.strftime('%Y-%m-%d')
        
        forecasts = []
        
        for emp_id in input_data.employee_ids:
            try:
                prediction = predictor.predict(
                    participant_id=emp_id,
                    city=input_data.city,
                    conditions=input_data.conditions,
                    method=input_data.method,
                    hour=hour,
                    day_of_week=day_of_week,
                    date=date_str,
                    employee_lat=input_data.employee_lat,
                    employee_lng=input_data.employee_lng,
                    task_lat=input_data.task_lat,
                    task_lng=input_data.task_lng
                )
                
                forecasts.append({
                    "employee_id": emp_id,
                    "predicted_duration_minutes": prediction['predicted_duration_minutes'],
                    "travel_time_minutes": prediction['travel_time_minutes'],
                    "work_time_minutes": prediction['work_time_minutes'],
                    "confidence_interval_lower": prediction['confidence_interval_lower'],
                    "confidence_interval_upper": prediction['confidence_interval_upper'],
                    "employee_kpi": {
                        "avg_duration": prediction['employee_avg_duration'],
                        "reliability": prediction['employee_reliability'],
                        "success_rate": prediction['employee_success_rate']
                    }
                })
                
            except Exception as e:
                print(f"Error predicting for employee {emp_id}: {e}")
                continue
        
        if not forecasts:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not generate forecasts for any employee"
            )
        
        # Sort by predicted duration (fastest first)
        forecasts.sort(key=lambda x: x['predicted_duration_minutes'])
        
        return {
            "task_details": {
                "city": input_data.city,
                "conditions": input_data.conditions,
                "method": input_data.method,
                "distance_km": forecasts[0].get('distance_km', 'N/A') if forecasts else 'N/A'
            },
            "employee_count": len(forecasts),
            "forecasts": forecasts,
            "fastest_employee": forecasts[0]["employee_id"],
            "slowest_employee": forecasts[-1]["employee_id"],
            "time_difference_minutes": forecasts[-1]["predicted_duration_minutes"] - forecasts[0]["predicted_duration_minutes"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Comparison error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {str(e)}"
        )


@router.get("/forecast/model-status")
async def get_model_status():
    """
    ðŸ“Š Check if forecasting model is loaded and ready.
    
    Returns model metadata and health status.
    """
    if predictor is None:
        return {
            "status": "error",
            "loaded": False,
            "google_api_configured": GOOGLE_API_KEY is not None,
            "message": "Forecasting model not loaded"
        }
    
    return {
        "status": "ready",
        "loaded": True,
        "model_type": "XGBoost + Google Directions API",
        "features": predictor.selected_features if predictor.selected_features else [],
        "feature_count": len(predictor.selected_features) if predictor.selected_features else 0,
        "google_api_configured": GOOGLE_API_KEY is not None,
        "has_employee_stats": predictor.employee_stats is not None,
        "has_city_stats": predictor.city_stats is not None
    }


@router.get("/feature-importance")
async def get_feature_importance():
    """
    ðŸ“ˆ Returns the top 15 features affecting task duration prediction.
    
    Helps understand what factors most influence task completion time.
    """
    if predictor is None or predictor.xgb_model is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Forecasting model not loaded."
        )

    try:
        # Get importance scores from the loaded XGBoost model
        importance_scores = predictor.xgb_model.feature_importances_
        feature_names = predictor.selected_features

        # Create a DataFrame and sort
        importance_df = pd.DataFrame({
            'feature': feature_names,
            'importance': importance_scores
        }).sort_values(by='importance', ascending=False)

        # Get the top 15
        top_features = importance_df.head(15).to_dict(orient='records')

        return {
            "top_features": top_features,
            "total_features": len(feature_names),
            "model_type": "XGBoost with Google Directions"
        }
    except Exception as e:
        print(f"Error getting feature importance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate feature importance."
        )


# ============================================================================
# KPI ANALYTICS ENDPOINTS (UNCHANGED)
# ============================================================================

@router.get("/kpi/overview")
def get_kpi_overview(
    user_id: Optional[int] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    ðŸ“Š Get comprehensive KPI overview for performance assessment.
    
    Includes:
    - Task completion metrics
    - Quality ratings
    - Efficiency scores
    - Location compliance
    - Productivity trends
    """
    
    target_user_id = user_id if user_id else current_user.id
    
    # Permission check
    if target_user_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own KPI data"
        )
    
    # Date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get tasks in date range
    tasks = db.query(Task).filter(
        and_(
            Task.assigned_to == target_user_id,
            Task.created_at >= start_date,
            Task.created_at <= end_date
        )
    ).all()
    
    if not tasks:
        return {
            "user_id": target_user_id,
            "period_days": days,
            "task_metrics": {
                "total_tasks": 0,
                "completed_tasks": 0,
                "completion_rate": 0.0,
                "average_completion_time_minutes": None,
                "on_time_completion_rate": 0.0
            },
            "quality_metrics": {
                "average_quality_rating": None,
                "tasks_with_ratings": 0,
                "quality_distribution": {}
            },
            "efficiency_metrics": {
                "average_time_variance_percent": None,
                "efficiency_score": None,
                "productivity_trend": []
            },
            "location_metrics": {
                "tasks_with_location": 0,
                "location_compliance_rate": 0.0,
                "distance_traveled_km": 0.0
            }
        }
    
    # Task Metrics
    total_tasks = len(tasks)
    completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
    completion_rate = (len(completed_tasks) / total_tasks * 100) if total_tasks > 0 else 0.0
    
    # Average completion time
    completion_times = [t.actual_duration for t in completed_tasks if t.actual_duration is not None]
    avg_completion_time = (sum(completion_times) / len(completion_times)) if completion_times else None
    avg_completion_time_minutes = (avg_completion_time / 60) if avg_completion_time is not None else None
    
    # On-time completion rate
    on_time_tasks = [
        t for t in completed_tasks 
        if t.due_date and t.completed_at and t.completed_at <= t.due_date
    ]
    on_time_rate = (len(on_time_tasks) / len(completed_tasks) * 100) if completed_tasks else 0.0
    
    # Quality Metrics
    rated_tasks = [t for t in completed_tasks if t.quality_rating is not None]
    avg_quality = (sum(t.quality_rating for t in rated_tasks) / len(rated_tasks)) if rated_tasks else None
    
    quality_distribution = {}
    for rating in range(1, 6):
        count = len([t for t in rated_tasks if t.quality_rating == rating])
        quality_distribution[f"{rating}_star"] = count
    
    # Efficiency Metrics
    time_variances = []
    for task in completed_tasks:
        if task.estimated_duration and task.actual_duration and task.estimated_duration > 0:
            variance = ((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
            time_variances.append(variance)
    
    avg_time_variance = (sum(time_variances) / len(time_variances)) if time_variances else None
    
    # Calculate efficiency score (0-100, higher is better)
    efficiency_score = None
    if avg_time_variance is not None:
        efficiency_score = max(0, min(100, 100 - abs(avg_time_variance)))
    
    # Productivity trend (tasks completed per week)
    productivity_trend = []
    num_weeks = min(4, (days + 6) // 7)
    for week_num in range(num_weeks):
        week_end = end_date - timedelta(weeks=week_num)
        week_start = end_date - timedelta(weeks=week_num + 1)
        
        week_completed_count = len([
            t for t in completed_tasks 
            if t.completed_at and week_start < t.completed_at <= week_end
        ])
        
        productivity_trend.append({
            "week_label": f"{week_num+1} Week(s) Ago" if week_num > 0 else "This Past Week",
            "start_date": week_start.strftime('%Y-%m-%d'),
            "end_date": week_end.strftime('%Y-%m-%d'),
            "completed_tasks": week_completed_count
        })
    
    productivity_trend.reverse()
    
    # Location Metrics
    tasks_with_location = len([t for t in tasks if t.latitude is not None and t.longitude is not None])
    location_compliance_rate = (tasks_with_location / total_tasks * 100) if total_tasks > 0 else 0.0
    distance_traveled_km = 0.0  # Placeholder
    
    return {
        "user_id": target_user_id,
        "period_days": days,
        "task_metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_completion_time_seconds": avg_completion_time,
            "average_completion_time_minutes": round(avg_completion_time_minutes, 1) if avg_completion_time_minutes is not None else None,
            "on_time_completion_rate": round(on_time_rate, 1)
        },
        "quality_metrics": {
            "average_quality_rating": round(avg_quality, 2) if avg_quality is not None else None,
            "tasks_with_ratings": len(rated_tasks),
            "quality_distribution": quality_distribution
        },
        "efficiency_metrics": {
            "average_time_variance_percent": round(avg_time_variance, 1) if avg_time_variance is not None else None,
            "efficiency_score": round(efficiency_score, 1) if efficiency_score is not None else None,
            "productivity_trend": productivity_trend
        },
        "location_metrics": {
            "tasks_with_location": tasks_with_location,
            "location_compliance_rate": round(location_compliance_rate, 1),
            "distance_traveled_km": distance_traveled_km
        }
    }


@router.get("/team/overview")
def get_team_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    ðŸ‘¥ Get team performance overview (managers, supervisors, and admins only).
    
    Shows performance metrics for all team members.
    """
    
    # Permission check
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and admins can view team analytics"
        )
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get active team members
    team_users = db.query(User).filter(User.is_active == True).all()
    
    if not team_users:
        return {
            "period_days": days,
            "team_size": 0,
            "employees": [],
            "summary": {}
        }

    team_analytics = []
    
    for user in team_users:
        user_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == user.id,
                Task.created_at >= start_date,
                Task.created_at <= end_date
            )
        ).all()
        
        if not user_tasks:
            team_analytics.append({
                "id": user.id,
                "employee_id": user.id,
                "user_id": user.id,
                "employee_name": user.full_name or user.username,
                "user_name": user.full_name or user.username,
                "role": user.role.value,
                "total_tasks": 0,
                "completed_tasks": 0,
                "completion_rate": 0.0,
                "average_quality_rating": None,
                "average_quality": None,
                "efficiency_score": None,
                "last_activity": None
            })
            continue
        
        total_user_tasks = len(user_tasks)
        completed_tasks = [t for t in user_tasks if t.status == TaskStatus.COMPLETED]
        completion_rate = (len(completed_tasks) / total_user_tasks * 100) if total_user_tasks > 0 else 0
        
        rated_tasks = [t for t in completed_tasks if t.quality_rating is not None]
        avg_quality = (sum(t.quality_rating for t in rated_tasks) / len(rated_tasks)) if rated_tasks else None
        
        time_variances = []
        for task in completed_tasks:
            if task.estimated_duration and task.actual_duration and task.estimated_duration > 0:
                variance = abs((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
                time_variances.append(variance)
        
        avg_abs_variance = (sum(time_variances) / len(time_variances)) if time_variances else None
        efficiency_score = (max(0, 100 - avg_abs_variance)) if avg_abs_variance is not None else None
        
        # Last activity timestamp
        last_activity_ts = None
        update_times = [t.updated_at for t in user_tasks if t.updated_at]
        create_times = [t.created_at for t in user_tasks if t.created_at]
        all_times = update_times + create_times
        if all_times:
            last_activity_ts = max(all_times)

        team_analytics.append({
            "id": user.id,
            "employee_id": user.id,
            "user_id": user.id,
            "employee_name": user.full_name or user.username,
            "user_name": user.full_name or user.username,
            "role": user.role.value,
            "total_tasks": total_user_tasks,
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_quality_rating": round(avg_quality, 2) if avg_quality is not None else None,
            "average_quality": round(avg_quality, 2) if avg_quality is not None else None,
            "efficiency_score": round(efficiency_score, 1) if efficiency_score is not None else None,
            "last_activity": last_activity_ts
        })
    
    # Sort by efficiency score
    team_analytics.sort(key=lambda x: x["efficiency_score"] if x["efficiency_score"] is not None else -1, reverse=True)
    
    # Team summary
    total_team_tasks_assigned = sum(m["total_tasks"] for m in team_analytics)
    total_team_tasks_completed = sum(m["completed_tasks"] for m in team_analytics)
    overall_team_completion_rate = (total_team_tasks_completed / total_team_tasks_assigned * 100) if total_team_tasks_assigned > 0 else 0
    top_performer_name = team_analytics[0]["user_name"] if team_analytics else None
    
    return {
        "period_days": days,
        "team_size": len(team_analytics),
        "employees": team_analytics,
        "summary": {
            "total_team_tasks": total_team_tasks_assigned,
            "total_completed": total_team_tasks_completed,
            "team_completion_rate": round(overall_team_completion_rate, 1),
            "top_performer": top_performer_name
        }
    }

# Add this endpoint to analytics.py

# Fixed section of analytics.py - Replace the get_employee_kpis function

@router.get("/employees/{employee_id}/kpis")
def get_employee_kpis(
    employee_id: int,
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    📊 Get comprehensive KPI dashboard for a specific employee
    
    Returns:
    - Core KPIs (completion rate, quality, duration, reliability)
    - Task statistics breakdown
    - Performance trends over time
    - Team comparisons
    - Forecast accuracy metrics
    """
    
    # Permission check: admin/supervisor can view anyone, users can only view themselves
    if employee_id != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own performance data"
        )
    
    # Verify employee exists
    employee = db.query(User).filter(User.id == employee_id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {employee_id} not found"
        )
    
    # Date range - FIXED: Use timezone-aware datetimes from the start
    from datetime import timezone
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get tasks in date range
    tasks = db.query(Task).filter(
        and_(
            Task.assigned_to == employee_id,
            Task.created_at >= start_date,
            Task.created_at <= end_date
        )
    ).order_by(Task.created_at.desc()).all()
    
    if not tasks:
        return {
            "employee_id": employee_id,
            "employee_name": employee.full_name or employee.username,
            "period_days": days,
            "has_data": False,
            "message": f"No tasks found in the last {days} days"
        }
    
    # ========================================================================
    # CORE KPI CALCULATIONS
    # ========================================================================
    
    total_tasks = len(tasks)
    completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETED]
    in_progress_tasks = [t for t in tasks if t.status == TaskStatus.IN_PROGRESS]
    
    # FIXED: Make sure due_date comparison uses timezone-aware datetime
    overdue_tasks = [
        t for t in tasks 
        if t.due_date and make_aware(t.due_date) < end_date and t.status != TaskStatus.COMPLETED
    ]
    
    # Completion Rate
    completion_rate = len(completed_tasks) / total_tasks if total_tasks > 0 else 0
    
    # Average Quality Rating
    rated_tasks = [t for t in completed_tasks if t.quality_rating is not None]
    avg_quality = sum(t.quality_rating for t in rated_tasks) / len(rated_tasks) if rated_tasks else None
    
    # On-Time Completion Rate - FIXED: Ensure timezone-aware comparisons
    on_time_tasks = [
        t for t in completed_tasks 
        if t.due_date and t.completed_at 
        and make_aware(t.completed_at) <= make_aware(t.due_date)
    ]
    on_time_rate = len(on_time_tasks) / len(completed_tasks) if completed_tasks else 0
    
    # Average Task Duration (in minutes)
    completed_with_duration = [t for t in completed_tasks if t.actual_duration is not None]
    avg_duration_seconds = sum(t.actual_duration for t in completed_with_duration) / len(completed_with_duration) if completed_with_duration else None
    avg_duration_minutes = avg_duration_seconds / 60 if avg_duration_seconds else None
    
    # Reliability (on-time rate as reliability proxy)
    reliability = on_time_rate
    
    # Forecast Accuracy (if estimates exist)
    tasks_with_estimates = [
        t for t in completed_tasks 
        if t.estimated_duration and t.actual_duration and t.estimated_duration > 0
    ]
    
    forecast_accuracy = None
    if tasks_with_estimates:
        # Calculate mean absolute percentage error (MAPE)
        errors = []
        for task in tasks_with_estimates:
            mape = abs(task.actual_duration - task.estimated_duration) / task.estimated_duration
            errors.append(mape)
        
        avg_mape = sum(errors) / len(errors)
        forecast_accuracy = max(0, 1 - avg_mape)  # Convert MAPE to accuracy (0-1)
    
    # ========================================================================
    # PERFORMANCE TRENDS (Weekly Aggregations)
    # ========================================================================
    
    num_weeks = min(8, (days + 6) // 7)  # Up to 8 weeks of data
    
    # Task Duration Trend - FIXED: Proper timezone handling
    duration_trend = []
    for week_num in range(num_weeks):
        week_end = end_date - timedelta(weeks=week_num)
        week_start = end_date - timedelta(weeks=week_num + 1)
        
        week_tasks = [
            t for t in completed_tasks 
            if t.completed_at and week_start < make_aware(t.completed_at) <= week_end and t.actual_duration
        ]
        
        if week_tasks:
            avg_week_duration = sum(t.actual_duration for t in week_tasks) / len(week_tasks)
            duration_trend.append({
                "week_label": f"Week {num_weeks - week_num}",
                "week_start": week_start.strftime('%Y-%m-%d'),
                "week_end": week_end.strftime('%Y-%m-%d'),
                "avg_duration_minutes": round(avg_week_duration / 60, 1),
                "task_count": len(week_tasks)
            })
    
    duration_trend.reverse()
    
    # Completion Rate Trend - FIXED: Proper timezone handling
    completion_trend = []
    for week_num in range(num_weeks):
        week_end = end_date - timedelta(weeks=week_num)
        week_start = end_date - timedelta(weeks=week_num + 1)
        
        # FIXED: Make sure created_at comparisons work with timezone-aware week bounds
        week_all_tasks = [
            t for t in tasks 
            if t.created_at and week_start < make_aware(t.created_at) <= week_end
        ]
        week_completed = [t for t in week_all_tasks if t.status == TaskStatus.COMPLETED]
        
        week_completion_rate = len(week_completed) / len(week_all_tasks) if week_all_tasks else 0
        
        completion_trend.append({
            "week_label": f"Week {num_weeks - week_num}",
            "week_start": week_start.strftime('%Y-%m-%d'),
            "week_end": week_end.strftime('%Y-%m-%d'),
            "completion_rate": round(week_completion_rate, 3),
            "total_tasks": len(week_all_tasks),
            "completed_tasks": len(week_completed)
        })
    
    completion_trend.reverse()
    
    # Quality Score Trend - FIXED: Proper timezone handling
    quality_trend = []
    for week_num in range(num_weeks):
        week_end = end_date - timedelta(weeks=week_num)
        week_start = end_date - timedelta(weeks=week_num + 1)
        
        week_rated = [
            t for t in rated_tasks 
            if t.completed_at and week_start < make_aware(t.completed_at) <= week_end
        ]
        
        if week_rated:
            avg_week_quality = sum(t.quality_rating for t in week_rated) / len(week_rated)
            quality_trend.append({
                "week_label": f"Week {num_weeks - week_num}",
                "week_start": week_start.strftime('%Y-%m-%d'),
                "week_end": week_end.strftime('%Y-%m-%d'),
                "avg_quality": round(avg_week_quality, 2),
                "rated_tasks": len(week_rated)
            })
    
    quality_trend.reverse()
    
    # ========================================================================
    # TEAM COMPARISON
    # ========================================================================
    
    # Get all active team members' stats for comparison
    all_team_members = db.query(User).filter(User.is_active == True).all()
    
    team_completion_rates = []
    team_quality_scores = []
    team_durations = []
    
    for member in all_team_members:
        if member.id == employee_id:
            continue  # Skip current employee
        
        member_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == member.id,
                Task.created_at >= start_date,
                Task.created_at <= end_date
            )
        ).all()
        
        if not member_tasks:
            continue
        
        # Completion rate
        member_completed = [t for t in member_tasks if t.status == TaskStatus.COMPLETED]
        member_completion_rate = len(member_completed) / len(member_tasks)
        team_completion_rates.append(member_completion_rate)
        
        # Quality
        member_rated = [t for t in member_completed if t.quality_rating is not None]
        if member_rated:
            member_avg_quality = sum(t.quality_rating for t in member_rated) / len(member_rated)
            team_quality_scores.append(member_avg_quality)
        
        # Duration
        member_with_duration = [t for t in member_completed if t.actual_duration]
        if member_with_duration:
            member_avg_duration = sum(t.actual_duration for t in member_with_duration) / len(member_with_duration)
            team_durations.append(member_avg_duration / 60)  # Convert to minutes
    
    team_avg_completion = sum(team_completion_rates) / len(team_completion_rates) if team_completion_rates else None
    team_avg_quality = sum(team_quality_scores) / len(team_quality_scores) if team_quality_scores else None
    team_avg_duration = sum(team_durations) / len(team_durations) if team_durations else None
    
    # ========================================================================
    # BUILD RESPONSE
    # ========================================================================
    
    return {
        "employee_id": employee_id,
        "employee_name": employee.full_name or employee.username,
        "period_days": days,
        "has_data": True,
        
        # Core KPIs
        "kpis": {
            "completion_rate": round(completion_rate, 3),
            "completion_rate_percent": round(completion_rate * 100, 1),
            "average_quality_rating": round(avg_quality, 2) if avg_quality else None,
            "on_time_rate": round(on_time_rate, 3),
            "on_time_rate_percent": round(on_time_rate * 100, 1),
            "avg_task_duration_minutes": round(avg_duration_minutes, 1) if avg_duration_minutes else None,
            "reliability": round(reliability, 3),
            "forecast_accuracy": round(forecast_accuracy, 3) if forecast_accuracy else None,
            "forecast_accuracy_percent": round(forecast_accuracy * 100, 1) if forecast_accuracy else None
        },
        
        # Task Statistics
        "task_stats": {
            "total_tasks": total_tasks,
            "completed_tasks": len(completed_tasks),
            "in_progress_tasks": len(in_progress_tasks),
            "overdue_tasks": len(overdue_tasks),
            "on_time_tasks": len(on_time_tasks),
            "rated_tasks": len(rated_tasks),
            "tasks_with_estimates": len(tasks_with_estimates)
        },
        
        # Performance Trends
        "trends": {
            "task_duration": duration_trend,
            "completion_rate": completion_trend,
            "quality_score": quality_trend
        },
        
        # Team Comparison
        "team_comparison": {
            "team_avg_completion_rate": round(team_avg_completion, 3) if team_avg_completion else None,
            "team_avg_quality": round(team_avg_quality, 2) if team_avg_quality else None,
            "team_avg_duration": round(team_avg_duration, 1) if team_avg_duration else None,
            "team_member_count": len(all_team_members) - 1  # Exclude current employee
        }
    }