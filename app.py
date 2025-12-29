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
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

class UserActivity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
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
    # Simple AI: Recommend buses used around this time of day
    current_hour = datetime.utcnow().hour
    # Find activities from this user, grouped by bus_no, ordered by count
    # Simplified: just return top 3 most accessed buses by this user ever
    # (For a real AI we'd filter by time, but this suffices for a demo)
    recent = db.session.query(UserActivity.bus_no, func.count(UserActivity.bus_no))\
        .filter_by(user_id=user_id)\
        .group_by(UserActivity.bus_no)\
        .order_by(func.count(UserActivity.bus_no).desc())\
        .limit(3).all()
    return [r[0] for r in recent]

# --- Routes ---
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('student'))
    return render_template('home.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if User.query.filter_by(username=username).first():
            return render_template('signup.html', error="Username already taken")
        
        hashed_pw = generate_password_hash(password)
        new_user = User(username=username, password_hash=hashed_pw)
        db.session.add(new_user)
        db.session.commit()
        session['user_id'] = new_user.id
        return redirect(url_for('student'))
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    # If already logged in, redirect based on stored role or default to student
    if 'user_id' in session:
        role = session.get('role', 'student')
        if role == 'driver':
            return redirect(url_for('driver'))
        return redirect(url_for('student'))

    # Capture role from query param logic
    role_arg = request.args.get('role')
    if role_arg:
        session['role'] = role_arg

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            
            # Redirect based on intent
            desired_role = session.get('role', 'student')
            if desired_role == 'driver':
                return redirect(url_for('driver'))
            return redirect(url_for('student'))
            
        return render_template('login.html', error="Invalid credentials")
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('role', None)
    return redirect(url_for('index'))

@app.route('/driver')
def driver():
    # Drivers theoretically should login too, but for simplicity let's keep it open or require same login
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    # Verify user exists (DB might have reset)
    if not User.query.get(session['user_id']):
        session.clear()
        return redirect(url_for('login'))
        
    return render_template('driver.html')

@app.route('/student')
def student():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # AI Recommendations
    # AI Recommendations
    recs = get_recommendations(session['user_id'])
    
    current_user = User.query.get(session['user_id'])
    if not current_user:
        # Session is stale (DB reset), force logout
        session.clear()
        return redirect(url_for('login'))
        
    return render_template('student.html', recommendations=recs, username=current_user.username)

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
