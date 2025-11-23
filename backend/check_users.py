# check_users.py
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"ID: {u.id} | Name: {u.full_name} | Role: {u.role}")
db.close()
