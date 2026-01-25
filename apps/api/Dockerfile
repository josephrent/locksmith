FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./

ENV UV_PROJECT_ENVIRONMENT=/app/.venv

# Create /app/.venv with prod deps
RUN uv sync --frozen --no-dev

# Sanity check
RUN /app/.venv/bin/python -m uvicorn --version

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["/bin/sh", "-lc", "/app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
