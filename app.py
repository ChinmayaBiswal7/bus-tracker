import gevent
from gevent import monkey
monkey.patch_all()

try:
    import grpc.experimental.gevent
    grpc.experimental.gevent.init_gevent()
    print("[INFO] gRPC Gevent compatibility enabled.")
except Exception as e:
    print(f"[ERROR] Failed to init gRPC Gevent: {e}")

from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import json
import difflib
import pandas as pd

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///buses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Extensions & Blueprints ---
import server.extensions # Import module to access f_db dynamically
server.extensions.init_firebase()
from firebase_admin import messaging

from routes.schedule import schedule_bp
from routes.contact import contact_bp
app.register_blueprint(schedule_bp)
app.register_blueprint(contact_bp)

# --- AI & Other Imports ---
import os
from groq import Groq

# Initialize Groq (Llama 3)
groq_client = None
if os.environ.get("GROQ_API_KEY"):
    groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Helper for Groq Calls
def call_groq(prompt, system_prompt="You are a helpful assistant."):
    if not groq_client:
        raise Exception("GROQ_API_KEY not set")
    
    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=200,
        )
        return completion.choices[0].message.content
    except Exception as e:
        print(f"[ERROR] Groq API Error: {e}")
        return f"AI Service Error: {str(e)}"

# --- Database Models ---
class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    action = db.Column(db.String(50))
    bus_no = db.Column(db.String(20))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Bus(db.Model):
    bus_no = db.Column(db.String(20), primary_key=True)
    sid = db.Column(db.String(50), unique=True)
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    accuracy = db.Column(db.Float)
    speed = db.Column(db.Float)
    heading = db.Column(db.Float)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    crowd_status = db.Column(db.String(20), default='LOW') # LOW, MED, HIGH

class LocationHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    bus_no = db.Column(db.String(20))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Ensure DB tables exist
with app.app_context():
    db.create_all()

# --- Helper Functions ---
def get_recommendations(user_id):
    # Placeholder - Recommendations temporarily disabled during migration
    return []

# --- Routes ---
@app.route('/')
def index():
    return render_template('home.html')

@app.route('/signup')
def signup():
    role = request.args.get('role', 'student')
    return render_template('signup.html', role=role)

@app.route('/login')
def login():
    role = request.args.get('role', 'student')
    return render_template('login.html', role=role)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# --- PWA Static Routes (Critical for Service Worker Scope) ---
@app.route('/manifest.json')
def serve_manifest():
    return app.send_static_file('manifest.json')

@app.route('/sw.js')
def serve_sw():
    return app.send_static_file('sw.js')

@app.route('/firebase-messaging-sw.js')
def serve_fcm_sw():
    return app.send_static_file('firebase-messaging-sw.js')

@app.route('/driver')
def driver():
    return render_template('driver.html')

@app.route('/student')
def student():
    return render_template('student.html', recommendations=[])


    
# --- Route Loading Logic (Excel) ---
# (pandas imported at top)
from server.bus_search import BusStopSearchEngine
from routes.search import search_bp, init_search_engine

# Initialize Module
try:
    search_engine = BusStopSearchEngine('data/bus_routes.xlsx')
    init_search_engine(search_engine)
    app.register_blueprint(search_bp)
    print(f"[INFO] Search Engine initialized and Blueprint registered.")
except Exception as e:
    print(f"[ERROR] Failed to init Search Engine: {e}")

ROUTES_CACHE = {}

def build_routes():
    """Reads Excel and builds a dictionary of routes."""
    global ROUTES_CACHE
    try:
        excel_path = "data/bus_routes.xlsx"
        if not os.path.exists(excel_path):
            print(f"[WARN] Route file not found: {excel_path}")
            return

        df = pd.read_excel(excel_path)
        # Ensure correct types
        df['bus_no'] = df['bus_no'].astype(str)
        
        routes = {}
        for bus_no, group in df.groupby("bus_no"):
            # Force stop_order to be int for correct sorting (1, 2, 10 not 1, 10, 2)
            group['stop_order'] = pd.to_numeric(group['stop_order'], errors='coerce')
            group = group.sort_values("stop_order")
            
            routes[bus_no] = {
                "path": group[['lat', 'lng']].values.tolist(),
                "stops": group[['stop_order', 'stop_name', 'lat', 'lng']].to_dict(orient="records")
            }
        
        ROUTES_CACHE = routes
        print(f"[INFO] Loaded {len(routes)} routes from Excel.")
    except Exception as e:
        print(f"[ERROR] Failed to load routes: {e}")

# Load on startup (Reloads when file changes)       
build_routes()

@app.route('/api/routes/<bus_no>')
def get_route(bus_no):
    # Normalize input
    bus_no = str(bus_no).upper()
    
    # Try direct match
    route = ROUTES_CACHE.get(bus_no)
    
    # Try case-insensitive lookup if fail
    if not route:
        for k, v in ROUTES_CACHE.items():
            if k.upper() == bus_no:
                route = v
                break
                
    if not route:
        return {"error": "Route not found"}, 404

    return route

@app.route('/api/search_stops')
def search_stops():
    query = request.args.get('q', '').lower().strip()
    if not query:
        return jsonify([])

    # 1. Gather all unique stops and their buses
    stop_map = {} # "Stop Name" -> Set(Bus Numbers)
    # 1. Gather all unique stop names
    all_stops = set()
    for route in ROUTES_CACHE.values():
        for stop in route['stops']:
            all_stops.add(stop['stop_name'])
    
    unique_stops = list(all_stops)
    
    # 2. Find matches
    # PRIORITY A: Direct Substring (e.g. "kiit" in "KIIT Campus 6")
    matches = [s for s in unique_stops if query in s.lower()]

    # PRIORITY B: Fuzzy Match (only if specific enough)
    if len(query) > 3:
        fuzzy_matches = difflib.get_close_matches(query, unique_stops, n=5, cutoff=0.5)
        # Add fuzzy matches if not already in substring matches
        for m in fuzzy_matches:
            if m not in matches:
                matches.append(m)

    print(f"[DEBUG] Search '{query}' -> Found Stops: {matches}")

    # 3. Map Stops -> Buses
    results = []
    seen_stops = set()

    for stop_name in matches:
        if stop_name in seen_stops: continue
        seen_stops.add(stop_name)
        
        relevant_buses = []
        for bus_no, route in ROUTES_CACHE.items():
            # Check if this bus stops here
            if any(s['stop_name'] == stop_name for s in route['stops']):
                relevant_buses.append(str(bus_no)) # Ensure string for frontend
        
        # Sort buses numerically if possible
        relevant_buses.sort(key=lambda x: int(x) if x.isdigit() else 999)

        results.append({
            "stop_name": stop_name,
            "buses": relevant_buses
        })
    
    return jsonify(results)


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_msg = data.get('message', '')
    if not user_msg:
        return {"error": "Empty message"}, 400

        # 1. Fallback if no Key
    if not groq_client:
        return {
            "response": "I see you want to chat! To enable my full Llama 3 brain, please set the 'GROQ_API_KEY' environment variable. For now, I'm just a simple bot: " + user_msg
        }

    # 2. System Prompt - The Ultimate Knowledge Base
    system_prompt = """
    You are the 'Campus Assistant', the intelligent and omniscient brain of the Campus Ride app. 
    You have COMPLETE, low-level knowledge of this project's code, architecture, and features.

    --- PROJECT OVERVIEW ---
    "Campus Ride" is a real-time smart bus tracking and management system for universities.
    It connects Students (Observers) and Drivers (Broadcasters) in real-time.

    --- TECH STACK (The "DNA") ---
    *   **Backend:** Python Flask + Flask-SocketIO (Real-time) + Flask-SQLAlchemy (SQLite for session/auth).
    *   **Database:** 
        1. **SQLite (`buses.db`):** Stores transient bus location snapshots for the Socket server.
        2. **Firebase Firestore:** Stores persistent data:
            - `announcements`: Collection for driver messages.
            - `schedules`: Collection for bus timetables.
            - `drivers`: Collection for driver profiles (name, mobile).
            - `feedback`: Collection for contact form submissions.
    *   **Frontend:** Vanilla HTML5 + Tailwind CSS + JavaScript modules (ES6).
    *   **Mapping:** Leaflet.js with OSRM (Leaflet Routing Machine) for path drawing.
    *   **Real-time:** Socket.IO for sub-second location updates (latency < 200ms).
    *   **AI Models:** 
        - Student Chat: Llama 3 via Groq API.
        - Driver Assist: Llama 3 via Groq API (for polishing announcements).
        - Driver Chat: Llama 3 via Groq API.

    --- USER ROLES & FEATURES ---

    ### 1. STUDENT (The User)
    *   **The Interface:** A dark-themed, sleek dashboard.
    *   **Map:** Shows own location (Blue Dot) and live buses.
    *   **Bus Icons:** 
        - 🚌 **Bus:** Yellow icon / Blue badge. Standard routes.
        - ⚡ **EV Shuttle:** Green icon. Free intra-campus shuttles.
    *   **Tracking:** Clicking a bus flies the camera to it and opens a "Trip Info" pill (ETA & Distance).
    *   **Search:** Sidebar input to finding a specific bus (e.g., '42').
    *   **Offline Mode:** If a driver app crashes/closes, the bus icon turns GREY on the map, showing "Last seen X min ago".
    *   **Menu Features (Sidebar):**
        - **Announcements:** Accordion list of updates sent by drivers.
        - **Bus Schedule:** Timetables pushed by drivers.
        - **Driver Directory:** List of verified drivers with "Call" buttons.
        - **Contact Us:** Feedback form.

    ### 2. DRIVER (The Controller)
    *   **Mission Control:** A dashboard to broadcast location.
    *   **GPS Modes:** 
        - **High Accuracy:** Uses GPS hardware (Satellite).
        - **Power Saver:** Uses Cell/WiFi triangulation.
    *   **Features:**
        - **"Publish Schedule":** A form to add route timings (saved to Firestore).
        - **"Make Announcement":** A specific tool where they type raw text (e.g., "tyre burst"). The AI (Llama 3) auto-polishes it to "⚠️ Alert: We have a flat tire..." before sending.
        - **Chat with AI:** A dedicated assistant to help drivers with operational questions.

    --- UI/UX "SECRETS" (How it looks) ---
    *   **Colors:** Slate-900 (Background), Blue-600 (Primary/Student), Amber-500 (Driver/Bus), Emerald-500 (EV/Success).
    *   **Chat Widget:** A floating "Messenger-style" button (bottom-right) that opens a glass-morphism pop-up.
    *   **Animations:** Smooth transitions (sidebar slide-in, map fly-to, skeleton loaders).
    *   **PWA:** The app is installable (Add to Home Screen) and supports push notifications via Firebase Cloud Messaging (FCM).
    
    --- DEEP DIVE: FEATURE MECHANICS (How things actually work) ---
    
    ### 1. INTELLIGENT SEARCH BAR
    *   **Logic:** The search bar uses a **hybrid matching algorithm**.
        -   **Frontend:** As you type, it floats an overlay over the map.
        -   **Backend:** It queries `/api/search_stops` which uses Python's `difflib` for **fuzzy matching** (e.g., "kit campus" matches "KIIT Campus 6").
    *   **Auto-Locate Action:** When you select a result:
        1.  The app first checks if the bus is **already visible** in the sidebar.
        2.  If yes, it programmatically **clicks the "Locate" button** for you.
        3.  If no (offline), it shows a "Bus Offline" toast.
    
    ### 2. NOTIFICATION CENTER (The Bell Icon)
    *   **3-State Toggle:** A single button cycles through three modes, saved in `localStorage`:
        1.  **Normal 🔔:** Plays a "ding" sound + Vibrate + Popup.
        2.  **Vibrate 📳:** Vibrate only + Popup.
        3.  **Silent 🔕:** Popup only (No sound, no vibration).
    *   **Anti-Spam:** The server uses a **thread lock** to ensure you never get duplicate notifications for the same announcement.
    
    ### 3. LIVE TRACKING & ALERTS
    *   **Proximity Alarm:** 
        -   The app calculates the **Haversine distance** between you (Blue Dot) and the Bus (Yellow Icon).
        -   If Distance < **1000m (1km)**, it triggers a "Bus Arriving" alert.
    *   **WakeLock:** While tracking, we force the screen to **stay awake** so you don't lose the map view.
    *   **Density Icons:**
        -   WE DO NOT use signal bars.
        -   We use **Person Icons (👤)** to show crowd levels:
            -   **1 Green Person:** Low Crowd (Seats available).
            -   **2 Yellow People:** Medium Crowd (Standing room).
            -   **3 Red People:** High Crowd (Packed).
            
    ### 4. UI/UX REFINEMENT
    *   **No-Flicker Login:** The login page uses a **static loading overlay** to mask the white screen while checking session status.
    *   **Driver Sync:** Drivers see students on their map as **Blue Human Icons** with a pulse, matching exactly what students see.

    --- YOUR BEHAVIOR ---
    1.  **Be Educational:** If asked "How does search work?", explain the fuzzy matching.
    2.  **Be Helpful:** Answer strictly based on the features above.
    3.  **Be "In Character":** You are PART of the app. Don't say "the app has...", say "I can help you with...".
    4.  **Troubleshooting:**
        - If users say "Where is the bus?", ask "Which bus number are you looking for?" or tell them to check the Search bar.
        - If they say "Bug", blame "solar flares" or "exams" jokingly, but then give real technical advice (e.g., "Check your GPS permission").
    
    Now, answer the user's question with this full context available.
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_msg
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=150,
        )
        ai_response = chat_completion.choices[0].message.content
        return {"response": ai_response}
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Groq API Error: {error_msg}")
        return {"response": f"I'm having trouble connecting to my brain. Details: {error_msg}"}

@app.route('/api/driver/ai-assist', methods=['POST'])
def driver_ai_assist():
    data = request.json
    raw_text = data.get('text', '')
    
    if not raw_text:
        return {"response": ""}

    if not groq_client:
        return {"response": "AI Error: GROQ_API_KEY not set on server."}

    system_prompt = """
    You are an AI assistant for a Bus Driver. 
    Task: Polish the driver's raw, hasty message into a professional, clear, and reassuring one-sentence announcement for students.
    Add a relevant emoji at the start.
    Examples:
    Input: "traffic jam late" -> Output: "⚠️ Notice: We are stuck in heavy traffic and will be roughly 10-15 minutes late."
    Input: "breakdown" -> Output: "🔧 Alert: The bus has a minor mechanical issue; a replacement is on the way."
    """

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_text}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=100,
        )
        response_text = completion.choices[0].message.content
        return {"response": response_text.strip()}
    except Exception as e:
        print(f"[ERROR] Groq API Error: {e}")
        return {"response": f"Error: {str(e)}"}


@app.route('/api/driver/chat', methods=['POST'])
def driver_chat():
    data = request.json
    user_msg = data.get('message', '')
    
    if not user_msg:
        return {"response": ""}

    if not groq_client:
        return {"response": "AI Error: GROQ_API_KEY not set."}

    system_prompt = """
    You are a friendly and helpful assistant for a University Bus Driver.
    Instructions:
    - Keep responses short (max 2-3 sentences).
    - Be helpful and operational.
    """

    try:
        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=150,
        )
        response_text = completion.choices[0].message.content
        return {"response": response_text.strip()}
    except Exception as e:
        print(f"[ERROR] Groq Chat Error: {e}")
        return {"response": f"AI Error: {str(e)}"}


@app.route('/subscribe', methods=['POST'])
def subscribe_to_topic():
    token = request.json.get('token')
    topic = 'news'
    if token:
        try:
            response = messaging.subscribe_to_topic([token], topic)
            print("Successfully subscribed to topic:", response.success_count)
            return {'status': 'success', 'message': 'Subscribed'}, 200
        except Exception as e:
            print("Error subscribing:", e)
            return {'status': 'error', 'message': str(e)}, 500
    return {'status': 'error', 'message': 'No token provided'}, 400

# --- Socket Events ---

def get_active_buses_payload():
    active_buses = Bus.query.filter_by(is_active=True).all()
    payload = {}
    
    # 1. Add Active Buses
    for b in active_buses:
        payload[b.sid] = {
            'bus_no': b.bus_no,
            'lat': b.lat,
            'lng': b.lng,
            'accuracy': b.accuracy,
            'speed': b.speed,
            'heading': b.heading,
            'crowd': b.crowd_status or 'LOW',
            'offline': False
        }

    # 2. Add Offline Buses (from Cache)
    active_bus_nos = {b.bus_no for b in active_buses}
    
    for bus_no, route_data in ROUTES_CACHE.items():
        if bus_no not in active_bus_nos:
            # Use the first stop as the "location" for offline buses (or 0,0)
            # This is needed so map.js has *something*, but we will flag it as offline
            start_lat = 0
            start_lng = 0
            if route_data.get('stops'):
                start_lat = route_data['stops'][0]['lat']
                start_lng = route_data['stops'][0]['lng']
            
            # Use a dummy SID for offline buses (e.g. "OFFLINE_BUS_42")
            dummy_sid = f"OFFLINE_{bus_no}"
            payload[dummy_sid] = {
                'bus_no': bus_no,
                'lat': start_lat,
                'lng': start_lng,
                'accuracy': 0,
                'speed': 0,
                'heading': 0,
                'crowd': 'LOW',
                'offline': True
            }
            
    return payload

@socketio.on('search_bus')
def handle_search(bus_no):
    # Track user activity (Disabled: Auth is now client-side only)
    # if 'user_id' in session:
    #     act = UserActivity(user_id=session['user_id'], action="search", bus_no=bus_no)
    #     db.session.add(act)
    #     db.session.commit()
    
    # Check bus status
    bus = Bus.query.filter_by(bus_no=bus_no).first()
    if bus:
        if bus.is_active:
             emit('search_result', {'status': 'active', 'bus_no': bus_no})
        else:
             # Return offline info
             last_seen = bus.last_updated.strftime("%H:%M")
             emit('search_result', {'status': 'offline', 'bus_no': bus_no, 'last_seen': last_seen})
    else:
        emit('search_result', {'status': 'not_found'})

@socketio.on('connect')
def handle_connect():
    emit('update_buses', get_active_buses_payload())

@socketio.on('disconnect')
def handle_disconnect():
    bus = Bus.query.filter_by(sid=request.sid).first()
    if bus:
        bus.is_active = False
        db.session.commit()
        emit('bus_disconnected', request.sid, broadcast=True)
        # Optional: Broadcast full list to clear marker immediately if needed, 
        # but bus_disconnected event is efficient for removal.
        # Stick to existing logic or broadcast full list? 
        # For consistency with "Offline Mode" features, let's just stick to disconnect event 
        # unless user reports issues.

@socketio.on('driver_update')
def handle_driver_update(data):
    sid = request.sid
    if data is None:
        # Driver stopped session manually
        bus = Bus.query.filter_by(sid=sid).first()
        if bus:
            bus.is_active = False
            db.session.commit()
            emit('bus_disconnected', sid, broadcast=True)
        return

    bus_no = data.get('bus_no')
    bus = Bus.query.filter_by(bus_no=bus_no).first()
    if not bus:
        bus = Bus(bus_no=bus_no)
        db.session.add(bus)
    
    bus.sid = sid
    bus.lat = data.get('lat')
    bus.lng = data.get('lng')
    bus.accuracy = data.get('accuracy')
    bus.speed = data.get('speed')
    bus.heading = data.get('heading')
    bus.speed = data.get('speed')
    bus.heading = data.get('heading')
    bus.crowd_status = data.get('crowd', 'LOW')
    bus.is_active = True
    bus.last_updated = datetime.utcnow()

    # Log History
    history = LocationHistory(
        bus_no=bus_no, 
        lat=data.get('lat'), 
        lng=data.get('lng')
    )
    db.session.add(history)
    
    db.session.commit()

    # BROADCAST FULL STATE
    emit('update_buses', get_active_buses_payload(), broadcast=True)

@socketio.on('student_update')
def handle_student_update(data):
    """
    Relays student location to drivers.
    Data: { 'bus_no': '42', 'lat': ..., 'lng': ... }
    """
    print(f"[DEBUG] Received student_update: {data}")
    # Attach the student's socket ID so the driver can track unique students
    data['id'] = request.sid
    # Broadcast to everyone (Drivers will filter by bus_no)
    emit('student_location_update', data, broadcast=True)

# --- Background Listener for Announcements ---
def listen_for_announcements():
    """
    Listens to the 'announcements' collection group 'messages' 
    and triggers an FCM notification when a new message is added.
    """
    print("[INFO] Starting Announcement Listener...")

    if not server.extensions.f_db:
        print("[WARN] Firestore not initialized. Announcement listener DISABLED.")
        return

    # Startup Timestamp to filter old messages
    startup_time = datetime.utcnow()

    # Define the callback
    def on_snapshot(col_snapshot, changes, read_time):
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                
                # Timestamp Logic
                msg_time = data.get('timestamp')
                
                # Convert Firestore Timestamp to datetime if needed
                if hasattr(msg_time, 'second'):  # Duck type check for datetime/Timestamp
                    # If it's aware, make it naive or compare properly. 
                    # Simpler: if msg_time is older than startup_time - 10 seconds, skip.
                    # Firestore Timestamps usually have .timestamp() or similar. 
                    # Let's try direct comparison if types match, else catch.
                    try:
                        # Ensure both are offset-naive or offset-aware. 
                        # datetime.utcnow() is naive. Firestore often returns timezone-aware (UTC).
                        # Let's just compare raw values if possible, or skip safely.
                        
                        # Fallback: Check if message is older than 60 seconds from NOW
                        # This handles "startup dump" effectively.
                        now_utc = datetime.utcnow()
                        if isinstance(msg_time, datetime):
                            # Remove tzinfo for comparison with utcnow
                            msg_naive = msg_time.replace(tzinfo=None)
                            age = (now_utc - msg_naive).total_seconds()
                        else:
                            # Assume it's a Firestore Timestamp object with .status? No, .seconds
                            # Actually, google.cloud.firestore.SERVER_TIMESTAMP might be used.
                            # Safest: If we just started, ignore EVERYTHING in the first Batch?
                            # But new messages might come in.
                            
                            # Better approach:
                            # If read_time (from snapshot) is close to startup_time, it's the specific scan.
                            # But simpler:
                            # If the message is OLDER than the startup_time, ignore it.
                             pass
                    except Exception as e:
                        print(f"[WARN] Timestamp compare error: {e}")

                # PRACTICAL FIX:
                # If the message timestamp is OLDER than our startup_time, it's history.
                if msg_time:
                    try:
                        # Handle Firestore Timestamp -> datetime
                        if hasattr(msg_time, 'replace'):
                            msg_naive = msg_time.replace(tzinfo=None)
                        else:
                             # Try .to_datetime() for Firestore objects
                             msg_naive = msg_time.to_datetime().replace(tzinfo=None)
                        
                        if msg_naive < startup_time:
                            print(f"[INFO] Skipping old announcement (from {msg_naive})")
                            continue
                    except:
                        pass # If we can't parse time, we might risk sending it (or skip?)
                             # Safest is to skip if we assume historical data.
                
                print(f"[INFO] New Announcement: {data}")
                
                message_text = data.get('message', 'New Announcement')
                bus_no = data.get('bus_no', 'BUS')
                
                # Send Push Notification
                send_multicast_notification(bus_no, message_text)

    # Watch the collection group 'messages'
    col_query = server.extensions.f_db.collection_group('messages') 
    col_query.on_snapshot(on_snapshot)

def send_multicast_notification(title_bus, body_text):
    """
    Sends a message to all users subscribed to the 'all_students' topic
    or generally via multicast if we had individual tokens.
    For simplicity, we will send to a TOPIC called 'news'.
    """
    try:
        topic = 'news' 
        message = messaging.Message(
            data={
                'title': f"📢 {title_bus}",
                'body': body_text,
                'type': 'announcement'
            },
            topic=topic,
        )
        response = messaging.send(message)
        print('Successfully sent message:', response)
    except Exception as e:
        print('Error sending message:', e)

# Start listener in a background thread (Only in the reloader child process or production)
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    gevent.spawn(listen_for_announcements)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=3000, allow_unsafe_werkzeug=True)
