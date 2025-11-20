from app.database import SessionLocal, engine
from app.models.task import Task
from app.models.location import LocationLog
from app.models.user import User
from sqlalchemy import text
import sys

def wipe():
    db = SessionLocal()
    try:
        print("🗑️  Wiping Tasks and Location Logs...")
        # Order matters due to foreign keys
        db.query(LocationLog).delete()
        db.query(Task).delete()
        
        print("🗑️  Wiping Users...")
        # Delete everyone. You will need to re-seed the admin account.
        db.query(User).delete()
        
        # RESET ID SEQUENCE (PostgreSQL specific)
        print("🔄 Resetting User ID sequence...")
        # This resets the primary key counter for users to 1
        db.execute(text("TRUNCATE TABLE users RESTART IDENTITY CASCADE;"))
        
        # If you are using SQLite instead of Postgres, comment out the line above and use this instead:
        # db.execute(text("DELETE FROM sqlite_sequence WHERE name='users';"))

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