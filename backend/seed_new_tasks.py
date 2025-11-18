#!/usr/bin/env python3
"""
Standalone script to add a few new, pending tasks for immediate testing.
This requires an existing Admin user to be set up.
"""

import requests
import argparse
from datetime import datetime, timedelta, timezone

# --- CONFIGURATION ---
DEFAULT_BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@company.com"
ADMIN_PASSWORD = "Admin123!"

# Map Old ID (from seed_data.py) to Actual Database User ID.
# **IMPORTANT: REPLACE these IDs with the actual primary keys (PKs) from your 'users' table.**
USER_ID_MAP = {
    101: 2,  # Example: Maria Dela Cruz (Top Performer)
    102: 3,  # Example: James Rodriguez (Top Performer)
    201: 4,  # Example: Carlo Ramos (Mid Performer)
    # The actual ID of the user running the script (Admin) is used for created_by
}

def print_status(message: str, status: str = "INFO"):
    """Print status messages"""
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "ERROR": "\033[91m",
        "WARNING": "\033[93m"
    }
    print(f"{colors.get(status, '')}{status}: {message}\033[0m")

def login_user(base_url: str) -> str:
    """Login admin and return access token"""
    try:
        response = requests.post(
            f"{base_url}/api/v1/auth/login-json",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        response.raise_for_status()
        token_data = response.json()
        print_status(f"Admin logged in successfully.", "SUCCESS")
        return token_data.get("access_token")
    except requests.exceptions.RequestException as e:
        print_status(f"Login failed: {e}", "ERROR")
        return None

def add_new_tasks(base_url: str, admin_token: str):
    """Adds a set of new, pending tasks via the API"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    now = datetime.now(timezone.utc)
    
    new_tasks_data = [
        {
            "title": "Urgent Server Rack Patching - Q.C.",
            "description": "Install new ethernet patch cables for QA servers on the 3rd floor.",
            "priority": "urgent",
            "location_name": "Quezon City Datacenter",
            "latitude": 14.6507,
            "longitude": 121.0494,
            "estimated_duration": 90,
            "due_date": (now + timedelta(hours=3)).isoformat(),
            "assigned_to": USER_ID_MAP[101] # Maria Dela Cruz
        },
        {
            "title": "Quarterly Fleet Vehicle Inspection",
            "description": "Perform safety checks on Truck #5 and Van #2.",
            "priority": "medium",
            "location_name": "Company Warehouse",
            "latitude": 14.5814,
            "longitude": 121.0509,
            "estimated_duration": 180,
            "due_date": (now + timedelta(days=2)).isoformat(),
            "assigned_to": USER_ID_MAP[201] # Carlo Ramos
        },
        {
            "title": "New Employee Onboarding Setup - BGC",
            "description": "Set up new workstation and deploy software packages for incoming staff.",
            "priority": "low",
            "location_name": "BGC Tower 2",
            "latitude": 14.5518,
            "longitude": 121.0475,
            "estimated_duration": 60,
            "due_date": (now + timedelta(days=7)).isoformat(),
            "assigned_to": USER_ID_MAP[102] # James Rodriguez
        }
    ]
    
    count = 0
    for task_data in new_tasks_data:
        try:
            response = requests.post(f"{base_url}/api/v1/tasks/", json=task_data, headers=headers)
            response.raise_for_status()
            task_info = response.json()
            print_status(f"✅ Added Task ID {task_info['id']}: {task_data['title']}", "SUCCESS")
            count += 1
        except requests.exceptions.HTTPError as e:
            print_status(f"Failed to add task '{task_data['title']}': {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            print_status(f"An unexpected error occurred: {e}", "ERROR")

    print_status(f"\nCompleted. {count} new tasks added.", "INFO")


def main():
    parser = argparse.ArgumentParser(description="Seed new active tasks.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Base URL for API")
    args = parser.parse_args()
    
    base_url = args.base_url.rstrip("/")
    
    print_status("Starting new task seeding...", "INFO")
    
    admin_token = login_user(base_url)
    
    if admin_token:
        add_new_tasks(base_url, admin_token)

if __name__ == "__main__":
    main()