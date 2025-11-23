import pandas as pd
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.task import Task, TaskStatus
from app.models.location import LocationLog
from app.models.user import User
from dotenv import load_dotenv

# 1. Setup
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/taskroute")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def export_data():
    print("📥 Fetching completed tasks...")
    
    # 2. Get tasks that are done and have duration data
    tasks = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED,
        Task.actual_duration.isnot(None)
    ).all()

    data = []
    
    for t in tasks:
        # 3. Find the Start Location (from Task or LocationLogs)
        # If actual_start_lat is missing in Task, try to find the 'task_start' log
        start_lat = t.actual_start_lat
        start_lng = t.actual_start_lng
        
        if not start_lat:
            start_log = db.query(LocationLog).filter(
                LocationLog.task_id == t.id,
                LocationLog.location_type == 'task_start'
            ).first()
            if start_log:
                start_lat = start_log.latitude
                start_lng = start_log.longitude

        # 4. Map DB fields to Notebook CSV columns
        row = {
            'ParticipantID': f"P{t.assigned_to:03d}",
            'City': t.city or "Unknown",
            'Conditions': t.weather_conditions or "Normal",
            'Method': t.transport_method or "Drive",
            'Date': t.started_at.strftime('%Y-%m-%d') if t.started_at else None,
            'StartTime': t.started_at,
            'EndTime': t.completed_at,
            'Duration_min': t.actual_duration,
            'Success': 'Yes', # Assuming completed tasks are successful
            'Latitude': t.latitude,   # Task Destination
            'Longitude': t.longitude, # Task Destination
            'EmployeeStartLat': start_lat,
            'EmployeeStartLng': start_lng
        }
        data.append(row)

    # 5. Save to CSV
    df = pd.DataFrame(data)
    output_file = "performance_dataset_updated.csv"
    df.to_csv(output_file, index=False)
    print(f"✅ Exported {len(df)} rows to {output_file}")
    print(f"   You can now upload this file to your Colab Notebook.")

if __name__ == "__main__":
    export_data()