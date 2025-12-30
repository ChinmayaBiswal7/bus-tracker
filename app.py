import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///buses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Firebase Admin SDK Setup (Backend) ---
import firebase_admin
from firebase_admin import credentials, firestore, messaging
from firebase_admin import _apps 
from groq import Groq
import os

# Initialize Groq Client (Llama 3)
groq_client = None
if os.environ.get("GROQ_API_KEY"):
    groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
else:
    print("[WARN] GROQ_API_KEY not found. AI Chatbot will be limited.") 

# Prevent re-initialization error on reload
import os
import json

# Prevent re-initialization error on reload
if not firebase_admin._apps:
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        # Fallback for Render: Use Environment Variable or Dummy
        print("[WARN] serviceAccountKey.json not found.")
        firebase_creds = os.environ.get('FIREBASE_CREDENTIALS')
        if firebase_creds:
            print("[INFO] Loading credentials from Environment Variable...")
            cred_dict = json.loads(firebase_creds)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        else:
            print("[ERROR] No Firebase Credentials found! Push Notifications will NOT work.")
            # We do NOT crash, but f_db will fail if used.
            # Initialize with default (might fail depending on GCP env) or just pass.
            # Better to not initialize and let f_db usage fail gracefully?
            # Try initializing with default (no explicit creds) - might work if Env Vars are set automatically
            try:
                firebase_admin.initialize_app()
                print("[INFO] Initialized Firebase with default/no credentials.")
            except Exception as e:
                print(f"[ERROR] Failed to init Firebase Default: {e}")

# Initialize Firestore (Global)
f_db = None
try:
    f_db = firestore.client()
except Exception as e:
    print(f"[ERROR] Firestore Client Init Failed: {e}")
    print("[WARN] Running without Firestore backend.")

# --- Database Models ---
# --- Database Models ---
# User model removed - Auth handled by Firebase

class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100)) # Changed to String for Firebase UID
    action = db.Column(db.String(50)) # 'search', 'track'
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
    is_active = db.Column(db.Boolean, default=True)

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

@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    data = request.json
    user_msg = data.get('message', '')
    
    # 1. Fallback if no Key
    if not groq_client:
        return {
            "response": "I see you want to chat! To enable my full Llama 3 brain, please set the 'GROQ_API_KEY' environment variable. For now, I'm just a simple bot: " + user_msg
        }

    # 2. System Prompt - The Ultimate Knowledge Base
    system_prompt = """
    You are the 'Campus Assistant', the intelligent brain of the Campus Ride app. You have COMPLETE knowledge of this project.

    CORE FEATURES & UI:
    1. TOP TASK BAR: A fixed black bar at the top containing the Menu button, 'Campus Ride' title, and Two Status Badges.
       - 'GPS' Badge: Shows YOUR device location status. (Yellow = Locating, Green = Active, Red = Failed).
       - 'Server' Badge: Shows if you are connected to our backend. (Green = Live, Red = Offline).
    2. THE MAP: A custom dark-themed Leaflet map. Your location is a blue pulsating dot.
    3. SEARCH BAR: Located in the sidebar. Used to filter the bus list by number (e.g., '42').
    4. SIDEBAR LIST:
       - 'EV Shuttles': Shown with a ⚡ icon and green highlights. They are always visible (Base Service).
       - 'Campus Buses': Shown with a 🚌 icon and blue badges.
       - 'Locate': Clicking any bus card flies the map to that bus.
    5. OFFLINE BUSES: If a driver disconnects, the bus turns GREY and shows the 'Last seen' time (e.g., '5 mins ago').
    6. TRIP INFO PILL: A blue pill that pops up at the bottom when you track a bus. It shows the ETA (Arrival minutes) and distance (km).
    7. ANNOUNCEMENTS: accordion sections in the sidebar. Drivers post updates here (e.g., 'Bus 42 is near Gate 1').
    8. PWA: This is an installable app with push notifications.

    YOUR STYLE:
    - You are the creator's assistant. You know every icon and color.
    - Be extremely concise (max 2 sentences).
    - If a user asks 'What is [UI thing]?', give the exact color and behavior.
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
    active_buses = Bus.query.filter_by(is_active=True).all()
    buses_limit = {}
    for b in active_buses:
        buses_limit[b.sid] = {
            'bus_no': b.bus_no,
            'lat': b.lat,
            'lng': b.lng,
            'accuracy': b.accuracy,
            'speed': b.speed,
            'heading': b.heading
        }
    emit('update_buses', buses_limit)

@socketio.on('disconnect')
def handle_disconnect():
    bus = Bus.query.filter_by(sid=request.sid).first()
    if bus:
        bus.is_active = False
        db.session.commit()
        emit('bus_disconnected', request.sid, broadcast=True)

@socketio.on('driver_update')
def handle_driver_update(data):
    sid = request.sid
    if data is None:
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

    emit('update_bus', {'id': sid, 'data': data}, broadcast=True)

# --- Background Listener for Announcements ---
def listen_for_announcements():
    """
    Listens to the 'announcements' collection group 'messages' 
    and triggers an FCM notification when a new message is added.
    """
    print("[INFO] Starting Announcement Listener...")

    if not f_db:
        print("[WARN] Firestore not initialized. Announcement listener DISABLED.")
        return

    # Define the callback
    def on_snapshot(col_snapshot, changes, read_time):
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                print(f"[INFO] New Announcement: {data}")
                
                # Check if it's a recent message (avoid spamming old ones on startup)
                # In a real app, use timestamp comparison. 
                # For now, we trust the listener catches live events.
                
                message_text = data.get('message', 'New Announcement')
                bus_no = data.get('bus_no', 'BUS')
                
                # Send Push Notification
                send_multicast_notification(bus_no, message_text)

    # Watch the collection group 'messages'
    # This catches announcements from ALL buses
    col_query = f_db.collection_group('messages') 
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
            notification=messaging.Notification(
                title=f"📢 {title_bus}",
                body=body_text,
            ),
            topic=topic,
        )
        response = messaging.send(message)
        print('Successfully sent message:', response)
    except Exception as e:
        print('Error sending message:', e)

# Start listener in a background thread
eventlet.spawn(listen_for_announcements)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=3000, allow_unsafe_werkzeug=True)
