from app import app, db, Bus

with app.app_context():
    buses = Bus.query.all()
    print(f"Total Buses in DB: {len(buses)}")
    for b in buses:
        print(f"Bus {b.bus_no}: Active={b.is_active}, LastUpdated={b.last_updated}")
