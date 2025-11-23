from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path
import uuid

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse
from app.core.auth import get_current_active_user, get_current_admin
from app.models.task import Task
# ✅ Import AuditLog
from app.models.audit import AuditLog
# ✅ Import Manager for WebSocket
from app.websocket_manager import manager

router = APIRouter(tags=["Users"])

# ✅ Setup Avatar Directory
AVATAR_DIR = Path("static/avatars")
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

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


# -----------------------
# 👤 User Management & Profile
# -----------------------

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int, 
    user_update: dict, 
    db: Session = Depends(get_db),
    # ✅ Update: Require Admin permission to update other users via this endpoint
    admin: User = Depends(get_current_admin) 
):
    """
    Admin endpoint to update any user's generic details (including roles/active status)
    """
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


@router.put("/users/{user_id}/profile")
async def update_user_profile(
    user_id: int,
    profile_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update user profile (name, phone, etc.).
    Users can update their own profile.
    """
    # Permission check
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this user's profile"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Track changes
    changes = []
    allowed_fields = ['full_name', 'phone']
    
    for key, value in profile_data.items():
        if key in allowed_fields:
            old_val = getattr(user, key, None)
            if old_val != value:
                setattr(user, key, value)
                changes.append(f"{key}: {old_val} -> {value}")
    
    if changes:
        db.commit()
        db.refresh(user)
        
        # Audit Log
        audit = AuditLog(
            user_id=current_user.id,
            action="USER_PROFILE_UPDATE",
            target_resource=f"User #{user_id} ({user.username})",
            details=", ".join(changes)
        )
        db.add(audit)
        db.commit()

        await manager.broadcast_json({
            "event": "user_profile_updated",
            "user_id": user_id
        })
    
    return {
        "message": "Profile updated successfully",
        "user": UserResponse.from_orm(user)
    }


@router.post("/users/{user_id}/avatar")
async def upload_avatar(
    user_id: int,
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload user avatar image.
    Users can only upload their own avatar unless they're admin.
    """
    # Permission check: user can update their own, or admin can update anyone's
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="Not authorized to update this user's avatar"
        )
    
    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate file type
    allowed_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
    file_extension = avatar.filename.split('.')[-1].lower() if '.' in avatar.filename else ''
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # ✅ DELETE OLD AVATAR FILE FIRST
    if user.avatar_url:
        try:
            # Extract filename from URL (e.g., "/static/avatars/avatar_12_abc123.jpg")
            old_filename = user.avatar_url.split('/')[-1]
            old_file_path = AVATAR_DIR / old_filename
            
            if old_file_path.exists():
                old_file_path.unlink()
                print(f"🗑️  Deleted old avatar: {old_file_path}")
        except Exception as e:
            # Don't fail the upload if deletion fails
            print(f"⚠️  Could not delete old avatar: {e}")
    
    # Generate unique filename
    unique_filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = AVATAR_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            content = await avatar.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save avatar: {str(e)}"
        )
    
    # Update user with new avatar URL
    user.avatar_url = f"/static/avatars/{unique_filename}"
    db.commit()
    db.refresh(user)
    
    print(f"✅ Avatar uploaded for user {user_id}: {user.avatar_url}")
    
    # Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_AVATAR_UPDATE",
        target_resource=f"User #{user_id} ({user.username})",
        details=f"Avatar updated: {unique_filename}"
    )
    db.add(audit)
    db.commit()

    # Broadcast if needed
    await manager.broadcast_json({
        "event": "user_avatar_updated",
        "user_id": user_id,
        "avatar_url": user.avatar_url
    })
    
    return {
        "message": "Avatar uploaded successfully",
        "avatar_url": user.avatar_url
    }


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