from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc
from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskStart, 
    TaskComplete, TaskWithUsers, TaskStats
)
from app.core.auth import get_current_active_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: TaskCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task."""
    
    # Verify assigned user exists
    assigned_user = db.query(User).filter(User.id == task_data.assigned_to).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned user not found"
        )
    
    # Create task
    db_task = Task(
        **task_data.dict(),
        created_by=current_user.id
    )
    
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return db_task


@router.get("/", response_model=List[TaskWithUsers])
def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[TaskStatus] = None,
    assigned_to_me: bool = False,
    created_by_me: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get tasks with filtering options."""
    
    query = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    )
    
    # Apply filters
    if status:
        query = query.filter(Task.status == status)
    
    if assigned_to_me:
        query = query.filter(Task.assigned_to == current_user.id)
    
    if created_by_me:
        query = query.filter(Task.created_by == current_user.id)
    
    # Order by created_at descending
    query = query.order_by(desc(Task.created_at))
    
    tasks = query.offset(skip).limit(limit).all()
    
    # Add user names to response
    task_responses = []
    for task in tasks:
        task_dict = task.__dict__.copy()
        task_dict['assigned_user_name'] = task.assigned_user.full_name
        task_dict['created_user_name'] = task.created_user.full_name
        task_responses.append(task_dict)
    
    return task_responses


@router.get("/{task_id}", response_model=TaskWithUsers)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific task by ID."""
    
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Add user names to response
    task_dict = task.__dict__.copy()
    task_dict['assigned_user_name'] = task.assigned_user.full_name
    task_dict['created_user_name'] = task.created_user.full_name
    
    return task_dict


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a task."""
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Update fields
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    return task


@router.post("/{task_id}/start", response_model=TaskResponse)
def start_task(
    task_id: int,
    start_data: TaskStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Start a task (sets status to in_progress and records start time)."""
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if user is assigned to this task
    if task.assigned_to != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only start tasks assigned to you"
        )
    
    if task.status != TaskStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task can only be started from pending status"
        )
    
    # Update task
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()
    
    # Update location if provided
    if start_data.latitude is not None:
        task.latitude = start_data.latitude
    if start_data.longitude is not None:
        task.longitude = start_data.longitude
    
    db.commit()
    db.refresh(task)
    
    return task


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: int,
    complete_data: TaskComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Complete a task (sets status to completed and records completion time)."""
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if user is assigned to this task
    if task.assigned_to != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only complete tasks assigned to you"
        )
    
    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task must be in progress to be completed"
        )
    
    # Calculate actual duration if started_at exists
    completion_time = datetime.utcnow()
    if task.started_at:
        duration_seconds = (completion_time - task.started_at).total_seconds()
        task.actual_duration = int(duration_seconds / 60)  # Convert to minutes
    
    # Update task
    task.status = TaskStatus.COMPLETED
    task.completed_at = completion_time
    task.completion_notes = complete_data.completion_notes
    task.quality_rating = complete_data.quality_rating
    
    # Update location if provided
    if complete_data.latitude is not None:
        task.latitude = complete_data.latitude
    if complete_data.longitude is not None:
        task.longitude = complete_data.longitude
    
    db.commit()
    db.refresh(task)
    
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a task (only creator can delete)."""
    
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Only task creator can delete
    if task.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete tasks you created"
        )
    
    db.delete(task)
    db.commit()


@router.get("/stats/performance", response_model=TaskStats)
def get_task_statistics(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get task statistics for performance analysis."""
    
    # If no user_id provided, use current user
    if user_id is None:
        user_id = current_user.id
    
    # Get all tasks for the user
    tasks = db.query(Task).filter(Task.assigned_to == user_id).all()
    
    if not tasks:
        return TaskStats(
            total_tasks=0,
            completed_tasks=0,
            completion_rate=0.0,
            tasks_by_status={},
            tasks_by_priority={}
        )
    
    # Calculate statistics
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == TaskStatus.COMPLETED])
    completion_rate = completed_tasks / total_tasks if total_tasks > 0 else 0.0
    
    # Calculate average duration for completed tasks
    completed_with_duration = [t for t in tasks if t.status == TaskStatus.COMPLETED and t.actual_duration]
    average_duration = sum(t.actual_duration for t in completed_with_duration) / len(completed_with_duration) if completed_with_duration else None
    
    # Calculate average quality rating
    completed_with_rating = [t for t in tasks if t.status == TaskStatus.COMPLETED and t.quality_rating]
    average_quality_rating = sum(t.quality_rating for t in completed_with_rating) / len(completed_with_rating) if completed_with_rating else None
    
    # Group by status and priority
    tasks_by_status = {}
    tasks_by_priority = {}
    
    for task in tasks:
        # Count by status
        status_key = task.status.value
        tasks_by_status[status_key] = tasks_by_status.get(status_key, 0) + 1
        
        # Count by priority
        priority_key = task.priority.value
        tasks_by_priority[priority_key] = tasks_by_priority.get(priority_key, 0) + 1
    
    return TaskStats(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=completion_rate,
        average_duration=average_duration,
        average_quality_rating=average_quality_rating,
        tasks_by_status=tasks_by_status,
        tasks_by_priority=tasks_by_priority
    )