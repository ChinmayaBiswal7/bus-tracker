import requests
import os

# --- CONFIG ---
# If you are running this locally and the key is not in your environment,
# you can temporarily paste it here to test (don't commit it!).
API_KEY = os.environ.get("GEMINI_API_KEY") 

print(f"Checking Key: {API_KEY[:5]}...{API_KEY[-5:] if API_KEY else 'None'}")

if not API_KEY:
    print("❌ ERROR: GEMINI_API_KEY is not set.")
    exit(1)

# --- THE CORRECT ENDPOINT (v1) ---
url = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={API_KEY}"

payload = {
    "contents": [{
        "role": "user",
        "parts": [{"text": "Hello! Are you working?"}]
    }]
}

headers = {"Content-Type": "application/json"}

print(f"\nSending request to: {url.split('?')[0]}...")

try:
    response = requests.post(url, headers=headers, json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        text = data['candidates'][0]['content']['parts'][0]['text']
        print(f"\n✅ SUCCESS! Gemini responded:\n{text}")
    else:
        print(f"\n❌ FAILED. Response:\n{response.text}")

except Exception as e:
    print(f"\n❌ EXCEPTION: {e}")
