# Updated: backend/app/routers/analytics.py

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from pydantic import BaseModel

# --- ADDED PANDAS IMPORT ---
import pandas as pd

from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.core.auth import get_current_active_user
# --- UPDATED FORECASTING IMPORT ---
from app.core.forecasting import (
    predict_duration, 
    model, 
    model_columns,
    get_employee_forecast_comparison  # NEW: Compare multiple employees
)

router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])

# ============================================================================
# FORECASTING SCHEMAS
# ============================================================================

# In analytics.py, update the TaskForecastInput schema:

class TaskForecastInput(BaseModel):
    """Input schema for task duration forecasting with auto-detection"""
    Date: datetime
    StartTime: datetime
    latitude: float  # ✅ Required for city auto-detection
    longitude: float  # ✅ Required for city auto-detection
    ParticipantID: Optional[str] = None  # Employee ID for KPI lookup
    
    # ✅ These are now OPTIONAL - will be auto-detected if not provided
    City: Optional[str] = None
    Conditions: Optional[str] = None
    Method: Optional[str] = None
    Reliability_pct: Optional[float] = None


class EmployeeComparisonInput(BaseModel):
    """Compare forecast for multiple employees"""
    Date: datetime
    StartTime: datetime
    City: str
    Conditions: str
    Method: str
    employee_ids: List[str]  # List of employee IDs to compare


# ============================================================================
# FORECASTING ENDPOINTS
# ============================================================================

@router.post("/forecast")
async def get_task_forecast(
    input_data: TaskForecastInput,
    current_user: User = Depends(get_current_active_user)
):
    """
    🎯 Main forecasting endpoint - predicts task duration for a specific employee.
    
    This is called when a supervisor:
    1. Selects an employee to assign a task
    2. Wants to see estimated completion time
    
    The prediction considers:
    - Employee's historical KPI (avg duration, reliability, success rate)
    - Temporal patterns (time of day, day of week, seasonality)
    - Current conditions (traffic, weather)
    - Location characteristics (city patterns)
    - Transportation method
    """
    task_data = input_data.dict()
    prediction = predict_duration(task_data)
    
    if "error" in prediction:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=prediction["error"]
        )
    
    return prediction


@router.post("/forecast/compare-employees")
async def compare_employee_forecasts(
    input_data: EmployeeComparisonInput,
    current_user: User = Depends(get_current_active_user)
):
    """
    🔍 Compare multiple employees for the same task.
    
    Returns forecasts sorted by predicted duration (fastest first).
    Useful for supervisors to choose the best employee for a task.
    
    Example response:
    [
        {
            "employee_id": "P164",
            "predicted_duration": 23.5,
            "confidence_lower": 18.2,
            "confidence_upper": 28.8,
            "employee_kpi": {...}
        },
        ...
    ]
    """
    # Only supervisors and admins can compare employees
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only supervisors and admins can compare employee forecasts"
        )
    
    task_data = {
        "Date": input_data.Date,
        "StartTime": input_data.StartTime,
        "City": input_data.City,
        "Conditions": input_data.Conditions,
        "Method": input_data.Method
    }
    
    forecasts = get_employee_forecast_comparison(task_data, input_data.employee_ids)
    
    if not forecasts:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate forecasts for any employee"
        )
    
    return {
        "task_details": task_data,
        "employee_count": len(forecasts),
        "forecasts": forecasts,
        "fastest_employee": forecasts[0]["employee_id"],
        "slowest_employee": forecasts[-1]["employee_id"]
    }


@router.get("/forecast/model-status")
async def get_model_status():
    """
    📊 Check if forecasting model is loaded and ready.
    
    Returns model metadata and health status.
    """
    if model is None or model_columns is None:
        return {
            "status": "error",
            "loaded": False,
            "message": "Forecasting model not loaded"
        }
    
    return {
        "status": "ready",
        "loaded": True,
        "feature_count": len(model_columns),
        "model_type": "XGBoost + Prophet Hybrid",
        "features": model_columns
    }


# ============================================================================
# FEATURE IMPORTANCE ENDPOINT
# ============================================================================

@router.get("/feature-importance")
async def get_feature_importance():
    """
    📈 Returns the top 15 features affecting task duration prediction.
    
    Helps understand what factors most influence task completion time.
    """
    if model is None or model_columns is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Forecasting model or columns not loaded."
        )

    try:
        # Get importance scores from the loaded XGBoost model
        importance_scores = model.feature_importances_
        feature_names = model_columns

        # Create a DataFrame and sort
        importance_df = pd.DataFrame({
            'feature': feature_names,
            'importance': importance_scores
        }).sort_values(by='importance', ascending=False)

        # Get the top 15
        top_features = importance_df.head(15).to_dict(orient='records')

        return {
            "top_features": top_features,
            "total_features": len(feature_names)
        }
    except Exception as e:
        print(f"Error getting feature importance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate feature importance."
        )


# ============================================================================
# KPI ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/kpi/overview")
def get_kpi_overview(
    user_id: Optional[int] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    📊 Get comprehensive KPI overview for performance assessment.
    
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
    👥 Get team performance overview (managers, supervisors, and admins only).
    
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