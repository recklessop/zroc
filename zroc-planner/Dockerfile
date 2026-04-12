# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build tools needed to compile pyvmomi's C extension if required
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
        gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.12-slim

# Non-root user for security
RUN groupadd -r collector && useradd -r -g collector collector

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY config.py collector.py server.py ./

USER collector

# Metrics port
EXPOSE 9272

# Health check — Docker will poll this every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python - <<'EOF'
import urllib.request, sys
try:
    r = urllib.request.urlopen("http://localhost:9272/health", timeout=8)
    import json
    d = json.load(r)
    sys.exit(0 if d.get("status") == "ok" else 1)
except Exception:
    sys.exit(1)
EOF

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

ENTRYPOINT ["python", "server.py"]
