from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.location import LocationLog
# ✅ Import AuditLog
from app.models.audit import AuditLog
from app.schemas.location import LocationLogCreate
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskStart,
    TaskComplete, TaskWithUsers, TaskStats, OngoingTasksByUser, UserWithOngoingTask
)
from app.core.auth import get_current_active_user
from app.websocket_manager import manager
import json
from pathlib import Path
import uuid

router = APIRouter(prefix="/tasks", tags=["Tasks"])

UPLOAD_DIR = Path("static/signatures")
PHOTO_DIR = Path("static/photos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PHOTO_DIR.mkdir(parents=True, exist_ok=True)


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

    # --- ✅ START OF FIX ---
    # Convert Pydantic model to a dictionary
    task_dict = task_data.dict()
    
    # Manually serialize 'destinations' to a JSON string if it exists
    if task_dict.get("destinations"):
        task_dict["destinations"] = json.dumps(task_dict["destinations"])
    
    db_task = Task(
        **task_dict,  # Use the modified dictionary instead of task_data.dict()
        created_by=current_user.id
    )

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # ✅ Audit Log: Task Creation
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_CREATE",
        target_resource=f"Task #{db_task.id}",
        details=f"Title: {db_task.title}, Assigned to: {assigned_user.full_name}"
    )
    db.add(audit)
    db.commit()

    # ⚡ Real-time Audit Broadcast
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
            # ✅ FIX: Safe navigation with 'if' check to prevent crashes
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

    # ✅ Audit Log: Task Update
    if changes:
        audit = AuditLog(
            user_id=current_user.id,
            action="TASK_UPDATE",
            target_resource=f"Task #{task.id}",
            details=", ".join(changes)[:500]  # Truncate if too long
        )
        db.add(audit)
        db.commit()

        # ⚡ Real-time Audit Broadcast
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
                task.status = TaskStatus(status_value)
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
        db_location_log = LocationLog(**location_log_data.model_dump(), user_id=current_user.id)
        db.add(db_location_log)

    # Update task status and start time
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # ✅ Audit Log: Task Started
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_START",
        target_resource=f"Task #{task.id}",
        details=f"Started by user. Loc: {start_data.latitude},{start_data.longitude}"
    )
    db.add(audit)
    db.commit()

    # ⚡ Real-time Audit Broadcast
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

    # ✅ FIX: Use model_validate instead of **task.__dict__
    # ✅ Manually construct with relationship data
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only complete tasks assigned to you")
    
    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task must be in progress to be completed")

    # Calculate Duration
    completion_time = datetime.utcnow()
    if task.started_at:
        duration_seconds = (completion_time - task.started_at).total_seconds()
        task.actual_duration = int(duration_seconds / 60)

    # Update Status
    task.status = TaskStatus.COMPLETED
    task.completed_at = completion_time
    
    # Update Completion Details
    task.completion_notes = complete_data.completion_notes
    task.quality_rating = complete_data.quality_rating
    task.signature_url = complete_data.signature_url # Save the signature path

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
        details=f"Duration: {task.actual_duration}m, Rating: {task.quality_rating}"
    )
    db.add(audit)
    db.commit()

    # Broadcast
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

    # ✅ FIX: Use safe construction instead of **task.__dict__
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

    await manager.broadcast_json({
        "event": "task_completed",
        "task_id": task.id
    })

    return response_task

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
    
    # ✅ FIX: Store photo URL in task
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
    
    # ✅ Audit Log: Task Deletion
    audit = AuditLog(
        user_id=current_user.id,
        action="TASK_DELETE",
        target_resource=f"Task #{task_id_to_broadcast}",
        details=f"Deleted task: {task_title}"
    )
    db.add(audit)
    db.commit()
    
    # ⚡ Real-time Audit Broadcast
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