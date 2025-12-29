import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///buses.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

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

@app.route('/driver')
def driver():
    return render_template('driver.html')

@app.route('/student')
def student():
    return render_template('student.html', recommendations=[])

# --- Socket Events ---

@socketio.on('search_bus')
def handle_search(bus_no):
    # Track user activity
    if 'user_id' in session:
        act = UserActivity(user_id=session['user_id'], action="search", bus_no=bus_no)
        db.session.add(act)
        db.session.commit()
    
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

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=3000, allow_unsafe_werkzeug=True)
