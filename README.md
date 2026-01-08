# Campus Ride - Bus Tracking System 🚌

Campus Ride is a real-time smart bus tracking and management system for universities. It connects Students and Drivers with live tracking, announcements, and AI assistance.

## 🚀 Running Locally

Follow these steps to run the application on your local machine.

### 1. Prerequisites
- **Python 3.10+** installed on your system.
- **Git** (optional, for cloning).

### 2. Install Dependencies
Open your terminal (Command Prompt or PowerShell) in this project folder and run:
```bash
pip install -r requirements.txt
```

### 3. Configuration
This app uses **Google's Llama 3 AI** (via Groq) and **Firebase**.

#### A. AI Setup (Required for Chat)
1. Get a free API Key from [console.groq.com](https://console.groq.com).
2. Open `run_buses.bat` in a text editor (Right-click -> Edit).
3. Replace `PLACE_YOUR_GROQ_KEY_HERE` with your actual key:
   ```bat
   set GROQ_API_KEY=gsk_yOuRkEyHeRe...
   ```
   *(Or set it as an environment variable in your terminal)*

#### B. Firebase Setup (Required for Database/Announcements)
*   Ensure `serviceAccountKey.json` is present in the root directory.
*   If missing, the app will start but database features (Schedules, Announcements) will be disabled.

### 4. Start the Server
**Option 1: Windows Batch Script**
Double-click `run_buses.bat`.

**Option 2: Manual Command**
Run the following in your terminal:
```bash
# Set key if not set in system
set GROQ_API_KEY=your_key_here 
python app.py
```

### 5. Access the App
Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

## 📱 Features
- **/student**: Student Dashboard (Tracking, Search, Chat).
- **/driver**: Driver Dashboard (Broadcast Location, Announcements).
- **/api/routes/42**: API to get route data.
