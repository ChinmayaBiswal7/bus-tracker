from app import app, db
from sqlalchemy import text

with app.app_context():
    try:
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE bus ADD COLUMN driver_name VARCHAR(100)"))
            conn.commit()
        print("[SUCCESS] Added driver_name column.")
    except Exception as e:
        print(f"[INFO] Column might already exist or error: {e}")
