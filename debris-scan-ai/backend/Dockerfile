FROM python:3.11-slim

# Install system libraries required by OpenCV and networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install lightweight CPU-only PyTorch (fast build, low memory footprint for free cloud tiers)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache YOLO11n nano model (5.4MB) during build
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n.pt')"

# Copy application source code
COPY . .

# Cloud platforms like Render pass $PORT dynamically
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
