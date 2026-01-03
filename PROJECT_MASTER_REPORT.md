# Project Master Report: Campus Ride System

> [!NOTE]
> This document provides a complete technical deep-dive into the "Campus Ride" application, covering architecture, tech stack, detailed process flows, and code structure.

---

## 1. Project Overview
**Campus Ride** is a real-time smart bus tracking and management system designed for university campuses. It allows students to track buses in real-time, view schedules, receive announcements, and interact with an AI assistant. Drivers can broadcast their location, publish schedules, and use AI to send polished announcements.

### Key Capabilities
- **Real-Time Tracking**: Sub-second location updates using WebSockets.
- **AI Integration**: Llama 3 (via Groq API) for student chat and driver assistance.
- **Hybrid Database**: SQLite for transient data (bus location) and Firebase Firestore for persistent data (schedules, user feedback).
- **Progressive Web App (PWA)**: Installable on mobile devices with Service Worker support.

---

## 2. Technology Stack

### Backend
- **Language**: Python 3.x
- **Framework**: Flask (Web Server)
- **Real-Time Engine**: Flask-SocketIO (with `gevent` for async performance)
- **Database (Relational)**: Flask-SQLAlchemy + SQLite (`buses.db`)
- **Database (NoSQL)**: Firebase Firestore (Cloud persistence)
- **AI/LLM**: Groq API (Llama 3.1 8b Instant)
- **Push Notifications**: Firebase Cloud Messaging (FCM)

### Frontend
- **Structure**: HTML5 (Jinja2 Templates)
- **Styling**: Tailwind CSS (Utility-first framework)
- **Logic**: Vanilla JavaScript (ES6 Modules)
- **Mapping**: Leaflet.js (free OpenStreetMap interface) + OSRM (Routing)
- **Libraries**: Socket.IO Client, FontAwesome (Icons)

### Deployment & Environment
- **Server**: VS Code / Localhost (Development), Render/Heroku (Production capable)
- **Dependencies**: Managed via `requirements.txt`
- **Process Manager**: `gunicorn` (Unix) or direct python execution (Windowsdev)

---

## 3. Project Structure & Architecture

```text
/
├── app.py                  # MAIN ENTRY POINT: Flask app, SocketIO events, AI routes
├── requirements.txt        # Python dependencies
├── Procfile                # Deployment command for Render/Heroku
├── serviceAccountKey.json  # Firebase Admin SDK Credentials
├── routes/                 # Blueprints for modular routing
│   ├── schedule.py         # API: Publish/Get Schedules
│   └── contact.py          # API: Contact Form Submission
├── server/
│   └── extensions.py       # Shared extensions (Firestore DB instance)
├── static/                 # Public assets
│   ├── js/                 # Modular JavaScript
│   │   ├── driver/         # Driver-specific logic (GPS, UI)
│   │   ├── student/        # Student-specific logic (Map, Tracking)
│   │   └── firebase-config.js # Frontend Firebase Config
│   └── ...                 # CSS, Images, Manifest
└── templates/              # HTML Templates (Views)
    ├── home.html           # Landing Page
    ├── driver.html         # Driver Dashboard
    ├── student.html        # Student Dashboard
    └── ...                 # Auth & Utility pages
```

---

## 4. Detailed Process Flows

### A. Authentication Flow
1.  **User Access**: Users visit `/login` or `/signup`.
2.  **Frontend Auth**: JavaScript uses `firebase.auth()` to authenticate users (Google Sign-In or Email/Password).
3.  **Client-Side Session**: Authentication state is managed client-side by Firebase.
4.  **Role Redirect**:
    *   Drivers -> `/driver`
    *   Students -> `/student`

### B. Real-Time Bus Tracking (The Core Loop)
1.  **Driver Connects**:
    *   Opens `/driver`.
    *   Socket connects to server (`@socketio.on('connect')`).
    *   GPS Logic (`static/js/driver/gps.js`) watches position.
2.  **Location Update**:
    *   Driver socket emits `driver_update` event with `{ lat, lng, speed, ... }`.
    *   **Server**: Updates `Bus` record in SQLite (`buses.db`) and commits to `LocationHistory`.
    *   **Broadcast**: Server emits `update_buses` to ALL connected clients.
3.  **Student Receives**:
    *   Student socket receives `update_buses`.
    *   Map JS updates marker position smoothly.

### C. AI-Powered Chat & Announcements
#### Student Chat
1.  Student types query in the chat widget (`/student`).
2.  POST request sent to `/api/chat`.
3.  **Server**:
    *   Constructs a "System Prompt" containing full app context (routes, features).
    *   Calls Groq API (Llama 3).
4.  returns generated response to student.

#### Driver Announcements
1.  Driver types raw text (e.g., "tyre burst").
2.  POST request sent to `/api/driver/ai-assist`.
3.  **Server (AI)**: Polishes text to professional format (e.g., "⚠️ Alert: We have a flat tire...").
4.  Driver approves and posts.
5.  **Server (Background)**:
    *   Saves to Firestore `announcements` collection.
    *   Values are synced to Students via realtime listener.

### D. Schedule Publishing
1.  Driver fills schedule form on `/driver`.
2.  POST request to `/api/schedule/publish`.
3.  Server writes to Firestore: `schedules/{bus_no}/dates/{date}`.
4.  Student view fetches this data to display timetables.

---

## 5. Setup & Installation Guide

### Prerequisites
*   Python 3.10+
*   Node.js (optional, for advanced asset management)
*   Firebase Project (with `serviceAccountKey.json`)
*   Groq API Key

### Steps
1.  **Clone Repository**:
    ```bash
    git clone <repo_url>
    cd bus-app
    ```
2.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Configure Keys**:
    *   Place `serviceAccountKey.json` in root.
    *   Set Environment Variable: `GROQ_API_KEY`.
4.  **Initialize Database**:
    *   Run python checks or simply start the app (SQLTables created on start).
5.  **Run Application**:
    ```bash
    python app.py
    ```
    *   Access at `http://localhost:3000`

---
*Generated by Antigravity AI*
