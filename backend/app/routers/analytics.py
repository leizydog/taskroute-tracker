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
from app.core.forecasting import predict_duration, model, model_columns # Import model and columns too

router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])

# --- Pydantic model for receiving forecast data ---
class TaskForecastInput(BaseModel):
    Date: datetime
    StartTime: datetime
    City: str
    Conditions: str
    Method: str
    Reliability_pct: Optional[float] = 90.0

# --- Forecasting Endpoint ---
@router.post("/forecast")
async def get_task_forecast(input_data: TaskForecastInput):
    """
    Receives task data and returns a duration forecast.
    """
    task_data = input_data.dict()
    prediction = predict_duration(task_data)
    
    if "error" in prediction:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=prediction["error"]
        )
    return prediction

# --- NEW: Feature Importance Endpoint ---
@router.get("/feature-importance")
async def get_feature_importance():
    """
    Returns the top 15 features affecting task duration prediction.
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

        return {"top_features": top_features}
    except Exception as e:
        # Log the error (optional but recommended)
        print(f"Error getting feature importance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not calculate feature importance."
        )

# --- Your Existing Code Below ---

@router.get("/kpi/overview")
def get_kpi_overview(
    user_id: Optional[int] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive KPI overview for performance assessment."""
    
    target_user_id = user_id if user_id else current_user.id
    
    # ✅ FIXED: Added 'supervisor' to allowed roles
    if target_user_id != current_user.id and current_user.role.value not in ['admin', 'manager', 'supervisor']:
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
        # Return default structure if no tasks found
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
    
    # Average completion time (Ensure duration is not None)
    completion_times = [t.actual_duration for t in completed_tasks if t.actual_duration is not None]
    avg_completion_time = (sum(completion_times) / len(completion_times)) if completion_times else None
    avg_completion_time_minutes = (avg_completion_time / 60) if avg_completion_time is not None else None # Convert to minutes

    
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
        # Check if both estimated and actual durations are valid numbers > 0
        if task.estimated_duration and task.actual_duration and task.estimated_duration > 0:
            variance = ((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
            time_variances.append(variance)
        elif task.actual_duration is not None and task.estimated_duration is None:
             # Handle case where only actual duration exists - perhaps treat as 0 variance or exclude?
             # For now, excluding seems safer than assuming 0 variance.
             pass
             
    avg_time_variance = (sum(time_variances) / len(time_variances)) if time_variances else None
    
    # Calculate efficiency score (0-100, higher is better)
    efficiency_score = None
    if avg_time_variance is not None:
        # Penalize more for being slower, cap score at 100
        efficiency_score = max(0, min(100, 100 - avg_time_variance)) 
    
    # Productivity trend (tasks completed per week)
    productivity_trend = []
    num_weeks = min(4, (days + 6) // 7) # Calculate number of full/partial weeks
    for week_num in range(num_weeks):
        # Calculate start and end date for each week relative to end_date
        week_end = end_date - timedelta(weeks=week_num)
        week_start = end_date - timedelta(weeks=week_num + 1)
        
        week_completed_count = 0
        for t in completed_tasks:
             if t.completed_at and week_start < t.completed_at <= week_end:
                 week_completed_count += 1
                 
        productivity_trend.append({
            # Label week relative to 'now' (e.g., "Last Week", "2 Weeks Ago")
            "week_label": f"{week_num+1} Week(s) Ago" if week_num > 0 else "This Past Week", 
            "start_date": week_start.strftime('%Y-%m-%d'),
            "end_date": week_end.strftime('%Y-%m-%d'),
            "completed_tasks": week_completed_count
        })
    
    productivity_trend.reverse() # Show chronologically (oldest week first)
    
    # Location Metrics
    tasks_with_location = len([t for t in tasks if t.latitude is not None and t.longitude is not None])
    location_compliance_rate = (tasks_with_location / total_tasks * 100) if total_tasks > 0 else 0.0
    
    # Note: distance_traveled_km would require calculating distances between logged points
    # This is complex and might be better handled elsewhere or with approximations
    distance_traveled_km = 0.0 # Placeholder
    
    return {
        "user_id": target_user_id,
        "period_days": days,
        "task_metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_completion_time_seconds": avg_completion_time, # Keep original seconds
            "average_completion_time_minutes": round(avg_completion_time_minutes, 1) if avg_completion_time_minutes is not None else None, # Add minutes
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
    """Get team performance overview (managers, supervisors, and admins only)."""
    
    # ✅ FIXED: Added 'supervisor' to allowed roles
    if current_user.role.value not in ['admin', 'manager', 'supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers, supervisors, and admins can view team analytics"
        )
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get active team members (excluding the manager/admin querying)
    team_users = db.query(User).filter(
        # Assuming you might want to exclude the requesting manager/admin
        # User.id != current_user.id, 
        User.is_active == True,
        # Optional: Filter by role if managers only see 'employee' role
        # User.role == UserRole.employee 
    ).all()
    
    if not team_users:
         return {
             "period_days": days,
             "team_size": 0,
             "employees": [],  # ✅ FIXED: Changed from 'team_members' to 'employees'
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
                "id": user.id,  # ✅ ADDED: Include id
                "employee_id": user.id,  # ✅ ADDED: Include employee_id for compatibility
                "user_id": user.id,
                "employee_name": user.full_name or user.username,  # ✅ ADDED: Include employee_name
                "user_name": user.full_name or user.username, # Fallback to username
                "role": user.role.value,
                "total_tasks": 0,
                "completed_tasks": 0,
                "completion_rate": 0.0,
                "average_quality_rating": None,  # ✅ RENAMED: Match frontend expectation
                "average_quality": None,
                "efficiency_score": None,
                "last_activity": None # Consider fetching last login or last task update
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
                 # Calculate absolute variance percentage
                 variance = abs((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
                 time_variances.append(variance)
                 
        # Calculate efficiency score based on average absolute variance
        avg_abs_variance = (sum(time_variances) / len(time_variances)) if time_variances else None
        # Score decreases as variance increases
        efficiency_score = (max(0, 100 - avg_abs_variance)) if avg_abs_variance is not None else None 
        
        # Find the timestamp of the last update or creation for this user's tasks in the period
        last_activity_ts = None
        update_times = [t.updated_at for t in user_tasks if t.updated_at]
        create_times = [t.created_at for t in user_tasks if t.created_at] # Should always exist
        all_times = update_times + create_times
        if all_times:
            last_activity_ts = max(all_times)

        team_analytics.append({
            "id": user.id,  # ✅ ADDED: Include id
            "employee_id": user.id,  # ✅ ADDED: Include employee_id for compatibility
            "user_id": user.id,
            "employee_name": user.full_name or user.username,  # ✅ ADDED: Include employee_name
            "user_name": user.full_name or user.username,
            "role": user.role.value,
            "total_tasks": total_user_tasks,
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_quality_rating": round(avg_quality, 2) if avg_quality is not None else None,  # ✅ ADDED
            "average_quality": round(avg_quality, 2) if avg_quality is not None else None,
            "efficiency_score": round(efficiency_score, 1) if efficiency_score is not None else None,
            "last_activity": last_activity_ts
        })
    
    # Sort team members, e.g., by efficiency score (higher is better)
    team_analytics.sort(key=lambda x: x["efficiency_score"] if x["efficiency_score"] is not None else -1, reverse=True)
    
    # Calculate overall team summary statistics
    total_team_tasks_assigned = sum(m["total_tasks"] for m in team_analytics)
    total_team_tasks_completed = sum(m["completed_tasks"] for m in team_analytics)
    overall_team_completion_rate = (total_team_tasks_completed / total_team_tasks_assigned * 100) if total_team_tasks_assigned > 0 else 0
    
    # Find top performer based on sorting key (efficiency score)
    top_performer_name = team_analytics[0]["user_name"] if team_analytics else None
            
    return {
        "period_days": days,
        "team_size": len(team_analytics),
        "employees": team_analytics,  # ✅ FIXED: Changed from 'team_members' to 'employees'
        "summary": {
            "total_team_tasks": total_team_tasks_assigned,
            "total_completed": total_team_tasks_completed,
            "team_completion_rate": round(overall_team_completion_rate, 1),
            "top_performer": top_performer_name 
        }
    }