FROM python:3.9-slim

WORKDIR /app

# Install system dependencies (curl, docker cli)
RUN apt-get update && apt-get install -y curl docker.io

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all python scripts
COPY . .

# Default command (can be overridden)
CMD ["python", "auth.py"]