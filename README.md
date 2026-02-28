# TaskRoute Tracker

A GPS-enabled task management and route tracking application with ML-powered ETA predictions, real-time location monitoring, and multi-platform support.

---

## Overview

TaskRoute Tracker is a full-stack application designed to help teams manage field tasks efficiently. Admins can assign tasks with location data, track field workers in real-time via GPS, and review ML-predicted ETAs. Field workers access their assignments through a mobile app, while managers monitor everything on a web dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, TailwindCSS |
| **Backend** | FastAPI (Python), PostgreSQL + PostGIS |
| **Mobile** | Flutter (Android & iOS) |
| **ML** | Prophet, XGBoost |
| **Real-time** | WebSockets |
| **Deployment** | Docker, Docker Compose |

---

## Features

- 📍 **GPS Tracking** — Real-time location updates for field workers via WebSocket
- 🔐 **Role-Based Login** — Admin, dispatcher, and field worker roles with JWT authentication
- 📋 **Task Management** — Create, assign, update, and archive tasks with location tagging
- 🤖 **ML Predictions** — ETA and task duration forecasting using trained Prophet/XGBoost models
- 📊 **Analytics Dashboard** — Task completion rates, agent performance, and route reports
- 📱 **Mobile App** — Flutter app for field workers to view and update their assigned tasks
- 🗺️ **Route Monitoring** — Visual map of active routes and task locations
- 📄 **Reports** — Exportable task and performance reports

---

## Screenshots

> _Add screenshots of your app here. Place images in a `/screenshots` folder and reference them below._

| Dashboard | Task Management | Mobile App |
|---|---|---|
| _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

---

## Installation

### Prerequisites

Make sure you have the following installed:

- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [Flutter SDK](https://docs.flutter.dev/get-started/install)
- [Docker & Docker Compose](https://www.docker.com/)
- [PostgreSQL](https://www.postgresql.org/) with PostGIS extension

---

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/taskroute-tracker.git
cd taskroute-tracker
```

---

### 2. Backend (FastAPI)

```bash
cd backend
```

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/taskroutedb
SECRET_KEY=your_secret_key
GOOGLE_DIRECTIONS_API_KEY=your_google_api_key
```

Install dependencies and run:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

### 3. Frontend (React)

```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000`.

---

### 4. Mobile App (Flutter)

```bash
cd taskroute_mobile
flutter pub get
flutter run
```

> Make sure your device/emulator is connected and the backend URL in `.env` points to your running backend.

---

### 5. Run with Docker (Recommended)

To spin up the entire stack (backend + database) using Docker:

```bash
docker-compose up --build
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT secret key |
| `GOOGLE_DIRECTIONS_API_KEY` | Google Maps Directions API key for route data |

---

## License

This project is licensed under the [MIT License](LICENSE).
