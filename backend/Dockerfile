FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY server.py .

# Cache lives on a mounted volume in production; create the dir for local use
RUN mkdir -p /app/cache

EXPOSE 5001

# Single worker — FastF1's in-memory lru_cache is not safe across multiple workers
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--timeout", "300", "--keep-alive", "5", "server:app"]
