from datetime import timedelta
from app.core.email import send_reset_email
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
import shutil
from pathlib import Path
from jose import jwt, JWTError # ✅ Added

from app.database import get_db
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.websocket_manager import manager
from app.schemas.user import (
    UserCreate, UserResponse, Token, UserLogin, UserUpdate, PasswordChange,
    PasswordResetRequest, PasswordResetConfirm # ✅ Added
)
from app.core.auth import (
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_current_admin_user,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    RESET_TOKEN_EXPIRE_MINUTES, # ✅ Added
    SECRET_KEY, # ✅ Added
    ALGORITHM   # ✅ Added
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    
    # Check if user already exists (email)
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    # Check if the Pydantic UserCreate schema contains a role field.
    # If not, we explicitly set the default role here.
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=UserRole.USER 
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/login", response_model=Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login user and return JWT token."""
    
    # Authenticate user (form_data.username contains email in this case)
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login-json")
def login_user_json(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user with JSON payload and return JWT token with user data."""
    
    # Authenticate user
    user = authenticate_user(db, user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value}, 
        expires_delta=access_token_expires
    )
    
    # Return token AND user data for mobile app
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "role": user.role,
            "avatar_url": user.avatar_url, # ✅ Added avatar_url here
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat() if user.updated_at else None
        }
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return current_user


@router.get("/protected")
def protected_route(current_user: User = Depends(get_current_active_user)):
    """Example protected route that requires authentication."""
    return {
        "message": f"Hello {current_user.full_name}! This is a protected route.",
        "user_id": current_user.id,
        "role": current_user.role.value
    }


@router.post(
    "/admin/user", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_user(
    user_data: UserCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_admin_user)
):
    """
    Creates a new user with any specified role (Admin ONLY endpoint).
    """
    # 1. Validation Checks (re-use from register_user)
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    # 2. Hashing and Creation
    hashed_password = get_password_hash(user_data.password)
    
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role
    )
    
    # 3. Commit
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # ✅ Audit Log: Admin created a user
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_CREATE_ADMIN",
        target_resource=f"User #{db_user.id} ({db_user.username})",
        details=f"Role: {db_user.role.value}"
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
    
    return db_user

@router.post(
    "/supervisor", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
)
async def register_supervisor(
    user_data: UserCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Creates a new supervisor (MANAGER role). 
    Accessible ONLY by a logged-in ADMIN user.
    """
    
    # 1. Validation Checks (same as general registration)
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # 2. Hashing and Creation
    hashed_password = get_password_hash(user_data.password)
    
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role
    )
    
    # 3. Commit
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # ✅ Audit Log: Supervisor Created
    audit = AuditLog(
        user_id=current_user.id,
        action="USER_CREATE_SUPERVISOR",
        target_resource=f"User #{db_user.id} ({db_user.username})",
        details=f"Role: {db_user.role.value}"
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
    
    return db_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update current user profile"""
    
    # Check if email is being changed and if it's already taken
    if user_update.email and user_update.email != current_user.email:
        existing_user = db.query(User).filter(User.email == user_update.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Check if username is being changed and if it's already taken
    if user_update.username and user_update.username != current_user.username:
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Update only provided fields
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        # Don't allow role change through this endpoint
        if field != 'role':
            setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.put("/me/password")
def change_password(
    password_data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user password"""
    from app.core.auth import verify_password, get_password_hash
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate new password
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long"
        )
    
    # Don't allow same password
    if verify_password(password_data.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}

# ✅ NEW: Forgot Password Endpoint
@router.post("/forgot-password")
async def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        return {"message": "If the email exists, a reset link has been sent."}

    expires = timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    reset_token = create_access_token(
        data={"sub": user.email, "type": "reset"},
        expires_delta=expires
    )
    
    reset_link = f"http://192.168.102.41:3000/reset-password?token={reset_token}"

    # ✅ SEND REAL EMAIL
    try:
        await send_reset_email(user.email, reset_link)
        print(f"✅ Email sent to {user.email}")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        # In production, logging the error is enough. Don't crash the request.

    return {"message": "If the email exists, a reset link has been sent."}


# ✅ NEW: Reset Password Endpoint
@router.post("/reset-password")
async def reset_password(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Verifies the reset token and updates the user's password.
    """
    try:
        # Decode & Verify Token
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        # Ensure it's a reset token, not a login token
        if email is None or token_type != "reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
            
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    # Fetch User
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update Password
    user.hashed_password = get_password_hash(request.new_password)
    db.commit()

    # ✅ Audit Log: Password Reset
    audit = AuditLog(
        user_id=user.id,
        action="PASSWORD_RESET",
        target_resource="User Account",
        details="Password reset via email link"
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
            "user_email": user.email
        }
    })
    
    return {"message": "Password updated successfully"}

# ✅ NEW: Implemented Avatar Upload Endpoint
@router.post("/me/avatar")
def upload_avatar(
    avatar: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload user avatar and update profile."""
    
    # 1. Validate File Type
    if not avatar.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")
        
    # 2. Define Storage Path
    # We rename the file to user_id to avoid collisions
    file_extension = Path(avatar.filename).suffix or ".png"
    filename = f"user_{current_user.id}{file_extension}"
    
    # Ensure directory exists (matches main.py config)
    save_path = Path("static/avatars")
    save_path.mkdir(parents=True, exist_ok=True)
    
    file_location = save_path / filename
    
    # 3. Save File
    try:
        with file_location.open("wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)
    except Exception as e:
        raise HTTPException(500, detail=f"Could not save file: {str(e)}")
        
    # 4. Update Database
    # The URL must match the mount point in main.py ("/static")
    avatar_url = f"/static/avatars/{filename}"
    
    current_user.avatar_url = avatar_url
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Avatar updated", "avatar_url": avatar_url}