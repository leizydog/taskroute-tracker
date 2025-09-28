from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.core.auth import get_current_active_user

router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])

@router.get("/kpi/overview")
def get_kpi_overview(
    user_id: Optional[int] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive KPI overview for performance assessment."""
    
    target_user_id = user_id if user_id else current_user.id
    
    # Permission check
    if target_user_id != current_user.id and current_user.role.value not in ['admin', 'manager']:
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
    completion_rate = len(completed_tasks) / total_tasks * 100
    
    # Average completion time
    completion_times = [t.actual_duration for t in completed_tasks if t.actual_duration]
    avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else None
    
    # On-time completion rate
    on_time_tasks = [
        t for t in completed_tasks 
        if t.due_date and t.completed_at and t.completed_at <= t.due_date
    ]
    on_time_rate = len(on_time_tasks) / len(completed_tasks) * 100 if completed_tasks else 0.0
    
    # Quality Metrics
    rated_tasks = [t for t in completed_tasks if t.quality_rating]
    avg_quality = sum(t.quality_rating for t in rated_tasks) / len(rated_tasks) if rated_tasks else None
    
    quality_distribution = {}
    for rating in range(1, 6):
        count = len([t for t in rated_tasks if t.quality_rating == rating])
        quality_distribution[f"{rating}_star"] = count
    
    # Efficiency Metrics
    time_variances = []
    for task in completed_tasks:
        if task.estimated_duration and task.actual_duration:
            variance = ((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
            time_variances.append(variance)
    
    avg_time_variance = sum(time_variances) / len(time_variances) if time_variances else None
    
    # Calculate efficiency score (0-100, higher is better)
    efficiency_score = None
    if avg_time_variance is not None:
        efficiency_score = max(0, 100 - abs(avg_time_variance))
    
    # Productivity trend (tasks completed per week)
    productivity_trend = []
    for week in range(min(4, days // 7)):
        week_start = end_date - timedelta(weeks=week+1)
        week_end = end_date - timedelta(weeks=week)
        week_completed = len([
            t for t in completed_tasks 
            if week_start <= t.completed_at <= week_end
        ])
        productivity_trend.append({
            "week": f"Week {4-week}",
            "completed_tasks": week_completed
        })
    
    productivity_trend.reverse()  # Show chronologically
    
    # Location Metrics
    tasks_with_location = len([t for t in tasks if t.latitude and t.longitude])
    location_compliance_rate = (tasks_with_location / total_tasks) * 100 if total_tasks > 0 else 0.0
    
    return {
        "user_id": target_user_id,
        "period_days": days,
        "task_metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_completion_time_minutes": avg_completion_time,
            "on_time_completion_rate": round(on_time_rate, 1)
        },
        "quality_metrics": {
            "average_quality_rating": round(avg_quality, 2) if avg_quality else None,
            "tasks_with_ratings": len(rated_tasks),
            "quality_distribution": quality_distribution
        },
        "efficiency_metrics": {
            "average_time_variance_percent": round(avg_time_variance, 1) if avg_time_variance else None,
            "efficiency_score": round(efficiency_score, 1) if efficiency_score else None,
            "productivity_trend": productivity_trend
        },
        "location_metrics": {
            "tasks_with_location": tasks_with_location,
            "location_compliance_rate": round(location_compliance_rate, 1),
            "distance_traveled_km": 0.0  # Placeholder for now
        }
    }


@router.get("/team/overview")
def get_team_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get team performance overview (managers and admins only)."""
    
    # Permission check
    if current_user.role.value not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only managers and admins can view team analytics"
        )
    
    # Date range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get all users except current user
    team_users = db.query(User).filter(
        and_(
            User.id != current_user.id,
            User.is_active == True
        )
    ).all()
    
    team_analytics = []
    
    for user in team_users:
        # Get user's tasks in the period
        user_tasks = db.query(Task).filter(
            and_(
                Task.assigned_to == user.id,
                Task.created_at >= start_date,
                Task.created_at <= end_date
            )
        ).all()
        
        if not user_tasks:
            team_analytics.append({
                "user_id": user.id,
                "user_name": user.full_name,
                "role": user.role.value,
                "total_tasks": 0,
                "completed_tasks": 0,
                "completion_rate": 0.0,
                "average_quality": None,
                "efficiency_score": None,
                "last_activity": None
            })
            continue
        
        # Calculate metrics
        completed_tasks = [t for t in user_tasks if t.status == TaskStatus.COMPLETED]
        completion_rate = len(completed_tasks) / len(user_tasks) * 100 if user_tasks else 0
        
        # Average quality rating
        rated_tasks = [t for t in completed_tasks if t.quality_rating]
        avg_quality = sum(t.quality_rating for t in rated_tasks) / len(rated_tasks) if rated_tasks else None
        
        # Efficiency score based on time variance
        time_variances = []
        for task in completed_tasks:
            if task.estimated_duration and task.actual_duration:
                variance = abs((task.actual_duration - task.estimated_duration) / task.estimated_duration) * 100
                time_variances.append(variance)
        
        avg_variance = sum(time_variances) / len(time_variances) if time_variances else None
        efficiency_score = max(0, 100 - avg_variance) if avg_variance else None
        
        # Last activity
        last_task_update = max(
            [t.updated_at for t in user_tasks if t.updated_at],
            default=max([t.created_at for t in user_tasks], default=None)
        )
        
        team_analytics.append({
            "user_id": user.id,
            "user_name": user.full_name,
            "role": user.role.value,
            "total_tasks": len(user_tasks),
            "completed_tasks": len(completed_tasks),
            "completion_rate": round(completion_rate, 1),
            "average_quality": round(avg_quality, 2) if avg_quality else None,
            "efficiency_score": round(efficiency_score, 1) if efficiency_score else None,
            "last_activity": last_task_update
        })
    
    # Sort by completion rate
    team_analytics.sort(key=lambda x: x["completion_rate"], reverse=True)
    
    return {
        "period_days": days,
        "team_size": len(team_analytics),
        "team_members": team_analytics,
        "summary": {
            "total_team_tasks": sum(member["total_tasks"] for member in team_analytics),
            "total_completed": sum(member["completed_tasks"] for member in team_analytics),
            "team_completion_rate": round(
                sum(member["completed_tasks"] for member in team_analytics) / 
                max(1, sum(member["total_tasks"] for member in team_analytics)) * 100, 1
            ),
            "top_performer": team_analytics[0]["user_name"] if team_analytics else None
        }
    }