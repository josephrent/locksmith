FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./

# Create /app/.venv with prod deps
RUN uv sync --frozen --no-dev

COPY . .

# Make venv executables available
ENV PATH="/app/.venv/bin:$PATH"

# Fly will route to internal_port; PORT env is nice to honor too
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-lc", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
