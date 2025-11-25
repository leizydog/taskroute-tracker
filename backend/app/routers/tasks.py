from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.location import LocationLog
from app.models.audit import AuditLog
from app.schemas.location import LocationLogCreate
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskStart,
    TaskComplete, TaskWithUsers, TaskStats, OngoingTasksByUser, UserWithOngoingTask, TaskCancel
)
from app.core.auth import get_current_active_user
from app.websocket_manager import manager
import json
import math  # ✅ Import math for rating calculation
from pathlib import Path
import uuid

router = APIRouter(prefix="/tasks", tags=["Tasks"])

UPLOAD_DIR = Path("static/signatures")
PHOTO_DIR = Path("static/photos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PHOTO_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# ADMIN OPERATIONS
# ============================================================================

@router.post("/{task_id}/seed-historical", response_model=TaskWithUsers)
async def seed_historical_task(
    task_id: int,
    historical_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Special endpoint for seeding historical task data - ADMIN ONLY
    """
    # Check admin permission
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can seed historical data"
        )
    
    # Fetch task with relationships
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Allow setting historical fields directly
    try:
        if "status" in historical_data:
            status_value = historical_data["status"]
            if isinstance(status_value, str):
                task.status = TaskStatus(status_value.upper())  # ✅ Ensure uppercase
            else:
                task.status = status_value
        
        if "started_at" in historical_data and historical_data["started_at"]:
            task.started_at = datetime.fromisoformat(historical_data["started_at"].replace('Z', '+00:00'))
        
        if "completed_at" in historical_data and historical_data["completed_at"]:
            task.completed_at = datetime.fromisoformat(historical_data["completed_at"].replace('Z', '+00:00'))
        
        if "quality_rating" in historical_data and historical_data["quality_rating"] is not None:
            task.quality_rating = historical_data["quality_rating"]
        
        if "actual_duration" in historical_data and historical_data["actual_duration"] is not None:
            task.actual_duration = historical_data["actual_duration"]
        
        db.commit()
        db.refresh(task)
        
        return TaskWithUsers(
            **task.__dict__,
            assigned_user_name=task.assigned_user.full_name,
            created_user_name=task.created_user.full_name
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid data format: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed historical data: {str(e)}"
        )


# ============================================================================
# STATISTICS AND REPORTING
# ============================================================================

@router.get("/stats/performance", response_model=TaskStats)
async def get_task_statistics(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get task performance statistics for a user"""
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


@router.get("/stats/ongoing-by-users", response_model=OngoingTasksByUser)
async def get_ongoing_tasks_by_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all users with their currently ongoing (in_progress) tasks.
    Includes their current location for real-time tracking.
    """
    # Get all users who have ongoing tasks
    ongoing_tasks = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.status == TaskStatus.IN_PROGRESS).all()
    
    # Group tasks by user
    users_with_tasks = {}
    for task in ongoing_tasks:
        user_id = task.assigned_to
        if user_id not in users_with_tasks:
            users_with_tasks[user_id] = {
                "user": task.assigned_user,
                "tasks": []
            }
        users_with_tasks[user_id]["tasks"].append(task)
    
    # Build response
    users_data = []
    for user_id, data in users_with_tasks.items():
        user = data["user"]
        tasks = data["tasks"]
        
        # Get the most recent task (current task)
        current_task = max(tasks, key=lambda t: t.started_at if t.started_at else datetime.min)
        
        task_with_users = TaskWithUsers(
            **current_task.__dict__,
            assigned_user_name=current_task.assigned_user.full_name,
            created_user_name=current_task.created_user.full_name
        )
        
        # Get the latest location for this user's current task
        latest_location = db.query(LocationLog).filter(
            LocationLog.task_id == current_task.id,
            LocationLog.user_id == user.id
        ).order_by(LocationLog.recorded_at.desc()).first()
        
        users_data.append(UserWithOngoingTask(
            user_id=user.id,
            user_name=user.full_name,
            user_email=user.email,
            user_role=user.role.value,
            ongoing_task_count=len(tasks),
            current_task=task_with_users,
            current_location=latest_location
        ))
    
    # Sort by user name
    users_data.sort(key=lambda x: x.user_name)
    
    return OngoingTasksByUser(
        total_users_with_tasks=len(users_data),
        total_ongoing_tasks=len(ongoing_tasks),
        users=users_data
    )

#============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def auto_start_next_task(user_id: int, db: Session):
    """Check for QUEUED tasks and start the next one automatically."""
    next_task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(
        Task.assigned_to == user_id,
        Task.status == TaskStatus.QUEUED
    ).order_by(Task.priority.desc(), Task.created_at.asc()).first()

    if next_task:
        next_task.status = TaskStatus.IN_PROGRESS
        next_task.started_at = datetime.utcnow()
        
        db.commit()
        db.refresh(next_task)
        
        # Audit
        audit = AuditLog(
            user_id=user_id, 
            action="TASK_AUTO_START",
            target_resource=f"Task #{next_task.id}", 
            details="Auto-started from queue"
        )
        db.add(audit)
        db.commit()
        
        # Broadcast
        response_task = TaskWithUsers.model_validate(next_task)
        await manager.broadcast_json({
            "event": "task_started", 
            "task": response_task.model_dump_json(),
            "auto_started": True
        })


# ============================================================================
# TASK CRUD OPERATIONS
# ============================================================================

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

    # Convert Pydantic model to dictionary
    task_dict = task_data.dict()
    
    # Manually serialize 'destinations' to JSON string if it exists
    if task_dict.get("destinations"):
        task_dict["destinations"] = json.dumps(task_dict["destinations"])
    
    db_task = Task(
        **task_dict,
        created_by=current_user.id
    )

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Audit Log: Task Creation
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_CREATE",
        target_resource=f"Task #{db_task.id}",
        details=f"Title: {db_task.title}, Assigned to: {assigned_user.full_name}"
    )
    db.add(audit)
    db.commit()

    # Real-time Audit Broadcast
    await manager.broadcast_json({
        "event": "audit_log_created",
        "log": {
            "id": audit.id,
            "action": audit.action,
            "target_resource": audit.target_resource,
            "details": audit.details,
            "timestamp": audit.timestamp.isoformat(),
            "user_email": current_user.email
        }
    })

    # Re-query to load relationships
    created_task_with_users = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == db_task.id).first()

    response_task = TaskWithUsers(
        **created_task_with_users.__dict__,
        assigned_user_name=created_task_with_users.assigned_user.full_name,
        created_user_name=created_task_with_users.created_user.full_name
    )

    # Broadcast task creation
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
            assigned_user_name=t.assigned_user.full_name if t.assigned_user else None,
            created_user_name=t.created_user.full_name if t.created_user else None
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
    
    # Capture changes for audit log
    changes = []
    for field, value in update_data.items():
        old_val = getattr(task, field)
        if old_val != value:
            changes.append(f"{field}: {old_val} -> {value}")
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    # Audit Log: Task Update
    if changes:
        audit = AuditLog(
            user_id=current_user.id,
            action="TASK_UPDATE",
            target_resource=f"Task #{task.id}",
            details=", ".join(changes)[:500]
        )
        db.add(audit)
        db.commit()

        # Real-time Audit Broadcast
        await manager.broadcast_json({
            "event": "audit_log_created",
            "log": {
                "id": audit.id,
                "action": audit.action,
                "target_resource": audit.target_resource,
                "details": audit.details,
                "timestamp": audit.timestamp.isoformat(),
                "user_email": current_user.email
            }
        })

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

    # Allow admins and supervisors to delete any task
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR] and task.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete tasks you created"
        )

    task_title = task.title
    task_id_to_broadcast = task.id
    db.delete(task)
    db.commit()
    
    # Audit Log: Task Deletion
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_DELETE",
        target_resource=f"Task #{task_id_to_broadcast}",
        details=f"Deleted task: {task_title}"
    )
    db.add(audit)
    db.commit()
    
    # Real-time Audit Broadcast
    await manager.broadcast_json({
        "event": "audit_log_created",
        "log": {
            "id": audit.id,
            "action": audit.action,
            "target_resource": audit.target_resource,
            "details": audit.details,
            "timestamp": audit.timestamp.isoformat(),
            "user_email": current_user.email
        }
    })

    await manager.broadcast_json({
        "event": "task_deleted",
        "task_id": task_id_to_broadcast
    })


# ============================================================================
# TASK LIFECYCLE OPERATIONS
# ============================================================================

@router.post("/{task_id}/start", response_model=TaskWithUsers)
async def start_task(
    task_id: int,
    start_data: TaskStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check if user already has an active task
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

    # Validation
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
    if task.status not in [TaskStatus.PENDING, TaskStatus.QUEUED]:  # Allow starting from QUEUED
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task can only be started from pending or queued status"
        )

    # Create location log if coordinates provided
    if start_data.latitude is not None and start_data.longitude is not None:
        location_log_data = LocationLogCreate(
            latitude=start_data.latitude,
            longitude=start_data.longitude,
            task_id=task.id,
            location_type="task_start"
        )
        db_location_log = LocationLog(**location_log_data.model_dump(), user_id=current_user.id)
        db.add(db_location_log)

    # Update task status and start time
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Audit Log: Task Started
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_START",
        target_resource=f"Task #{task.id}",
        details=f"Started by user. Loc: {start_data.latitude},{start_data.longitude}"
    )
    db.add(audit)
    db.commit()

    # Real-time Audit Broadcast
    await manager.broadcast_json({
        "event": "audit_log_created",
        "log": {
            "id": audit.id,
            "action": audit.action,
            "target_resource": audit.target_resource,
            "details": audit.details,
            "timestamp": audit.timestamp.isoformat(),
            "user_email": current_user.email
        }
    })

    # Construct response
    response_task = TaskWithUsers(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        is_multi_destination=task.is_multi_destination,
        destinations=task.destinations,
        location_name=task.location_name,
        latitude=task.latitude,
        longitude=task.longitude,
        address=task.address,
        estimated_duration=task.estimated_duration,
        due_date=task.due_date,
        status=task.status,
        assigned_to=task.assigned_to,
        created_by=task.created_by,
        actual_duration=task.actual_duration,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completion_notes=task.completion_notes,
        quality_rating=task.quality_rating,
        signature_url=task.signature_url,
        assigned_user_name=task.assigned_user.full_name if task.assigned_user else None,
        created_user_name=task.created_user.full_name if task.created_user else None,
    )

    # Broadcast task started
    await manager.broadcast_json({
        "event": "task_started",
        "task": response_task.model_dump_json()
    })

    # Broadcast initial location
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only complete tasks assigned to you")
    
    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task must be in progress to be completed")

    # =========================================================
    # ✅ 1. MULTI-DESTINATION PROOF VALIDATION
    # =========================================================
    if task.is_multi_destination:
        try:
            # Parse destinations safely
            destinations = json.loads(task.destinations) if isinstance(task.destinations, str) else task.destinations
            if not destinations:
                destinations = []
                
            required_stops = len(destinations)
            
            # Check if user provided per-stop proofs
            provided_stops = len(complete_data.stop_proofs) if complete_data.stop_proofs else 0
            
            if provided_stops < required_stops:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail=f"Incomplete proofs! This task has {required_stops} stops, but you only uploaded proofs for {provided_stops}."
                )
            
            # Save the stop proofs to DB (store as JSON)
            task.stop_proofs = [proof.dict() for proof in complete_data.stop_proofs]
            
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            print(f"⚠️ Validation Warning: {e}")
            # Proceed if validation fails but don't crash

    # =========================================================
    # ✅ 2. CALCULATE DURATION & AUTO-RATING
    # =========================================================
    completion_time = datetime.utcnow()
    
    # Calculate Actual Duration
    if task.started_at:
        duration_seconds = (completion_time - task.started_at).total_seconds()
        task.actual_duration = int(duration_seconds / 60)
    else:
        task.actual_duration = 0

    # Auto-Calculate Star Rating based on Time
    estimated = task.estimated_duration or 0
    actual = task.actual_duration
    
    if estimated > 0:
        delay_minutes = actual - estimated
        
        if delay_minutes <= 0:
            # On time or early = 5 Stars
            final_rating = 5
        else:
            # Late: Deduct 1 star per 10 mins
            penalty = math.ceil(delay_minutes / 10)
            final_rating = max(1, 5 - penalty)
            
        print(f"⭐ Auto-Rating: Est {estimated}m vs Act {actual}m (Delay {delay_minutes}m) -> {final_rating} Stars")
        task.quality_rating = final_rating
    else:
        # Fallback if no estimate
        task.quality_rating = complete_data.quality_rating or 5

    # Update Status
    task.status = TaskStatus.COMPLETED
    task.completed_at = completion_time
    
    # Update Completion Details
    task.completion_notes = complete_data.completion_notes
    if complete_data.signature_url:
        task.signature_url = complete_data.signature_url
    
    # Location update on complete
    if complete_data.latitude is not None:
        task.latitude = complete_data.latitude
    if complete_data.longitude is not None:
        task.longitude = complete_data.longitude

    db.commit()
    db.refresh(task)

    # Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_COMPLETE",
        target_resource=f"Task #{task.id}",
        details=f"Duration: {task.actual_duration}m, Auto-Rating: {task.quality_rating}⭐"
    )
    db.add(audit)
    db.commit()

    # Broadcast
    response_task = TaskWithUsers(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        is_multi_destination=task.is_multi_destination,
        destinations=task.destinations,
        location_name=task.location_name,
        latitude=task.latitude,
        longitude=task.longitude,
        address=task.address,
        estimated_duration=task.estimated_duration,
        due_date=task.due_date,
        status=task.status,
        assigned_to=task.assigned_to,
        created_by=task.created_by,
        actual_duration=task.actual_duration,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completion_notes=task.completion_notes,
        quality_rating=task.quality_rating,
        signature_url=task.signature_url,
        stop_proofs=task.stop_proofs, # ✅ Include in response
        assigned_user_name=task.assigned_user.full_name if task.assigned_user else None,
        created_user_name=task.created_user.full_name if task.created_user else None,
    )

    await manager.broadcast_json({
        "event": "task_completed",
        "task_id": task.id
    })

    # ✅ Auto-start next queued task
    await auto_start_next_task(current_user.id, db)

    return response_task


@router.post("/{task_id}/cancel", response_model=TaskWithUsers)
async def cancel_task(
    task_id: int,
    cancel_data: TaskCancel,
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

    # Only assigned user, creator, or admin/supervisor can cancel
    if (task.assigned_to != current_user.id and 
        task.created_by != current_user.id and 
        current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this task"
        )

    # Update status
    previous_status = task.status
    task.status = TaskStatus.CANCELLED
    task.completion_notes = f"CANCELLED: {cancel_data.cancellation_reason}"
    task.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_CANCEL",
        target_resource=f"Task #{task.id}",
        details=f"Status: {previous_status} -> CANCELLED. Reason: {cancel_data.cancellation_reason}"
    )
    db.add(audit)
    db.commit()

    # Real-time Broadcast Audit Log
    await manager.broadcast_json({
        "event": "audit_log_created",
        "log": {
            "id": audit.id,
            "action": audit.action,
            "target_resource": audit.target_resource,
            "details": audit.details,
            "timestamp": audit.timestamp.isoformat(),
            "user_email": current_user.email
        }
    })

    # Construct response
    response_task = TaskWithUsers(
        id=task.id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        is_multi_destination=task.is_multi_destination,
        destinations=task.destinations,
        location_name=task.location_name,
        latitude=task.latitude,
        longitude=task.longitude,
        address=task.address,
        estimated_duration=task.estimated_duration,
        due_date=task.due_date,
        status=task.status,
        assigned_to=task.assigned_to,
        created_by=task.created_by,
        actual_duration=task.actual_duration,
        started_at=task.started_at,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completion_notes=task.completion_notes,
        quality_rating=task.quality_rating,
        signature_url=task.signature_url,
        photo_urls=task.photo_urls,
        assigned_user_name=task.assigned_user.full_name if task.assigned_user else None,
        created_user_name=task.created_user.full_name if task.created_user else None,
    )

    # Real-time Broadcast Task Update
    await manager.broadcast_json({
        "event": "task_updated", 
        "task": response_task.model_dump_json()
    })

    # ✅ Auto-start next queued task if this was in progress
    if previous_status == TaskStatus.IN_PROGRESS:
        await auto_start_next_task(current_user.id, db)

    return response_task


# ============================================================================
# TASK STATUS CHANGE OPERATIONS
# ============================================================================

@router.post("/{task_id}/accept", response_model=TaskWithUsers)
async def accept_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Accept a task and queue it (if user has active task) or start it immediately"""
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if user has an active task
    active_task = db.query(Task).filter(
        Task.assigned_to == current_user.id,
        Task.status == TaskStatus.IN_PROGRESS
    ).first()

    if not active_task:
        # No active task, can start immediately - but queue it and user must manually start
        pass

    task.status = TaskStatus.QUEUED
    db.commit()
    db.refresh(task)

    # Audit & Broadcast
    audit = AuditLog(
        user_id=current_user.id, 
        action="TASK_QUEUE", 
        target_resource=f"Task #{task.id}", 
        details="User accepted/queued task"
    )
    db.add(audit)
    db.commit()

    response_task = TaskWithUsers.model_validate(task)
    await manager.broadcast_json({
        "event": "task_updated", 
        "task": response_task.model_dump_json()
    })
    
    return response_task


@router.post("/{task_id}/decline", response_model=TaskWithUsers)
async def decline_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Decline a pending task"""
    task = db.query(Task).options(
        joinedload(Task.assigned_user),
        joinedload(Task.created_user)
    ).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only decline pending tasks")

    task.status = TaskStatus.DECLINED
    db.commit()
    db.refresh(task)

    # Audit & Broadcast
    audit = AuditLog(
        user_id=current_user.id, 
        action="TASK_DECLINE", 
        target_resource=f"Task #{task.id}", 
        details="User declined task"
    )
    db.add(audit)
    db.commit()
    
    response_task = TaskWithUsers.model_validate(task)
    await manager.broadcast_json({
        "event": "task_updated", 
        "task": response_task.model_dump_json()
    })
    
    return response_task


# ============================================================================
# FILE UPLOAD OPERATIONS
# ============================================================================

@router.post("/{task_id}/signature")
async def upload_signature(
    task_id: int,
    signature: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload task completion signature"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate unique filename
    file_extension = signature.filename.split('.')[-1] if '.' in signature.filename else 'png'
    unique_filename = f"signature_{task_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await signature.read()
        buffer.write(content)
    
    # Update task with signature URL
    task.signature_url = f"/static/signatures/{unique_filename}"
    db.commit()
    db.refresh(task)
    
    print(f"✅ Signature saved: {task.signature_url}")
    
    return {
        "message": "Signature uploaded successfully",
        "signature_url": task.signature_url
    }


@router.post("/{task_id}/photo")
async def upload_photo(
    task_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload task completion photo"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate unique filename
    file_extension = photo.filename.split('.')[-1] if '.' in photo.filename else 'jpg'
    unique_filename = f"photo_{task_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = PHOTO_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        content = await photo.read()
        buffer.write(content)
    
    photo_url = f"/static/photos/{unique_filename}"
    
    # Store photo URL in task
    if task.photo_urls is None:
        task.photo_urls = []
    
    # Append to existing photos
    task.photo_urls = task.photo_urls + [photo_url]
    
    db.commit()
    db.refresh(task)
    
    print(f"✅ Photo saved and added to task: {photo_url}")
    
    return {
        "message": "Photo uploaded successfully",
        "photo_url": photo_url,
        "total_photos": len(task.photo_urls)
    }