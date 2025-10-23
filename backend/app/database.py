import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- THIS IS THE FIX ---
# 1. Read the database URL from the environment (for Docker)
DATABASE_URL = os.environ.get("DATABASE_URL")

# 2. If it's not set (e.g., running locally), use your default
if DATABASE_URL is None:
    print("WARNING: DATABASE_URL not set, using local default 'localhost:5433'.")
    DATABASE_URL = "postgresql://postgres:password@localhost:5433/taskroute"
# --- END OF FIX ---


# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()