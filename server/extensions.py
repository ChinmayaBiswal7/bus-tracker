import firebase_admin
from firebase_admin import credentials, firestore, messaging
import os
import json

f_db = None
db = None # Populated by app.py (SQLAlchemy)
StopRequest = None # Populated by app.py
ROUTES_CACHE = {} # Populated by app.py

def init_firebase():
    global f_db
    
    if not firebase_admin._apps:
        cred = None
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
            print("[INFO] Loading credentials from local file...")
        else:
            firebase_creds = os.environ.get('FIREBASE_CREDENTIALS')
            if firebase_creds:
                print("[INFO] Loading credentials from Environment Variable...")
                cred_dict = json.loads(firebase_creds)
                cred = credentials.Certificate(cred_dict)
            else:
                print("[WARN] No credentials found. Trying default init...")
        
        try:
            if cred:
                firebase_admin.initialize_app(cred)
            else:
                firebase_admin.initialize_app()
            
            f_db = firestore.client()
            print("[INFO] Firebase Initialized Successfully.")
        except Exception as e:
            print(f"[ERROR] Firebase Init Failed: {e}")
            f_db = None

    return f_db
