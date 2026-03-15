-- 1. Source: Telemetry
CREATE TABLE Telemetry (
    driver_number INT,
    session_key INT,
    speed INT,
    rpm INT,
    throttle INT,
    brake INT,
    n_gear INT,
    event_time_ms BIGINT,
    event_time AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'f1-telemetry2',
    'properties.bootstrap.servers' = 'redpanda:29092',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'json'
);

-- 2. Source: Location
CREATE TABLE Location (
    driver_number INT,
    session_key INT,
    x FLOAT,
    y FLOAT,
    z FLOAT,
    event_time_ms BIGINT,
    event_time AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
    WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'f1-location2',
    'properties.bootstrap.servers' = 'redpanda:29092',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'json'
);

-- 3. Sink: Enriched Fast Data
CREATE TABLE EnrichedFast (
    driver_number INT,
    session_key INT,
    speed INT,
    rpm INT,
    throttle INT,
    brake INT,
    n_gear INT,
    x FLOAT,
    y FLOAT,
    event_time_ms BIGINT
) WITH (
    'connector' = 'kafka',
    'topic' = 'f1-enriched2', -- New Topic Name
    'properties.bootstrap.servers' = 'redpanda:29092',
    'format' = 'json'
);

-- 4. The Logic: Interval Join (High Frequency)
INSERT INTO EnrichedFast
SELECT 
    T.driver_number,
    T.session_key,
    T.speed,
    T.rpm,
    T.throttle,
    T.brake,
    T.n_gear,
    L.x,
    L.y,
    T.event_time_ms
FROM Telemetry T
JOIN Location L ON 
    T.driver_number = L.driver_number AND
    T.session_key = L.session_key AND
    L.event_time BETWEEN T.event_time - INTERVAL '0.1' SECOND AND T.event_time + INTERVAL '0.1' SECOND;