from kafka import KafkaConsumer
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import redis
import json
import sys
import os
import time

# --- CONFIGURATION ---
KAFKA_SERVER = os.getenv("KAFKA_SERVER", "redpanda:9092")
INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "Get your own") 
INFLUX_ORG = "f1_org"
INFLUX_BUCKET = "f1_telemetry"
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = 6379

# --- 1. SETUP CONNECTIONS ---
print("🔌 Connecting to Services...")

try:
    # Redis
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    redis_client.ping()
    print("✅ Redis Connected")

    # InfluxDB
    influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    write_api = influx_client.write_api(write_options=SYNCHRONOUS)
    print("✅ InfluxDB Connected")

    # Kafka Consumer
    consumer = KafkaConsumer(
        "f1-enriched2", # Note: Ensure your Flink job outputs to this topic name
        "f1-pit2",
        "f1-intervals2",
        "f1-position2",
        "f1-weather2",
        "f1-laps2",
        "f1-alerts2",
        "f1-overtakes2",
        bootstrap_servers=KAFKA_SERVER,
        auto_offset_reset='latest',
        value_deserializer=lambda x: json.loads(x.decode('utf-8'))
    )
    print("✅ Kafka Consumer Listening...")

except Exception as e:
    print(f"❌ Connection Error: {e}")
    sys.exit(1)

# --- 2. PROCESSING LOOP ---
for message in consumer:
    try:
        topic = message.topic
        data = message.value
        driver_id = str(data.get('driver_number', 'unknown'))
        event_time = int(data.get('event_time_ms', time.time() * 1000))
        redis_key = f"driver:{driver_id}"
        


        # --- CASE 1: FAST STREAM (Telemetry + Map) ---
        if topic == 'f1-enriched2' or ('speed' in data):
            # 1. Write History to Influx
            session_key = str(data.get('session_key'))
            # print(session_key)
            point = Point("telemetry") \
                .tag("driver", driver_id) \
                .tag("session",f"s_{session_key}")\
                .field("speed", float(data.get('speed', 0))) \
                .field("rpm", float(data.get('rpm', 0))) \
                .field("throttle", int(data.get('throttle', 0))) \
                .field("brake", int(data.get('brake', 0)))\
                .field("gear",data.get('n_gear'))\
                .field("x",data.get('x'))\
                .field("y",data.get('y'))\
                .time(event_time, write_precision='ms')
            write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
            # print(event_time)
            # 2. Update Live Map in Redis
            redis_client.hset(redis_key, mapping={
                "speed": data.get('speed'),
                "rpm": data.get('rpm'),
                "throttle": data.get('throttle'),
                "brake": data.get('brake'),
                "gear": data.get('n_gear'),
                "x": data.get('x'),
                "y": data.get('y')
            })

            # 3. ENRICHMENT: Fetch Context from Redis
            # We grab Gap, Position, Lap, and Pit stats to send to Frontend
            context = redis_client.hmget(redis_key, ["gap", "position", "lap", "pit_count", "last_pit_duration", "is_pitting"])
            
            cached_gap = context[0] or "+0.0s"
            cached_pos = int(context[1]) if context[1] else 99
            cached_lap = int(context[2]) if context[2] else 0
            cached_pits = int(context[3]) if context[3] else 0
            last_pit_duration = float(context[4]) if context[4] else 0.0
            is_pitting = int(context[5]) if context[5] else 0

            # 4. Publish to Frontend
            frontend_payload = {
                "driver_id": driver_id,
                "speed": data.get('speed'),
                "rpm": data.get('rpm'),
                "throttle": data.get('throttle'),
                "brake": data.get('brake'),
                "gear": data.get('n_gear'),
                "x": data.get('x'),
                "y": data.get('y'),
                # Enriched Fields
                "gap": cached_gap,
                "position": cached_pos,
                "lap": cached_lap,
                "pit_count": cached_pits,
                "last_pit_duration": last_pit_duration,
                "is_pitting": is_pitting,
                "timestamp": data['event_time_ms']
            }
            # print(f"{data['event_time_ms']}")
            redis_client.publish("f1-live-stream", json.dumps(frontend_payload))

        # --- CASE 2: PIT STOP (The Alert) ---
        elif topic == 'f1-pit2':
            pit_duration = float(data.get('pit_duration', 0))
            stop_duration = float(data.get('stop_duration',0))
            lane_duration = float(data.get('lane_duration',0))

            # Update Redis Stats
            new_count = redis_client.hincrby(redis_key, "pit_count", 1)
            redis_client.hset(redis_key, mapping={
                "is_pitting": 0, # Clear pitting flag (stop is done)
                "last_pit_duration": pit_duration,
                "last_stop_duration": stop_duration,
                "last_lane_duration": lane_duration
            })

            # Publish Alert Event
            pit_payload = {
                "type": "pit_alert", # Special type for Frontend
                "driver_id": driver_id,
                "pit_count": int(new_count),
                "last_pit_duration": pit_duration,
                "last_stop_duration": stop_duration,
                "last_lane_duration": lane_duration,
                "timestamp": data['event_time_ms']
            }
            redis_client.publish("f1-live-stream", json.dumps(pit_payload))
            print(f"🛠️ Driver {driver_id} Pit Complete: {pit_duration}s, {lane_duration}s, {stop_duration}s")

        # --- CASE 3: LAPS & POSITION ---
        elif topic == 'f1-laps2':
            # If they just finished an out-lap, ensure pit flag is cleared
            if data.get('is_pit_out_lap'):
                redis_client.hset(redis_key, mapping={"is_pitting": 0})
            event_time = int(data.get('event_time_ms', time.time() * 1000))
            session_key = str(data.get('session_key'))
            lap_duration = float(data.get('lap_duration', 0))
            try:
                start_time_ms = event_time - int(lap_duration * 1000)
                if lap_duration > 0:
                    point = Point("laps") \
                    .tag("driver", driver_id) \
                    .tag("session", f"s_{session_key}") \
                    .tag("lap_number", int(data.get('lap_number', 0))) \
                    .field("lap_duration", lap_duration) \
                    .field("start_time_ms", start_time_ms) \
                    .field("end_time_ms", event_time)  \
                    .field("s1",data.get('duration_sector_1') or 0) \
                    .field("s2",data.get('duration_sector_2') or 0) \
                    .field("s3",data.get('duration_sector_3') or 0) \
                    .field("segments_s1",json.dumps(data['segments_sector_1'])) \
                    .field("segments_s2",json.dumps(data['segments_sector_2'])) \
                    .field("segments_s3",json.dumps(data['segments_sector_3'])) \
                    .time(event_time, write_precision='ms')
                    write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
                    print(f"💾 Saved Lap {data['lap_number']} to Influx")
            except Exception as e:
                print(f"Influx Write Error: {e}")

            lap = int(data.get('lap_number') or 0)
            record_key = f"stats2:{session_key}:fastest_lap"
            pb_key = f"stats2:{session_key}:driver:{driver_id}:best_lap"
            current_lap_pb_record = redis_client.hgetall(record_key)
            current_driver_pb_record = redis_client.hgetall(pb_key)
            current_lap_pb = float(current_lap_pb_record.get('time', 0) or float('inf'))
            current_driver_pb = float(current_driver_pb_record.get('time',0) or float('inf'))
            
            print(current_lap_pb,current_driver_pb,lap_duration)
            
            if lap_duration < current_lap_pb:
                print(f"🚀 New Fastest Lap! Driver {driver_id} - {lap_duration}s")
                redis_client.hset(record_key, mapping={
                    "time": lap_duration,
                    "driver": driver_id,
                    "lap": lap
                })
            if lap_duration < current_driver_pb:
                redis_client.hset(pb_key, mapping={"time": lap_duration, "driver":driver_id,"lap": lap})
            redis_client.hset(redis_key, mapping={
                "lap": lap,
                "s1": data.get('duration_sector_1') or 0,
                "s2": data.get('duration_sector_2') or 0,
                "s3": data.get('duration_sector_3') or 0,
                "segments_s1": json.dumps(data['segments_sector_1']),
                "segments_s2": json.dumps(data['segments_sector_2']),
                "segments_s3": json.dumps(data['segments_sector_3'])
            })

            lap_payload = {
                "driver_id": driver_id,
                "lap": lap,
                "lap_duration": lap_duration,
                "s1": data.get('duration_sector_1'),
                "s2": data.get('duration_sector_2'),
                "s3": data.get('duration_sector_3'),
                "segments_s1": data.get('segments_sector_1'), # Send the list directly
                "segments_s2": data.get('segments_sector_2'),
                "segments_s3": data.get('segments_sector_3')
            }
            redis_client.publish("f1-live-stream", json.dumps(lap_payload))
            print(f"🏁 Driver {driver_id} Lap {lap}")

        elif topic == 'f1-position2':
            pos = int(data.get('position', 0))
            redis_client.hset(redis_key, mapping={"position": pos})

        elif topic == 'f1-intervals2':
            gap = data.get('gap_to_leader')
            if gap is None: gap = "+0.0s"
            redis_client.hset(redis_key, mapping={"gap": str(gap)})

        # --- CASE 4: GLOBAL EVENTS ---
        elif topic == 'f1-weather2':
            weather_payload = {
                "type": "weather",
                "air_temp": data.get('air_temperature'),
                "track_temp": data.get('track_temperature'),
                "humidity": data.get('humidity'),
                "rainfall": data.get('rainfall'),
                "timestamp": data['event_time_ms']
            }
            redis_client.publish("f1-live-stream", json.dumps(weather_payload))
            print(f"🌦️ Weather: {data.get('air_temperature')}°C")

        elif topic == 'f1-alerts2':
            alert_payload = {
                "type": "race_control",
                "category": data.get('category'),
                "message": data.get('message'),
                "flag": data.get('flag'),
                "timestamp": data['event_time_ms']
            }
        
            redis_client.publish("f1-live-stream", json.dumps(alert_payload))
            print(f"📢 ALERT: {data.get('message')}")
        elif topic == 'f1-overtakes2':
            alert_payload = {
                "type": "overtake",
                "overtaken_driver_number": data.get('overtaken_driver_number'),
                "overtaking_driver_number": data.get('overtaking_driver_number'),
                "position": data.get('position'),
                "timestamp": data['event_time_ms']
            }
            redis_client.publish("f1-live-stream", json.dumps(alert_payload))
            print(f"📢 ALERT: {data.get('message')}")

        # --- CLEANUP ---
        # Only expire driver keys, not global ones
        if driver_id != 'unknown':
            redis_client.expire(redis_key, 60)

    except Exception as e:
        print(f"⚠️ Processing Error: {e}")