
import requests
import os

# Get API Key from environment or paste it here manually for testing if needed
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("❌ ERROR: GEMINI_API_KEY is not set.")
    # For local testing, you might want to prompt or exit
    exit(1)

def test_endpoint(version, model):
    url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={API_KEY}"
    print(f"\n--- Testing {version} with {model} ---")
    print(f"URL: {url.split('?')[0]}")
    
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": "Hello, simply say 'OK'."}]
        }]
    }
    
    try:
        response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ SUCCESS")
            print(response.json()['candidates'][0]['content']['parts'][0]['text'])
        else:
            print(f"❌ FAILED: {response.text}")
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")

# Test 1: v1 with gemini-1.5-flash (Current broken state)
test_endpoint('v1', 'gemini-1.5-flash')

# Test 2: v1beta with gemini-1.5-flash (Proposed fix)
test_endpoint('v1beta', 'gemini-1.5-flash')

# Test 3: v1 with gemini-pro (Fallback)
test_endpoint('v1', 'gemini-pro')
