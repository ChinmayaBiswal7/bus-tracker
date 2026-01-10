
import pandas as pd
import os

filePath = r"c:\D FOLDER\Projects\Bus app\data\bus_routes.xlsx"

if not os.path.exists(filePath):
    print("File not found.")
else:
    try:
        df = pd.read_excel(filePath)
        print("Columns:", df.columns.tolist())
        print("First 5 rows:")
        print(df.head())
        
        if 'stop_name' in df.columns:
            print("\nSample Stops:", df['stop_name'].unique()[:10])
    except Exception as e:
        print("Error reading excel:", e)
