# ── EduAgent Backend Dockerfile ────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for compilation & libgomp (required by XGBoost/LightGBM)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (leverage Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the SentenceTransformer model at build time so it is baked into
# the image. This avoids any network downloads when the container starts.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the application source
COPY . .

# Create the uploads directory
RUN mkdir -p /app/uploads

# Expose the FastAPI port
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
