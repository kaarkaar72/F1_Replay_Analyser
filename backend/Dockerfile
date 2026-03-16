FROM python:3.9-slim

WORKDIR /app

# Install Docker CLI (So orchestrator can restart Flink)
RUN apt-get update && apt-get install -y curl docker.io

# Install Python Deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Code
COPY . .

# Default Command (Overridden by docker-compose)
CMD ["uvicorn", "orchestrator:app", "--host", "0.0.0.0", "--port", "8000"]