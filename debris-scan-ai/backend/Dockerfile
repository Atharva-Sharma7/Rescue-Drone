FROM python:3.11-slim

# Install system dependencies for OpenCV and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLO model at build time so runtime boot is instant
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"

# Copy backend application files
COPY . .

# Expose port (default 8000 or $PORT)
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
