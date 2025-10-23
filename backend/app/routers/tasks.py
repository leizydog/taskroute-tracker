from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.database import get_db
from app.models.user import User
from app.models.task import Task, TaskStatus
from app.models.location import LocationLog
from app.schemas.location import LocationLogCreate
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskStart,
    TaskComplete, TaskWithUsers, TaskStats
)
from app.core.auth import get_current_active_user
from app.websocket_manager import manager

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/", response_model=TaskWithUsers, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    assigned_user = db.query(User).filter(User.id == task_data.assigned_to).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned user not found"
        )

    db_task = Task(
        **task_data.dict(),
        created_by=current_user.id
    )

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Re-query to load relationships before sending the response
    created_task_with_users = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == db_task.id).first()

    response_task = TaskWithUsers(
        **created_task_with_users.__dict__,
        assigned_user_name=created_task_with_users.assigned_user.full_name,
        created_user_name=created_task_with_users.created_user.full_name
    )

    # Broadcast that a new task has been created (useful for live updates)
    await manager.broadcast_json({
        "event": "task_created",
        "task": response_task.model_dump_json()
    })

    return response_task


@router.get("/", response_model=List[TaskWithUsers])
async def get_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[TaskStatus] = None,
    assigned_to_me: bool = False,
    created_by_me: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    )

    if status:
        query = query.filter(Task.status == status)
    if assigned_to_me:
        query = query.filter(Task.assigned_to == current_user.id)
    if created_by_me:
        query = query.filter(Task.created_by == current_user.id)

    query = query.order_by(desc(Task.created_at))
    tasks = query.offset(skip).limit(limit).all()

    return [
        TaskWithUsers(
            **t.__dict__,
            assigned_user_name=t.assigned_user.full_name,
            created_user_name=t.created_user.full_name
        )
        for t in tasks
    ]


@router.get("/{task_id}", response_model=TaskWithUsers)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    return TaskWithUsers(
        **task.__dict__,
        assigned_user_name=task.assigned_user.full_name,
        created_user_name=task.created_user.full_name
    )


@router.put("/{task_id}", response_model=TaskWithUsers)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    response_task = TaskWithUsers(
        **task.__dict__,
        assigned_user_name=task.assigned_user.full_name,
        created_user_name=task.created_user.full_name
    )

    await manager.broadcast_json({
        "event": "task_updated",
        "task": response_task.model_dump_json()
    })

    return response_task


@router.post("/{task_id}/start", response_model=TaskWithUsers)
async def start_task(
    task_id: int,
    start_data: TaskStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check if the user already has an active task
    active_task = db.query(Task).filter(
        Task.assigned_to == current_user.id,
        Task.status == TaskStatus.IN_PROGRESS
    ).first()

    if active_task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active task. Complete it before starting a new one."
        )

    # Fetch the task to be started
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()

    # --- Validation ---
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
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

    # --- Create the first location log for this task when it starts ---
    if start_data.latitude is not None and start_data.longitude is not None:
        location_log_data = LocationLogCreate(
            latitude=start_data.latitude,
            longitude=start_data.longitude,
            task_id=task.id,
            location_type="task_start"
        )
        # Changed from .dict() to .model_dump() for compatibility with Pydantic v2+
        db_location_log = LocationLog(**location_log_data.model_dump(), user_id=current_user.id)
        db.add(db_location_log)

    # Update task status and start time
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Prepare the response object
    response_task = TaskWithUsers(
        **task.__dict__,
        assigned_user_name=task.assigned_user.full_name,
        created_user_name=task.created_user.full_name
    )

    # Broadcast that the task has started
    await manager.broadcast_json({
        "event": "task_started",
        "task": response_task.model_dump_json()
    })

    # Also broadcast the initial location so the map updates immediately
    if start_data.latitude is not None and start_data.longitude is not None:
        await manager.broadcast_json({
            "event": "location_update",
            "task_id": task.id,
            "latitude": start_data.latitude,
            "longitude": start_data.longitude,
            "user_id": current_user.id,
            "user_name": current_user.full_name,
        })

    return response_task




@router.post("/{task_id}/complete", response_model=TaskWithUsers)
async def complete_task(
    task_id: int,
    complete_data: TaskComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

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

    completion_time = datetime.utcnow()
    if task.started_at:
        duration_seconds = (completion_time - task.started_at).total_seconds()
        task.actual_duration = int(duration_seconds / 60)

    task.status = TaskStatus.COMPLETED
    task.completed_at = completion_time
    task.completion_notes = complete_data.completion_notes
    task.quality_rating = complete_data.quality_rating

    if complete_data.latitude is not None:
        task.latitude = complete_data.latitude
    if complete_data.longitude is not None:
        task.longitude = complete_data.longitude

    db.commit()
    db.refresh(task)

    response_task = TaskWithUsers(
        **task.__dict__,
        assigned_user_name=task.assigned_user.full_name,
        created_user_name=task.created_user.full_name
    )

    await manager.broadcast_json({
        "event": "task_completed",
        "task_id": task.id
    })

    return response_task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete tasks you created"
        )

    task_id_to_broadcast = task.id
    db.delete(task)
    db.commit()
    
    await manager.broadcast_json({
        "event": "task_deleted",
        "task_id": task_id_to_broadcast
    })


@router.get("/stats/performance", response_model=TaskStats)
async def get_task_statistics(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if user_id is None:
        user_id = current_user.id

    tasks = db.query(Task).filter(Task.assigned_to == user_id).all()

    if not tasks:
        return TaskStats(
            total_tasks=0,
            completed_tasks=0,
            completion_rate=0.0,
            average_duration=None,
            average_quality_rating=None,
            tasks_by_status={},
            tasks_by_priority={}
        )

    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == TaskStatus.COMPLETED])
    completion_rate = completed_tasks / total_tasks if total_tasks > 0 else 0.0

    completed_with_duration = [t for t in tasks if t.status == TaskStatus.COMPLETED and t.actual_duration is not None]
    average_duration = sum(t.actual_duration for t in completed_with_duration) / len(completed_with_duration) if completed_with_duration else None

    completed_with_rating = [t for t in tasks if t.status == TaskStatus.COMPLETED and t.quality_rating is not None]
    average_quality_rating = sum(t.quality_rating for t in completed_with_rating) / len(completed_with_rating) if completed_with_rating else None

    tasks_by_status = {}
    tasks_by_priority = {}

    for task in tasks:
        status_key = task.status.value
        tasks_by_status[status_key] = tasks_by_status.get(status_key, 0) + 1

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