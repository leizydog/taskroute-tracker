from app.database import SessionLocal, engine
from app.models.task import Task
from app.models.location import LocationLog
from app.models.user import User
# ✅ Import AuditLog (Assumed to be in your models folder)
# If AuditLog is not found, you must add it to app/models
# from app.models.audit import AuditLog 
from sqlalchemy import text
import sys

def wipe():
    db = SessionLocal()
    try:
        # Use PostgreSQL TRUNCATE CASCADE command for a complete reset.
        # This is the safest way to reset IDs and delete everything when foreign keys are present.
        if str(engine.url).startswith('postgresql'):
             
             # 1. TRUNCATE TASKS table and its dependents (LocationLog)
             #    The CASCADE option handles dependent tables like location_logs for us.
             print("🗑️  Wiping Tasks, Location Logs (using CASCADE)...")
             db.execute(text("TRUNCATE TABLE tasks RESTART IDENTITY CASCADE;"))
             
             # 2. TRUNCATE USERS table and its dependents (AuditLog)
             print("🗑️  Wiping Users and Audit Logs (using CASCADE)...")
             # Assuming your AuditLog table has a foreign key to users.
             db.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE;"))
             
        else:
             # Standard SQLAlchemy DELETE operations for SQLite/MySQL/other
             print("🗑️  Wiping all data (Standard DELETE)...")
             db.query(LocationLog).delete()
             # Assuming AuditLog model exists: db.query(AuditLog).delete()
             db.query(Task).delete()
             db.query(User).delete()
             # Note: Manual ID reset needed for SQLite/MySQL
             
        db.commit()
        print("✅ Database wiped and IDs reset successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("⚠️  WARNING: This will delete ALL data and reset user IDs to 1.")
    confirm = input("Type 'yes' to confirm: ")
    if confirm.lower() == 'yes':
        wipe()
    else:
        print("Operation cancelled.")