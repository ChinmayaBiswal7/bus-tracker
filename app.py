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

# --- Extensions & Blueprints ---
from server.extensions import init_firebase, f_db # Import f_db for usage in other routes
init_firebase()

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
    
    if not groq_client:
        return {
            "response": "I see you want to chat! To enable my full Llama 3 brain, please set the 'GROQ_API_KEY' environment variable. For now, I'm just a simple bot: " + user_msg
        }

    system_prompt = """
    You are the 'Campus Assistant', the intelligent and omniscient brain of the Campus Ride app. 
    You have COMPLETE, low-level knowledge of this project's code, architecture, and features.
    (See full system prompt in previous versions)
    """
    
    # We can reuse call_groq here or keep the bespoke call
    # Keeping bespoke call to update system prompt fully later if needed, 
    # but for now reusing the logic you had would be cleaner.
    # To minimize diff, I'll keep your existing implementation for student chat
    # but using the Helper would be better. For now, leaving Student Chat logic AS IS.
    
    try:
        # Re-using your existing student chat logic block
        # ... (omitted for brevity in replacement chunk instructions, will use exact target content match)
        pass 
    except:
        pass

    # Actually, I need to replace the WHOLE top section to remove Gemini imports.
    # But for this tool I must target a specific block.
    # Strategy: Replace from Line 1 to the end of driver_chat function.
    
    return {"response": "Error in replacement logic - see next step"}

# RETHINKING REPLACEMENT STRATEGY:
# I will do this in 2 chunks to be safe.
# Chunk 1: Top of file (Imports & Init)
# Chunk 2: AI Endpoints (driver_ai_assist & driver_chat)


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
        - Driver Assist: Gemini 1.5 Flash via Google AI Studio (for polishing announcements).

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
        - **"Make Announcement":** A specific tool where they type raw text (e.g., "tyre burst"). The AI (Gemini) auto-polishes it to "⚠️ Alert: We have a flat tire..." before sending.
        - **Chat with AI:** A dedicated assistant to help drivers with operational questions.

    --- UI/UX "SECRETS" (How it looks) ---
    *   **Colors:** Slate-900 (Background), Blue-600 (Primary/Student), Amber-500 (Driver/Bus), Emerald-500 (EV/Success).
    *   **Chat Widget:** A floating "Messenger-style" button (bottom-right) that opens a glass-morphism pop-up.
    *   **Animations:** Smooth transitions (sidebar slide-in, map fly-to, skeleton loaders).
    *   **PWA:** The app is installable (Add to Home Screen) and supports push notifications via Firebase Cloud Messaging (FCM).

    --- YOUR BEHAVIOR ---
    1.  **Be Helpful:** Answer strictly based on the features above.
    2.  **Be "In Character":** You are PART of the app. Don't say "the app has...", say "I can help you with...".
    3.  **Troubleshooting:**
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
