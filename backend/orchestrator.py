import asyncio
import os
import dotenv
import sys
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from influxdb_client import InfluxDBClient
import subprocess
import redis
import requests
import json
import os
import signal
import uvicorn
from producer import to_ms

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
dotenv.load_dotenv()
REDIS_HOST = os.getenv("REDIS_HOST", "redis") 
r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "UPDATE_FOR_PERSONAL") 
INFLUX_ORG = "f1_org"
INFLUX_BUCKET = "f1_telemetry"
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
query_api = influx_client.query_api()
def get_headers():
    token = r.get("f1_api_token")
    if not token:
        print("⚠️ No Token in Redis! Waiting...")
        time.sleep(5)
        return get_headers()
    return {"accept": "application/json", "Authorization": f"Bearer {token}"}
HEADERS = get_headers()
# Global variable to track the running process
current_process = None

@app.get("/seasons")
def get_seasons():
    """Returns list of years. Caches in Redis for 1 day."""
    if r.exists("metadata:seasons"):
        return json.loads(r.get("metadata:seasons"))
    
    # Hardcoded for now, or fetch from OpenF1 if they had a years endpoint
    years = [2023, 2024, 2025]
    r.set("metadata:seasons", json.dumps(years), ex=86400)
    return years

@app.get("/meetings/{year}")
def get_meetings(year: int):
    """Fetches meetings for a year. Caches in Redis."""
    cache_key = f"metadata:meetings:{year}"
    if r.exists(cache_key):
        return json.loads(r.get(cache_key))
    
    url = f"https://api.openf1.org/v1/meetings?year={year}"
    data = requests.get(url,headers=HEADERS).json()
    r.set(cache_key, json.dumps(data), ex=86400)
    return data

@app.get("/sessions/{meeting_key}")
def get_sessions(meeting_key: int):
    """Fetches sessions (FP1, Quali, Race). Caches in Redis."""
    cache_key = f"metadata:sessions:{meeting_key}"
    if r.exists(cache_key):
        return json.loads(r.get(cache_key))
        
    url = f"https://api.openf1.org/v1/sessions?meeting_key={meeting_key}"
    data = requests.get(url).json()
    r.set(cache_key, json.dumps(data), ex=86400)
    return data

@app.get("/drivers/{session_key}")
def get_session_drivers(session_key: int):
    cache_key = f"metadata:drivers_grid:{session_key}" # Changed key name to force refresh
    if r.exists(cache_key):
        return json.loads(r.get(cache_key))
    
    # 1. Fetch Drivers (Names/Colors)
    drivers_url = f"https://api.openf1.org/v1/drivers?session_key={session_key}"
    drivers_data = requests.get(drivers_url,headers=HEADERS).json()
    
    # 2. Fetch Initial Positions (The Grid)
    # We fetch positions and look for the earliest timestamp
    pos_url = f"https://api.openf1.org/v1/position?session_key={session_key}"
    try:
        pos_data = requests.get(pos_url,headers=HEADERS).json()
    except:
        pos_data = []

    # Create a map: { driver_number: starting_position }
    grid_map = {}
    if pos_data:
        # Sort by date ascending
        pos_data.sort(key=lambda x: x['date'])
        
        for p in pos_data:
            d_num = p['driver_number']
            # Only set if we haven't seen this driver yet (The first record is the grid)
            if d_num not in grid_map:
                grid_map[d_num] = p['position']

    # 3. Merge Data
    clean_drivers = []
    seen = set()
    
    for d in drivers_data:
        num = d.get('driver_number')
        if num and num not in seen:
            clean_drivers.append({
                "driver_number": int(num),
                "name_acronym": d.get('broadcast_name', 'UNK'),
                "full_name": d.get('full_name', 'Unknown'),
                "team_colour": d.get('team_colour', '555555'),
                "team_name": d.get('team_name', 'Unknown'),
                "headshot_url": d.get('headshot_url', None),
                # NEW FIELD
                "grid_position": grid_map.get(num, 0) # 0 means Pit Lane/Unknown
            })
            seen.add(num)
            
    r.set(cache_key, json.dumps(clean_drivers), ex=86400)
    return clean_drivers

@app.post("/simulation/start")
def start_simulation(session_key: int,start_lap: int = 1):
    """Kills existing simulation and starts a new one."""
    global current_process
    
    # 1. Stop existing process
    stop_simulation()
    
    # 2. Start new Producer as a subprocess
    # We pass the session_key as an argument to the producer script
    # cache_drivers(session_key)  # Cache driver info before starting the simulation
    cmd = [sys.executable, "producer.py", "--session", str(session_key), "--start_lap",str(start_lap)]
    r.set("simulation:active", session_key)
    r.set("simulation:lap", start_lap)
    current_process = subprocess.Popen(cmd)
    restart_flink()
    return {"status": "started", "session": session_key, "pid": current_process.pid}

@app.post("/simulation/stop")
def stop_simulation():
    global current_process
    if current_process:
        current_process.terminate()
        current_process = None
        r.delete("simulation:active")
        return {"status": "stopped"}
    return {"status": "no_active_simulation"}


@app.post("/simulation/seek")
def seek_simulation(session_key: int, lap: int):
    print(f"⏩ Seeking Session {session_key} to Lap {lap}...")
    # 1. Stop current
    stop_simulation()
    start_simulation(session_key=session_key,start_lap=lap)
    return {"status": "seeking", "lap": lap}


@app.get("/simulation/status")
def get_simulation_status():
    active_key = r.get("simulation:active")
    start_lap = r.get("simulation:lap")
    if active_key:
        return {"active": True, 
                "session_key": int(active_key),
                "start_lap": int(start_lap) if start_lap else 1}
    return {"active": False, "session_key": None, "start_lap": 1}



@app.get("/analysis/laps/{session_key}/{driver_id}")
def get_driver_laps(session_key: int, driver_id: int,time: int = None):
    """Fetches lap history for scatter plot"""
    print(f"📊 Fetching Laps for {driver_id}...")
    if time:
        # Convert MS to Seconds
        ts_sec = time / 1000
        
        # Create Aware Datetime (UTC)
        dt = datetime.fromtimestamp(ts_sec,tz=timezone.utc)
        dt_stop = dt + timedelta(minutes=120)
        dt_start = dt - timedelta(minutes=120)
        stop_iso = dt_stop.isoformat() 
        start_iso = dt_start.isoformat()

    query = f"""
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: {start_iso}, stop: {stop_iso})
      |> filter(fn: (r) => r["_measurement"] == "laps")
      |> filter(fn: (r) => r["session"] == "s_{session_key}")
      |> filter(fn: (r) => r["driver"] == "{driver_id}")
      |> filter(fn: (r) => r["_field"] == "lap_duration")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["lap_number"])
    """
    try:
        result = query_api.query(query)
        # print(result)
        data = []
        for table in result:
            for record in table.records:
                vals = record.values
                lap_num = vals.get('lap_number')
                lap_dur = vals.get('lap_duration')
                # print(value)
                if lap_dur:
                    data.append({
                        "lap": int(lap_num), # Simple counter if lap_num missing
                        "time": float(lap_dur)
                    })
        return data
    except Exception as e:
        print(f"❌ Influx Error: {e}")
        return []



from datetime import datetime, timezone, timedelta
@app.get("/analysis/telemetry/{session_key}/{driver_id}")
def get_telemetry_trace(session_key: int, driver_id: int, time: int = None):
    """Fetches high-res telemetry for the last few minutes"""
    print(f"📊 Fetching Telemetry Trace for {driver_id}...")
    # print(time)
    if time:
        # Convert MS to Seconds
        ts_sec = time / 1000
        
        # Create Aware Datetime (UTC)
        dt_stop = datetime.fromtimestamp(ts_sec,tz=timezone.utc)
        dt_start = dt_stop - timedelta(minutes=2)
        
        # Format as ISO 8601 (Influx Requirement)
        stop_iso = dt_stop.isoformat() 
        start_iso = dt_start.isoformat()
        # print(start_iso,stop_iso)
        range_filter = f'|> range(start: {start_iso}, stop: {stop_iso})'

    else:
        # Live Mode: Window is [Now-2m, Now]
        range_filter = "|> range(start: -2m)"
    # Query last 2 minutes of Speed, Throttle, Brake
    # We use aggregateWindow to downsample to prevent UI lag (e.g. 1 point every 100ms)
    query = f"""
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: {start_iso}, stop: {stop_iso})
      |> filter(fn: (r) => r["session"] == "s_{session_key}")
      |> filter(fn: (r) => r["driver"] == "{driver_id}")
      |> filter(fn: (r) => r["_measurement"] == "telemetry")
      |> filter(fn: (r) => r["_field"] == "speed" or r["_field"] == "throttle" or r["_field"] == "brake")
      |> aggregateWindow(every: 200ms, fn: mean, createEmpty: false)
      |> yield(name: "mean")
    """
    
    
    try:
        result = query_api.query(query)
        data = []
        merged_data = {}
        for table in result:
            # print(table.records)
            for record in table.records:
                time_key = record.get_time().isoformat()
                field = record.get_field()
                value = record.get_value()
                
                if time_key not in merged_data:
                    merged_data[time_key] = {"time": time_key}
                
                merged_data[time_key][field] = value
        # print(data)
        # print(data)
        # print(merged_data)
        return sorted(list(merged_data.values()), key=lambda x: x['time'])
    except Exception as e:
        print(f"❌ Influx Error: {e}")
        return []


def get_lap_times_for_lap(session_key,driver_id,lap_number):
    session_info = get_session_info(session_key)
    date_str = session_info['date'].split('T')[0]
    laps_query = f"""
        from(bucket: "{INFLUX_BUCKET}")
        |> range(start: {date_str}T00:00:00Z, stop: {date_str}T23:59:59Z)
        |> filter(fn: (r) => r["session"] == "s_{session_key}")
        |> filter(fn: (r) => r["driver"] == "{driver_id}")
        |> filter(fn: (r) => r["_measurement"] == "laps")
        |> filter(fn: (r) => r["lap_number"] == "{lap_number}")
        |> filter(fn: (r) => r["_field"] == "start_time_ms" or r["_field"] == "end_time_ms")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        """
    laps_res = query_api.query(laps_query)
    if not laps_res or not laps_res[0].records:
        return []
    # print(laps_res) 
    lap_record = laps_res[0].records[0]
    start_ms = int(lap_record["start_time_ms"])
    end_ms = int(lap_record["end_time_ms"])
    start_iso = datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc).isoformat()
    stop_iso = datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc).isoformat()
    return start_iso,stop_iso

def get_telemetry_over_time(session_key,driver_id,start_iso,stop_iso):
    telemetry_query = f"""
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: {start_iso}, stop: {stop_iso})
            |> filter(fn: (r) => r["session"] == "s_{session_key}")
            |> filter(fn: (r) => r["driver"] == "{driver_id}")
            |> filter(fn: (r) => r["_field"] == "speed" or r["_field"] == "throttle" or r["_field"] == "brake" or r["_field"] == "gear" or r["_field"] == "x" or r["_field"] == "y")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["_time"])
        """

    result = query_api.query(telemetry_query)
    data = []
    total_dist = 0.0
    last_time = None
    for table in result:
        for record in table.records:
            # print(last_x,last_y,x,y,total_dist)
            current_time = record.get_time().timestamp()
            speed_kph = float(record.values.get("speed", 0))
            # x = float(record.values.get("x", 0))
            # y = float(record.values.get("y", 0))
            # print(last_x,last_y,x,y,total_dist)
            # if last_x == 0.0 and last_y == 0.0:
            #     last_x, last_y = x, y
            #     continue

            # if x != 0 and y != 0 and last_x != 0 and last_y != 0:
            #     dist_step = math.sqrt((x - last_x)**2 + (y - last_y)**2)
            #     if dist_step < 100: 
            #         total_dist += dist_step

            if last_time is not None:
                dt = current_time - last_time # Seconds
                speed_mps = speed_kph / 3.6
                dist_step = speed_mps * dt
                total_dist += dist_step

            data.append({
                "distance": int(total_dist),
                "speed": int(speed_kph),
                "throttle": int(record.values.get("throttle", 0)),
                "brake": int(record.values.get("brake", 0)),
                "gear": int(record.values.get("gear", 0)),
                "x": float(record.values.get("x", 0)),
                "y": float(record.values.get("y", 0)),
            })
                # last_x,last_y = x,y
            last_time = current_time

    for p in data:
        p['distance_pct'] = (p['distance'] / total_dist) * 100
    
    return data


def get_advanced_metrics_for_lap_telemetry(data):
    speeds = [p['speed'] for p in data]
    throttles = [p['throttle'] for p in data]
    
    metrics = {
        "max_speed": max(speeds) if speeds else 0,
        "avg_speed": sum(speeds)/len(speeds) if speeds else 0,
        "full_throttle_pct": (sum(1 for t in throttles if t > 99) / len(throttles)) * 100 if throttles else 0,
        "braking_zones": 0 # Logic to count big drops in speed
    }
    return metrics

def get_corner_metrics_for_lap_telemetry(data,corner_map):
    corner_stats = []
    for c in corner_map:
            c_dist = c['distance'] # e.g. 450m
            
            # Find telemetry point closest to this distance
            # Simple linear search or binary search
            closest_point = min(data, key=lambda p: abs(p['distance'] - c_dist))
            
            # We actually want MIN speed in the "Braking Zone" (e.g. +/- 50m around apex)
            # Filter points within 50m
            zone_points = [p for p in data if abs(p['distance'] - c_dist) < 50]
            min_speed = min([p['speed'] for p in zone_points]) if zone_points else 0
            
            corner_stats.append({
                "number": c['number'],
                "min_speed": int(min_speed),
                "apex_speed": int(closest_point['speed'])
            })
    return corner_stats




@app.get("/analysis/lap-telemetry/{session_key}/{driver_id}/{lap_number}")
def get_lap_telemetry_trace(session_key: int, driver_id: int, lap_number: int = None):
    cache_key = f"trace:{session_key}:{driver_id}:{lap_number}"
    if r.exists(cache_key):
        print(f"⚡ Serving Trace from Cache: {cache_key}")
        return json.loads(r.get(cache_key))
    
    try:
        start_lap_iso,stop_lap_iso = get_lap_times_for_lap(session_key,driver_id,lap_number)
        telemetry_data = get_telemetry_over_time(session_key,driver_id,start_lap_iso,stop_lap_iso)
        track_meta = json.loads(r.get(f"metadata:track:{session_key}"))
        corner_map = track_meta['corners']
        metrics = get_advanced_metrics_for_lap_telemetry(telemetry_data)
        corner_stats = get_corner_metrics_for_lap_telemetry(telemetry_data,corner_map)
        
        data = {"lap":lap_number,
                "telemetry":telemetry_data,
                "trace": telemetry_data[::15],
                "metrics":metrics,
                "corner_stat":corner_stats}
        if data:
            r.set(cache_key, json.dumps(data), ex=86400)
        
        return data
    except Exception as e:
        print(f"❌ Trace Error: {e}")
        return []



@app.get("/analysis/reference-lap/{session_key}")
def get_reference_lap_trace(session_key: int):
    # 1. Read Redis
    stats = r.hgetall(f"stats:{session_key}:fastest_lap")
    if not stats:
        return [] # No laps yet

    driver_id = int(stats['driver'])
    lap_num = int(stats['lap'])
    
    # 2. Fetch Telemetry for that specific Driver/Lap
    data = get_lap_telemetry_trace(session_key, driver_id, lap_num)
    return data


@app.get("/analysis/best-driver-lap/{session_key}/{driver_id}")
def get_reference_lap_trace_driver(session_key: int,driver_id: int):
    # 1. Read Redis
    stats = r.hgetall(f"stats:{session_key}:driver:{driver_id}:best_lap")
    if not stats:
        return [] # No laps yet
    lap_num = int(stats['lap'])
    # 2. Fetch Telemetry for that specific Driver/Lap
    return get_lap_telemetry_trace(session_key, driver_id, lap_num)

import subprocess
import time

def restart_flink():
    print("🔄 Restarting Flink Cluster...")
    
    # 1. Restart Containers
    subprocess.run(["docker", "restart", "f1-taskmanager-1", "f1-jobmanager-1"], check=True)
    
    # Wait for Flink to boot up (It takes more than 3 seconds usually)
    time.sleep(10) 
    
    print("🚀 Submitting SQL Job...")
    
    # 2. Submit Job (Non-Interactive)
    # We remove '-it'. We just want to execute the script and exit.
    try:
        result = subprocess.run(
            ["docker", "exec", "f1-jobmanager-1", "./bin/sql-client.sh", "-f", "/project/job.sql"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print("✅ Job Submitted Successfully")
        else:
            print(f"❌ Job Submission Failed:\n{result.stderr}")
            
    except Exception as e:
        print(f"❌ Subprocess Error: {e}")

    time.sleep(2)
@app.websocket("/ws/race")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Create a PubSub listener for this specific websocket connection
    pubsub = r.pubsub()
    pubsub.subscribe("f1-live-stream")
    
    try:
        while True:
            # Check for new message in Redis
            message = pubsub.get_message(ignore_subscribe_messages=True)
            
            if message:
                data = message['data']
                if isinstance(data, bytes):
                    data = data.decode('utf-8')
                await websocket.send_text(data)
                # await websocket.send_text(message['data'])
            
            # Tiny sleep to prevent CPU hogging loop
            await asyncio.sleep(0.01)
            
    except Exception as e:
        print(f"WebSocket disconnected: {e}")




@app.get("/session-info/{session_key}")
def get_session_info(session_key: int):
    """Returns Drivers + Track Metadata + Total Laps"""
    cache_key = f"metadata:full_session:{session_key}"
    if r.exists(cache_key):
        return json.loads(r.get(cache_key))
    
    # 1. Fetch Session Details (Name, Date)
    sess_url = f"https://api.openf1.org/v1/sessions?session_key={session_key}"
    print(sess_url)
    sess_data = requests.get(sess_url,headers=HEADERS).json()[0]
    
    # 2. Fetch Meeting Details (Circuit Name, Country)
    meet_url = f"https://api.openf1.org/v1/meetings?meeting_key={sess_data['meeting_key']}"
    meet_data = requests.get(meet_url,headers=HEADERS).json()[0]
    
    # 3. Calculate Total Laps (Max lap from data)
    # This is a heuristic: Fetch laps for the winner
    laps_url = f"https://api.openf1.org/v1/laps?session_key={session_key}"
    laps_data = requests.get(laps_url,headers=HEADERS).json()
    
    # 3. Calculate "Race Clock" Map (The Fix)
    lap_map = []
    total_laps = 0
    import pandas as pd
    if laps_data:
        df_laps = pd.DataFrame(laps_data)
        
        # Filter out garbage data
        df_laps = df_laps.dropna(subset=['date_start'])
        
        # Group by Lap Number -> Get Earliest Start Time (The Leader)
        # We sort by lap_number to ensure order
        leader_laps = df_laps.groupby('lap_number')['date_start'].min().reset_index().sort_values('lap_number')
        
        lap_map = []
        for _, row in leader_laps.iterrows():
            # Parse the ISO string
            # Handle the Z or +00:00 logic if needed, but fromisoformat usually handles it
            try:
                dt = datetime.fromisoformat(row['date_start'].replace('Z', '+00:00'))
                # Format as "14:24" (24-hour clock)
                time_str = dt.strftime("%H:%M")
            except:
                time_str = "--:--"

            lap_map.append({
                "lap": int(row['lap_number']),
                "start_time": time_str,
                "start_time_ms": to_ms(row['date_start']) # Send the clean string
            })
        
        # Get max lap
        total_laps = int(leader_laps['lap_number'].max())

    payload = {
        "name": meet_data['meeting_name'],
        "circuit": meet_data['circuit_short_name'],
        "circuit_type": meet_data['circuit_type'],
        "country": meet_data['country_name'],
        "location": meet_data['location'],
        "date": sess_data['date_start'],
        "total_laps": total_laps,
        "lap_map": lap_map,
        "circuit_image": meet_data.get('circuit_image')
    }
    
    r.set(cache_key, json.dumps(payload), ex=86400)
    return payload


from datetime import datetime, timedelta
import math
@app.get("/track/{session_key}")
def get_track_shape(session_key: int):
    cache_key = f"metadata:tracks:{session_key}"
    if r.exists(cache_key):
        return json.loads(r.get(cache_key))
    
    print(f"🗺️ Generating track map for {session_key}...")
    
    response_payload = {"shape": [], "corners": []}

    try:
        # 1. Get Circuit URL from Meeting
        sess_url = f"https://api.openf1.org/v1/sessions?session_key={session_key}"
        sess_data = requests.get(sess_url,headers=HEADERS).json()[0]
        meet_url = f"https://api.openf1.org/v1/meetings?meeting_key={sess_data['meeting_key']}"
        meet_data = requests.get(meet_url,headers=HEADERS).json()[0]
        circuit_url = meet_data.get('circuit_info_url')
        # print(circuit_    url) 
        if circuit_url:
            lap_headers = HEADERS | {'User-Agent': 'F1-Telemetry-App/1.0'}
            circuit_data = requests.get(circuit_url, headers=lap_headers).json()
            # print(circuit_data)
            # 2. Extract Shape (The X/Y Arrays)
            # The API gives separate lists: "x": [1,2,3], "y": [4,5,6]
            # We zip them into points: [{x:1, y:4}, {x:2, y:5}...]
            if 'x' in circuit_data and 'y' in circuit_data:
                shape = []
                total_dist = 0
                
                # We use the FULL resolution data for distance calculation accuracy
                # but only store the downsampled points for the frontend
                
                for i, (x, y) in enumerate(zip(circuit_data['x'], circuit_data['y'])):
                    
                    # Calculate distance from previous point
                    if i > 0:
                        prev_x = circuit_data['x'][i-1]
                        prev_y = circuit_data['y'][i-1]
                        dist = math.sqrt((x - prev_x)**2 + (y - prev_y)**2)
                        total_dist += dist
                    
                    # Store point (Downsampled)
                    if i % 5 == 0:
                        shape.append({"x": x, "y": y, "distance": int(total_dist)})
                
                response_payload["shape"] = shape

            # 3. Extract Corners & Map to Distance
            if 'corners' in circuit_data:
                for c in circuit_data['corners']:
                    if 'number' in c and 'trackPosition' in c:
                        cx = c['trackPosition']['x']
                        cy = c['trackPosition']['y']
                        
                        # Find closest point in our shape to get the distance
                        # We search the 'shape' array (which is downsampled, but close enough)
                        closest = min(response_payload["shape"], key=lambda p: (p['x']-cx)**2 + (p['y']-cy)**2)
                        
                        response_payload["corners"].append({
                            "number": str(c['number']),
                            "x": cx,
                            "y": cy,
                            "distance": int(c.get('length')),
                            "distance_calc": closest['distance'],
                            "distance_pct": (closest['distance'] / total_dist)*100 # <--- NEW FIELD
                        })
            if 'marshalSectors' in circuit_data:
                sectors = []
                for s in circuit_data['marshalSectors']:
                    if 'trackPosition' in s:
                        sectors.append({
                            "number": str(s['number']),
                            "x": s['trackPosition']['x'],
                            "y": s['trackPosition']['y'],
                            "angle": s.get('angle', 0),
                            "distance": s.get('length') # Useful for rotation
                        })
                response_payload["sectors"] = sectors

    except Exception as e:
        print(f"❌ Track Error: {e}")

    r.set(cache_key, json.dumps(response_payload,indent=2), ex=86400 * 7)
    print(response_payload)
    return response_payload



if __name__ == "__main__":
    # This runs the server directly using the current Python environment
    uvicorn.run(app, host="127.0.0.1", port=8000)
