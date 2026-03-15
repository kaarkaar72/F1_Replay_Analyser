import json
import time
import dotenv
import requests
import argparse
import sys
import threading
import signal
import os
import pandas as pd
import dotenv
from concurrent.futures import ThreadPoolExecutor
from kafka import KafkaProducer
from datetime import datetime, timedelta,timezone

# --- CONFIGURATION ---
KAFKA_SERVER = os.getenv("KAFKA_SERVER", "localhost:9092")
CACHE_DIR = "race_cache"
STOP_EVENT = threading.Event()

# Rate Limit Semaphore (Allow 2 concurrent API calls)
API_SEMAPHORE = threading.BoundedSemaphore(value=2)

# Map Endpoints
STREAMS = {
    "telemetry": {"url": "https://api.openf1.org/v1/car_data", "topic": "f1-telemetry2"},
    "location":  {"url": "https://api.openf1.org/v1/location", "topic": "f1-location2"},
    "intervals": {"url": "https://api.openf1.org/v1/intervals", "topic": "f1-intervals2"},
    "position":  {"url": "https://api.openf1.org/v1/position", "topic": "f1-position2"},
    "weather":   {"url": "https://api.openf1.org/v1/weather", "topic": "f1-weather2"},
    "laps": {"url": "https://api.openf1.org/v1/laps", "topic": "f1-laps2"},
    "pit": {"url": "https://api.openf1.org/v1/pit", "topic": "f1-pit2"},
    "race_control": {"url": "https://api.openf1.org/v1/race_control", "topic": "f1-alerts2"},
    "overtakes": {"url": "https://api.openf1.org/v1/overtakes", "topic": "f1-overtakes2"},
    "stints": {"url": "https://api.openf1.org/v1/stints", "topic":"f1-stints2"}
}

#Stream Dividers
DRIVER_STREAMS = ["telemetry", "location", "intervals"]
GLOBAL_STREAMS = ["weather", "race_control", "laps", "pit", "position", "overtakes", "stints"]
dotenv.load_dotenv()
F1_ACCESS_TOKEN = os.getenv("F1_ACCESS_TOKEN","PAY_FOR_YOURS")
HEADERS = {
    "accept": "application/json",
    "Authorization": f"Bearer {F1_ACCESS_TOKEN}"
}
# GLOBAL_STREAMS = ["laps"]
# --- KAFKA SETUP ---
try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_SERVER,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
except Exception as e:
    print(f"❌ Kafka Error: {e}")
    sys.exit(1)

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# --- HELPER: TIMESTAMP PARSER ---
def to_ms(date_str):
    try:
        # 1. Clean String
        date_str = date_str.replace("Z", "+00:00") # Standardize Z
        
        # 2. Parse
        dt = datetime.fromisoformat(date_str)
        
        # 3. Handle Timezone
        if dt.tzinfo is None:
            # If naive, assume UTC (OpenF1 is usually UTC)
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            # If aware, convert to UTC to be safe
            dt = dt.astimezone(timezone.utc)
            
        return int(dt.timestamp() * 1000)
    except Exception as e:
        print(f"Time Error: {e}")
        return 0
    
# --- CLASS: RACE CLOCK ---
class RaceClock:
    def __init__(self, start_time_ms):
        # The moment in history we want to start replaying from
        self.race_cursor = start_time_ms 
        # The real-world time we started the script
        self.wall_start = time.time() * 1000 
        
    def get_current_race_time(self):
        # Current Real Time - Start Real Time = Elapsed Milliseconds
        elapsed = (time.time() * 1000) - self.wall_start
        # Add elapsed time to the historic cursor
        return self.race_cursor + elapsed

# --- HELPER: FIND RACE START ---
def get_race_start_time(session_key,lap_number=1):
    """Finds the timestamp of Lap 1 (Lights Out) minus 60 seconds buffer."""
    print("🚦 Calculating Race Start Time...")
    url = f"https://api.openf1.org/v1/laps?session_key={session_key}&lap_number={lap_number}"
    
    try:
        # We don't need to cache this, it's one quick call
        with API_SEMAPHORE:
            data = requests.get(url,headers=HEADERS).json()
            print(data)
        if data:
            # Sort to find the very first driver to cross line (Leader)
            df = pd.DataFrame(data)
            start_iso = df['date_start'].dropna().min()
            
            # Convert to MS and subtract 60 seconds (buffer for formation lap)
            start_ms = to_ms(start_iso) - 60000
            print(f"✅ Fast-Forwarding to: {start_iso} (-60s)")
            return start_ms
    except Exception as e:
        print(f"⚠️ Could not find start time: {e}")
    
    return 0 # Fallback to beginning

# --- FORMATTERS ---
def format_generic(r, type_name):
    # 1. Base Object (Common to all)
    obj = {
        "session_key": int(r['session_key']),
        "event_time_ms": to_ms(r['date'])
    }
    if 'driver_number' in r: 
        obj['driver_number'] = int(r['driver_number'])
    
    # 2. Specific Fields
    if type_name == 'telemetry':
        obj.update({
            "speed": int(r.get('speed', 0)),
            "rpm": int(r.get('rpm', 0)),
            "throttle": int(r.get('throttle', 0)),
            "brake": int(r.get('brake', 0)),
            "n_gear": int(r.get('n_gear', 0))
        })
        
    elif type_name == 'location':
        obj.update({
            "x": float(r.get('x', 0)), 
            "y": float(r.get('y', 0)), 
            "z": float(r.get('z', 0))
        })
        
    elif type_name == 'intervals':
        obj.update({
            "gap_to_leader": float(r.get('gap_to_leader', 0) or 0), 
            "interval": float(r.get('interval', 0) or 0)
        })
        
    elif type_name == 'position':
        obj.update({
            "position": int(r.get('position', 0) or 0)
        })
        
    elif type_name == 'weather':
        obj.update({
            "rainfall": int(r.get('rainfall', 0)), 
            "track_temperature": float(r.get('track_temperature', 0)),
            "air_temperature": float(r.get('air_temperature', 0)),
            "humidity": float(r.get('humidity', 0))
        })

    # --- NEW SECTIONS ---
    elif type_name == 'laps':
        obj.update({
            "lap_number": int(r.get('lap_number', 0)),
            "event_time_ms": to_ms(r['date_start']),
            "is_pit_out_lap": bool(r.get('is_pit_out_lap', False)), 
            "duration_sector_1": float(r.get('duration_sector_1') or 0),
            "duration_sector_2": float(r.get('duration_sector_2') or 0),
            "duration_sector_3": float(r.get('duration_sector_3') or 0),
            "i1_speed": float(r.get('i1_speed') or 0),
            "i2_speed": float(r.get('i2_speed') or 0),
            "st_speed": float(r.get('st_speed') or 0),
            "lap_duration": float(r.get('lap_duration') or 0),
            "segments_sector_1": r.get('segments_sector_1') or [],
            "segments_sector_2": r.get('segments_sector_1') or [],
            "segments_sector_3": r.get('segments_sector_1') or []
        })

    elif type_name == 'pit':
        obj.update({
            "lap_number": int(r.get('lap_number', 0) or 0),
            "lane_duration": float(r.get('lane_duration',0) or 0),
            "pit_duration":float(r.get('pit_duration',0) or 0),
            "stop_duration": float(r.get('stop_duration',0) or 0)
        })
    elif type_name == "race_control":
        obj.update({
            "category": r.get('category', 'UNKNOWN'),
            "lap_number": int(r.get('lap_number', 0) or 0),
            "message": r.get('message', ''),
            "flag": r.get('flag', None),
            "qualifying_phase": r.get('qualifying_phase', None),
            "scope": r.get('scope', None),
            "sector": r.get('sector', None)
        })
    elif type_name == "overtakes":
        obj.update({
            "overtaken_driver_number": int(r['overtaken_driver_number']),
            "overtaking_driver_number": int(r['overtaking_driver_number']),
            "position": int(r['position']),
        })
    elif type_name == "stints":
        obj.update({
            "lap_end": int(r["lap_end"]),
            "lap_start": int(r["lap_start"]),
            "stint_number": int(r["stint_number"]),
            "tyre_age_laps_at_start": int("tyre_age_at_start")
        })

        
    return obj






# --- WORKER FUNCTION ---
def stream_data(stream_name, session_key, driver_number, clock, start_threshold_ms, barrier):
    config = STREAMS[stream_name]
    topic = config['topic']
    
    # Cache File Logic
    driver_suffix = f"_{driver_number}" if driver_number else ""
    cache_file = f"{CACHE_DIR}/{session_key}_{stream_name}{driver_suffix}.json"
    data = []

    # 1. Load Data (Cache or API)
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f: data = json.load(f)
        except: 
            pass
    
    if not data:
        url = f"{config['url']}?session_key={session_key}"
        if driver_number and stream_name not in ["laps", "pit", "weather", "race_control"]: 
            url += f"&driver_number={driver_number}"
        
        try:
            with API_SEMAPHORE:
                resp = requests.get(url,headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                with open(cache_file, 'w') as f: json.dump(data, f)
        except Exception as e:
            print(f"❌ {stream_name} Error: {e}")
            return

    if not data: 
        print(f" ❌ [{stream_name.upper()}] has no data" )
        return

    # print(data)
    # 2. Filter & Sort
    # Drop data before the "Lights Out" time to save processing
    if stream_name == "laps":
        # 1. Remap date_start -> date
        # 2. Filter out None dates
        data = [
            dict(d, date=d['date_start']) 
            for d in data 
            if d.get('date_start') is not None
        ]

    original_len = len(data)
    data = [d for d in data if to_ms(d['date']) >= start_threshold_ms]
    data.sort(key=lambda x: x['date'])
    
    print(f"🚀 [{stream_name.upper()}] Driver {driver_number} - {len(data)} packets (Skipped {original_len - len(data)})")
    # print(f"⏳ [{stream_name}] Ready. Waiting for Grid...")
    # try:
    #     # WAIT HERE until everyone is ready
    #     barrier.wait(timeout=30) 
    # except threading.BrokenBarrierError:
    #     print(f"❌ [{stream_name}] Barrier Broken (Timeout). Starting anyway.")


    # 3. Stream Loop
    for raw_record in data:
        if STOP_EVENT.is_set(): break

        record_time = to_ms(raw_record['date'])
        
        # --- THE CLOCK SYNC ---
        # Wait until the "Virtual Race Time" catches up to this record
        while clock.get_current_race_time() < record_time:
            if STOP_EVENT.is_set(): return
            time.sleep(0.01) # Check every 10ms

        # Send to Kafka
        clean_msg = format_generic(raw_record, stream_name)
        producer.send(topic, value=clean_msg)

# --- MAIN ORCHESTRATOR ---
def start_simulation(session_key,start_lap=1):
    # 1. Get Start Time
    start_ms = get_race_start_time(session_key, start_lap)
    print(start_ms)
    # 2. Initialize Clock
    # If start_ms is 0 (API fail), fall back to "Now" logic, but better to have a default
    if start_ms == 0:
        print("⚠️ Warning: Could not detect race start. Starting from beginning of file.")
        # We need a reference point. We'll grab it from the first weather packet later or just use 0.
    
    clock = RaceClock(start_ms)

    # 3. Get Drivers
    try:
        with API_SEMAPHORE:
            drivers = requests.get(f"https://api.openf1.org/v1/drivers?session_key={session_key}",headers=HEADERS).json()
        driver_ids = [d['driver_number'] for d in drivers][:2] # Top 5
    except:
        driver_ids = [1, 14, 44]

    # 4. Start Threads
    print(f"🏁 Green Light! Streaming from timestamp: {start_ms}")
    
    num_drivers = len(driver_ids)
    total_threads = len(GLOBAL_STREAMS) + (num_drivers*len(DRIVER_STREAMS)) + 1
    race_barrier = threading.Barrier(total_threads)

    print(f"🛑 Waiting for {total_threads} streams to be ready...")
    
    with ThreadPoolExecutor(max_workers=total_threads + 5) as executor:
        #Global setup
        for stream in GLOBAL_STREAMS:
            executor.submit(stream_data, stream, session_key, None, clock, start_ms, race_barrier)
        # Drivers setup
        for d in driver_ids:
            time.sleep(0.05) # Stagger thread startup slightly
            for d_stream in DRIVER_STREAMS:
                executor.submit(stream_data, d_stream, session_key, d, clock, start_ms, race_barrier)
        
        try:
            while not STOP_EVENT.is_set():
                time.sleep(1)
        except KeyboardInterrupt:
            STOP_EVENT.set()

def handle_sigterm(*args):
    STOP_EVENT.set()

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, handle_sigterm)
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", type=int, required=True)
    parser.add_argument("--start_lap", type=int, default=1)
    args = parser.parse_args()
    start_simulation(args.session,args.start_lap)