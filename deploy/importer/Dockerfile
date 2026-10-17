FROM node:24.18.0-bookworm-slim AS javascript
FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=javascript /usr/local/bin/node /usr/local/bin/node
RUN pip install --no-cache-dir 'yt-dlp[default]==2026.8.19'
COPY relay.py /opt/relay.py
ENV HOME=/tmp PYTHONDONTWRITEBYTECODE=1 LANG=C.UTF-8
ENTRYPOINT ["python", "/opt/relay.py"]
