# seed_historical_tasks_direct.py
"""
Directly seed historical tasks into the database.
Uses the users created in seed_data.py for assigned_to.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.task import Task, TaskStatus, TaskPriority

# Map old IDs from seed_data.py to actual database IDs
USER_IDS = {
    101: 2,  # Maria Dela Cruz
    102: 3,  # James Rodriguez
    201: 4,  # Carlo Ramos
    202: 5,  # Lisa Mendoza
    203: 6,  # Pedro Garcia
    301: 7,  # Tony Santos
    302: 8,  # Nina Torres
}

# Admin/system user who creates historical tasks
CREATOR_ID = 1

# Task templates
TASK_TEMPLATES = [
    {"title": "Electrical inspection", "location_name": "Makati Office", "latitude": 14.5547, "longitude": 121.0244, "duration": 120},
    {"title": "HVAC maintenance", "location_name": "Ortigas Center", "latitude": 14.5866, "longitude": 121.0582, "duration": 180},
    {"title": "Plumbing repair", "location_name": "Quezon City Office", "latitude": 14.6507, "longitude": 121.0494, "duration": 90},
    {"title": "Security camera installation", "location_name": "BGC Tower", "latitude": 14.5518, "longitude": 121.0475, "duration": 150},
    {"title": "Equipment delivery", "location_name": "Alabang Branch", "latitude": 14.4198, "longitude": 121.0395, "duration": 60},
]

def generate_tasks():
    """
    Generate historical tasks for each user over past 30 days.
    Completed tasks will have realistic timestamps and actual_duration.
    """
    tasks = []
    now = datetime.now()
    
    for old_id, user_id in USER_IDS.items():
        # Define tier-based completion rate
        if old_id in [101, 102]:
            completion_rate = 0.95  # top performers
            quality_range = [4, 5]
        elif old_id in [201, 202, 203]:
            completion_rate = 0.75  # mid performers
            quality_range = [3, 4]
        else:
            completion_rate = 0.5   # poor performers
            quality_range = [2, 3]

        num_tasks = int(30 * completion_rate)  # roughly one task per day per rate
        
        for i in range(num_tasks):
            template = TASK_TEMPLATES[i % len(TASK_TEMPLATES)]
            task_date = now - timedelta(days=30 - i)

            actual_duration = int(template["duration"] * 60)  # seconds
            completed_at = task_date + timedelta(hours=template["duration"] / 60)
            quality_rating = quality_range[i % len(quality_range)]

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
                estimated_duration=template["duration"],
                actual_duration=actual_duration,
                started_at=task_date,
                completed_at=completed_at,
                created_at=task_date,
                quality_rating=quality_rating,
            )
            tasks.append(task)
    return tasks

def insert_tasks(tasks):
    db: Session = SessionLocal()
    for task in tasks:
        db.add(task)
    db.commit()
    db.close()
    print(f"✅ Inserted {len(tasks)} historical tasks into the database.")

if __name__ == "__main__":
    tasks = generate_tasks()
    insert_tasks(tasks)
