# F1 Replay Analyser

A real-time Formula 1 race replay and telemetry analysis platform. Streams historical race data from the [OpenF1 API](https://openf1.org/) through a live streaming pipeline and presents it on an interactive dashboard — as if the race is happening right now.

## Architecture

```
OpenF1 API
    │
    ▼
Producer (Python)
    │  Pushes per-stream Kafka topics
    ▼
Redpanda (Kafka-compatible)
    │  f1-telemetry2, f1-location2, ...
    ▼
Apache Flink (SQL Job)
    │  Interval-joins Telemetry + Location → f1-enriched2
    ▼
Consumer (Python)
    ├── Writes time-series data → InfluxDB
    └── Publishes live state   → Redis Pub/Sub
                                       │
                                       ▼
                               FastAPI Orchestrator
                               ├── REST API (metadata, analysis)
                               └── WebSocket /ws/race
                                       │
                                       ▼
                               React Frontend (Vite)
```

### Services

| Service | Role |
|---|---|
| **Redpanda** | Kafka-compatible message broker |
| **Apache Flink** | Stream processing — joins telemetry + GPS location |
| **InfluxDB** | Time-series store for lap history and telemetry traces |
| **Redis** | Metadata cache + pub/sub bus for WebSocket fan-out |
| **Backend (FastAPI)** | REST + WebSocket API; manages simulation lifecycle |
| **Producer** | Replays OpenF1 historical data at 1× real-time speed |
| **Consumer** | Writes to InfluxDB; enriches and publishes to frontend |
| **Frontend (React)** | Live dashboard: track map, timing, analysis panels |

## Features

- **Race Replay** — Select any season, meeting, and session; replay from any lap
- **Live Track Map** — Real-time driver positions overlaid on the circuit layout
- **Live Timing Board** — Gaps, lap counts, pit stops, sector splits
- **Race Control Feed** — Flag messages, safety car, overtake events, pit alerts
- **Weather Widget** — Air/track temperature, humidity, rainfall
- **Driver Analysis Panel** — Lap time scatter, sector splits, telemetry trace (speed / throttle / brake vs distance)
- **Driver Comparison Panel** — Side-by-side telemetry and lap comparison between any two drivers
- **Advanced Metrics** — Cornering efficiency, braking efficiency, throttle smoothness, gear-change aggression, G-force utilisation, line consistency, acceleration gradient, and more

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- An [OpenF1](https://openf1.org/) API access token (stored in `F1_AUTH.pem`)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/kaarkaar72/F1_Replay_Analyser.git
cd F1_Replay_Analyser
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# InfluxDB
INFLUX_USER=admin
INFLUX_PW=yourpassword
INFLUX_ORG=f1_org
INFLUX_BUCKET=f1_telemetry
INFLUX_TOKEN=your-influxdb-token

# OpenF1 API
F1_ACCESS_TOKEN=your-openf1-api-token
```

### 3. Start all services

```bash
docker compose up --build
```

This starts: Redpanda, InfluxDB, Redis, the auth service, Flink (JobManager + TaskManager), the FastAPI backend, the consumer, and the React frontend.

### 4. Open the dashboard

Navigate to [http://localhost:5173](http://localhost:5173).

Use the **Settings** panel (gear icon, top-left) to:
1. Select a season → meeting → session
2. Click **Start** to begin the replay

## Usage

### Replay Controls

- **Start** — Begins streaming from the selected session's Lap 1
- **Seek** — Jump to any lap via the timeline scrubber at the bottom
- **Stop** — Halts the producer and clears the active simulation

### Analysis

Click any driver row in the Live Timing board to open their **Driver Analysis Panel**, which shows:

- Lap time history (scatter plot with sector breakdown)
- Telemetry trace for any selected lap (speed, throttle, brake vs track distance)
- Corner-by-corner min/apex speed
- Advanced metrics sidebar

Click **Compare** on the track map to open the **Driver Comparison Panel** for any two drivers.

## API Reference

The FastAPI backend exposes the following endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/seasons` | Available seasons |
| `GET` | `/meetings/{year}` | Meetings for a season |
| `GET` | `/sessions/{meeting_key}` | Sessions for a meeting |
| `GET` | `/drivers/{session_key}` | Driver grid with starting positions |
| `POST` | `/simulation/start` | Start or restart the replay |
| `POST` | `/simulation/stop` | Stop the replay |
| `POST` | `/simulation/seek` | Seek to a specific lap |
| `GET` | `/simulation/status` | Current simulation state |
| `GET` | `/session-info/{session_key}` | Session metadata + lap map |
| `GET` | `/track/{session_key}` | Circuit shape, corners, marshal sectors |
| `GET` | `/analysis/laps/{session_key}/{driver_id}` | Full lap history + stats |
| `GET` | `/analysis/telemetry/{session_key}/{driver_id}` | High-res telemetry window |
| `GET` | `/analysis/lap-telemetry/{session_key}/{driver_id}/{lap_number}` | Per-lap telemetry trace + metrics |
| `GET` | `/analysis/reference-lap/{session_key}` | Session fastest lap telemetry |
| `GET` | `/analysis/best-driver-lap/{session_key}/{driver_id}` | Driver's personal best lap telemetry |
| `WS` | `/ws/race` | WebSocket — live telemetry + events |

## Tech Stack

**Backend**
- Python 3.9, FastAPI, Uvicorn
- Apache Flink 1.17 (Flink SQL, Kafka connector)
- Redpanda (Kafka API)
- InfluxDB 2.7
- Redis
- kafka-python, influxdb-client, pandas

**Frontend**
- React 18, Vite
- Tailwind CSS 3
- Recharts
- Lucide React

## Project Structure

```
.
├── backend/
│   ├── auth.py           # Fetches + caches the OpenF1 API token in Redis
│   ├── producer.py       # Replays OpenF1 data into Kafka at real-time speed
│   ├── consumer.py       # Kafka → InfluxDB + Redis pub/sub
│   ├── orchestrator.py   # FastAPI app: REST API + WebSocket + Flink management
│   ├── job.sql           # Flink SQL: joins Telemetry + Location → EnrichedFast
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── RaceControl.jsx        # Sidebar: session selector + replay controls
│   │       ├── TrackMap.jsx           # SVG track map with live driver dots
│   │       ├── DriverRow.jsx          # Single driver card in the timing board
│   │       ├── DriverAnalysisPanel.jsx
│   │       ├── DriverComparePanel.jsx
│   │       ├── DriverTrackMap.jsx     # Mini track map inside analysis panel
│   │       ├── RaceTimeline.jsx       # Lap scrubber / seek bar
│   │       ├── SessionHeader.jsx
│   │       ├── WeatherWidget.jsx
│   │       ├── LoadingOverlay.jsx
│   │       ├── LiveFeed.jsx
│   │       ├── NotificationFeed.jsx
│   │       └── DebugConsole.jsx
│   └── Dockerfile
├── Dockerfile.flink
├── Dockerfile.frontend
├── docker-compose.yml
└── .env                  # Not committed — see Setup above
```

## Notes

- **Formation lap** (OpenF1 lap 1) is filtered out automatically. The frontend and InfluxDB use 1-indexed racing laps only.
- Metadata (meetings, sessions, drivers, track shape) is cached in Redis for 24 hours to reduce API calls.
- The producer loads all session data into a local `race_cache/` directory on first run; subsequent replays of the same session are served from disk.
- Flink is restarted automatically each time a new simulation is started so the SQL job picks up the latest Kafka offsets.
