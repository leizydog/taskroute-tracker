from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db  # Remove 'backend.' prefix
from app.models.user import User  # Remove 'backend.' prefix
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, Token, UserLogin  # Remove 'backend.' prefix
from app.core.auth import (  # Remove 'backend.' prefix
    get_password_hash,
    authenticate_user,
    create_access_token,
    get_current_admin_user,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
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
    
    # Assuming the default role for new registrations is 'user' 
    # and that the role attribute on the SQL model is the string or the Enum value.
    
    # --- START OF CHANGE ---
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        # Ensure the role is explicitly set. 
        # If your User model defaults role to 'user', this is optional but good practice.
        # If user_data contains a role, use it: user_data.role.value 
        # If you want to force 'user' on registration:
        role=UserRole.USER 
    )
    # --- END OF CHANGE ---
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # If your User model uses a Python Enum for the role, the returned db_user 
    # will correctly serialize because FastAPI handles Pydantic's serialization of model objects.
    
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
        # ✅ FIX: Include the user's role in the JWT data payload
        # ✅ FIX: Convert user.role to a string (use .value if it's a standard Python Enum)
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
        # ✅ FIX: Include the user's role in the JWT data payload
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
    # 🎯 APPLY THE ADMIN DEPENDENCY HERE 
    dependencies=[Depends(get_current_admin_user)]
)
def create_admin_user(
    user_data: UserCreate, 
    db: Session = Depends(get_db), 
    # The actual current_user object is consumed by the dependency above, 
    # we don't need it here, but the dependency runs first!
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
        # ✅ FIX: Use the role from the input data, as it's a controlled endpoint
        role=user_data.role # Pydantic converts "admin" string to UserRole.ADMIN
    )
    
    # 3. Commit
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post(
    "/supervisor", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
    # 🎯 Protection: Only allow users with the ADMIN role
    dependencies=[Depends(get_current_admin_user)]
)
def register_supervisor(
    user_data: UserCreate, 
    db: Session = Depends(get_db)
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
        # ✅ Core Logic: Explicitly set the role to MANAGER
        role=user_data.role
    )
    
    # 3. Commit
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user