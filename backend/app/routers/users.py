from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserResponse
from app.core.auth import get_current_active_user, get_current_admin
from app.models.task import Task
# ✅ Import AuditLog
from app.models.audit import AuditLog
# ✅ Import Manager for WebSocket
from app.websocket_manager import manager

router = APIRouter(tags=["Users"])

@router.get("/users/", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    users = db.query(User).all()
    return users


# -----------------------
# 🔥 Admin Wipe Endpoints
# -----------------------

@router.delete("/users/admin/wipe-users")
async def wipe_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    count = db.query(User).filter(User.id != admin.id).delete()
    db.commit()
    
    # ✅ Audit Log
    audit = AuditLog(
        user_id=admin.id,
        action="SYSTEM_WIPE_USERS",
        target_resource="All Users",
        details=f"Admin deleted {count} users (Admin account preserved)"
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
            "user_email": admin.email
        }
    })
    
    return {"message": "All users deleted"}


@router.delete("/users/admin/wipe-tasks")
async def wipe_all_tasks(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    count = db.query(Task).delete()
    db.commit()
    
    # ✅ Audit Log
    audit = AuditLog(
        user_id=admin.id,
        action="SYSTEM_WIPE_TASKS",
        target_resource="All Tasks",
        details=f"Admin deleted {count} tasks"
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
            "user_email": admin.email
        }
    })

    return {"message": "All tasks deleted"}


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int, 
    user_update: dict, 
    db: Session = Depends(get_db),
    # ✅ Update: Require Admin permission to update other users
    admin: User = Depends(get_current_admin) 
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Track changes and detect Archiving/Restoring
    changes = []
    action_type = "USER_UPDATE" # Default action

    for key, value in user_update.items():
        old_val = getattr(user, key, None)
        if old_val != value:
            setattr(user, key, value)
            changes.append(f"{key}: {old_val} -> {value}")
            
            # ✅ Detect Archive/Restore Actions
            if key == "is_active":
                if value is False:
                    action_type = "USER_ARCHIVE"
                elif value is True:
                    action_type = "USER_RESTORE"
    
    db.commit()
    db.refresh(user)
    
    # ✅ Audit Log
    if changes:
        audit = AuditLog(
            user_id=admin.id,
            action=action_type,
            target_resource=f"User #{user.id} ({user.username})",
            details=", ".join(changes)
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
                "user_email": admin.email
            }
        })
        
    return user

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int, 
    db: Session = Depends(get_db),
    # ✅ Update: Require Admin permission to delete users
    admin: User = Depends(get_current_admin) 
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    username = user.username
    db.delete(user)
    db.commit()
    
    # ✅ Audit Log
    audit = AuditLog(
        user_id=admin.id,
        action="USER_DELETE",
        target_resource=f"User #{user_id} ({username})",
        details="User permanently deleted by admin"
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
            "user_email": admin.email
        }
    })
    
    return {"message": "User deleted"}