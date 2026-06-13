# ARIA TTS service (XTTS-v2 voice cloning)

Native (NOT Docker — macOS Docker has no Metal GPU access).

## Setup
    brew install python@3.11 ffmpeg
    cd tts-service
    /opt/homebrew/bin/python3.11 -m venv .venv
    ./.venv/bin/pip install -r requirements.txt

First run downloads the XTTS-v2 model (~2GB) to ~/Library/Application Support/tts.

## Run
    ./.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8020

## Test (no model download)
    ./.venv/bin/pip install -r requirements-dev.txt
    TTS_SKIP_PREWARM=1 ./.venv/bin/python -m pytest -v
