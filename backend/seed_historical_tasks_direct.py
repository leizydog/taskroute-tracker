# seed_historical_tasks_direct.py
"""
Directly seed historical tasks into the database.
Uses the users created in seed_data.py for assigned_to.
Task durations are set based on employee performance tier:
- Top Performers: 30-40 minutes average
- Mid Performers: 40-50 minutes average
- Poor Performers: 50-60 minutes average
"""

import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.task import Task, TaskStatus, TaskPriority

# Map old IDs from seed_data.py to actual database IDs
# (Ensure these match your actual DB IDs after running seed_data.py)
USER_IDS = {
    101: 2,  # Maria Dela Cruz (Top)
    102: 3,  # James Rodriguez (Top)
    201: 4,  # Carlo Ramos (Mid)
    202: 5,  # Lisa Mendoza (Mid)
    203: 6,  # Pedro Garcia (Mid)
    301: 7,  # Tony Santos (Poor)
    302: 8,  # Nina Torres (Poor)
}

# Admin/system user who creates historical tasks
CREATOR_ID = 1

# Task templates (with baseline info, duration will be overridden)
TASK_TEMPLATES = [
    {"title": "Electrical inspection", "location_name": "Makati Office", "latitude": 14.5547, "longitude": 121.0244},
    {"title": "HVAC maintenance", "location_name": "Ortigas Center", "latitude": 14.5866, "longitude": 121.0582},
    {"title": "Plumbing repair", "location_name": "Quezon City Office", "latitude": 14.6507, "longitude": 121.0494},
    {"title": "Security camera installation", "location_name": "BGC Tower", "latitude": 14.5518, "longitude": 121.0475},
    {"title": "Equipment delivery", "location_name": "Alabang Branch", "latitude": 14.4198, "longitude": 121.0395},
]

def generate_tasks():
    """
    Generate historical tasks for each user over past 30 days.
    Completed tasks will have realistic timestamps and actual_duration.
    Average durations vary by performance tier:
    - Top: 30-40 minutes
    - Mid: 40-50 minutes
    - Poor: 50-60 minutes
    """
    tasks = []
    now = datetime.now()
    
    for old_id, user_id in USER_IDS.items():
        # Define tier-based performance characteristics
        if old_id in [101, 102]:
            # TOP PERFORMERS: Fast and efficient (30-40 min average)
            completion_rate = 0.95
            quality_range = [4, 5]
            duration_min, duration_max = 30, 40  # Average duration range in minutes
            # Speed factor: 0.8 to 1.0 (Completes in 80-100% of estimated time)
            speed_min, speed_max = 0.8, 1.0 
            
        elif old_id in [201, 202, 203]:
            # MID PERFORMERS: Average speed (40-50 min average)
            completion_rate = 0.85
            quality_range = [3, 4, 5]
            duration_min, duration_max = 40, 50  # Average duration range in minutes
            # Speed factor: 0.9 to 1.2 (Completes in 90-120% of estimated time)
            speed_min, speed_max = 0.9, 1.2
            
        else:
            # POOR PERFORMERS: Slow and unreliable (50-60 min average)
            completion_rate = 0.60
            quality_range = [2, 3]
            duration_min, duration_max = 50, 60  # Average duration range in minutes
            # Speed factor: 1.1 to 1.5 (Takes 10-50% longer than estimated)
            speed_min, speed_max = 1.1, 1.5

        num_tasks = int(30 * completion_rate)  # Tasks over 30 days
        
        for i in range(num_tasks):
            template = TASK_TEMPLATES[i % len(TASK_TEMPLATES)]
            
            # Spread tasks out over the last 30 days
            # Randomize the time of day between 8 AM and 4 PM to simulate work hours
            days_ago = 30 - i
            work_hour_start = random.randint(8, 16) 
            task_date = now - timedelta(days=days_ago)
            task_date = task_date.replace(hour=work_hour_start, minute=random.randint(0, 59))

            # Set estimated duration based on employee tier
            estimated_minutes = random.randint(duration_min, duration_max)
            
            # --- Calculate Realistic Actual Duration ---
            # 1. Base variance based on employee tier
            performance_factor = random.uniform(speed_min, speed_max)
            
            # 2. Add small random noise (traffic, delays, etc.) +/- 5%
            noise = random.uniform(0.95, 1.05)
            
            # 3. Calculate final duration
            actual_minutes = int(estimated_minutes * performance_factor * noise)
            actual_duration_seconds = actual_minutes * 60
            
            # Calculate completed_at based on the actual duration
            completed_at = task_date + timedelta(minutes=actual_minutes)
            
            quality_rating = random.choice(quality_range)

            task = Task(
                title=f"{template['title']} - Site {i+1}",
                description=f"Historical task for KPI seeding at {template['location_name']}",
                priority=TaskPriority.MEDIUM,
                status=TaskStatus.COMPLETED,
                assigned_to=user_id,
                created_by=CREATOR_ID,
                location_name=template["location_name"],
                latitude=template["latitude"],
                longitude=template["longitude"],
                estimated_duration=estimated_minutes,  # In minutes
                actual_duration=actual_duration_seconds,  # In seconds
                started_at=task_date,
                completed_at=completed_at,
                created_at=task_date,  # Task created when started for historical accuracy
                quality_rating=quality_rating,
            )
            tasks.append(task)
            
    return tasks

def insert_tasks(tasks):
    print(f"🚀 Preparing to insert {len(tasks)} historical tasks...")
    db: Session = SessionLocal()
    try:
        # Bulk save is faster for large datasets
        db.bulk_save_objects(tasks)
        db.commit()
        print(f"✅ Successfully inserted {len(tasks)} tasks into the database.")
        print("📊 Data distribution generated:")
        print("   - Top Performers: 30-40 min tasks, 0.8x-1.0x speed (24-40 min actual)")
        print("   - Mid Performers: 40-50 min tasks, 0.9x-1.2x speed (36-60 min actual)")
        print("   - Poor Performers: 50-60 min tasks, 1.1x-1.5x speed (55-90 min actual)")
    except Exception as e:
        print(f"❌ Error inserting tasks: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    tasks = generate_tasks()
    insert_tasks(tasks)