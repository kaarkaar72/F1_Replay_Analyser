import requests
import redis
import os
import time

# Config
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)


def refresh_token():
    print("🔄 Refreshing F1 Token...")
    url = "https://api.openf1.org/token"
    payload = {
        "username": "kaarujan2000@gmail.com",
        "password": "5jwG77DWAX8j3w8u"
    }   
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }   
    
    try:
        resp = requests.post(url, data=payload, headers=headers)
        if resp.status_code == 200:
            token = resp.json().get('access_token')
            # Save to Redis
            r.set("f1_api_token", token, ex=3600) # Expire in 1 hour
            print("✅ Token updated in Redis.")
        else:
            print(f"❌ Auth Failed: {resp.text}")
    except Exception as e:
        print(f"❌ Auth Error: {e}")




if __name__ == "__main__":
    while True:
        refresh_token()
        # Sleep 55 minutes (refresh before it expires)
        time.sleep(55 * 60)


