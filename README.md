# ARIA — Voice AI Cofounder

ARIA is a voice-first AI cofounder that lives in your browser. She listens,
thinks, and talks back — tracking clients, monitoring deals, and staying
in your corner 24/7.

## Deploy on a VPS (one command)

**1. Clone**

    git clone https://github.com/Iceman0113/ARIA.git && cd ARIA

**2. Configure**

    cp server/.env.example server/.env
    nano server/.env

**3. Launch**

    docker compose up -d

ARIA is now running:
- Frontend: http://YOUR_VPS_IP
- Server: ws://YOUR_VPS_IP:3001

On first load, enter ws://YOUR_VPS_IP:3001 as the server URL.

## Requirements

- Docker + Docker Compose
- Anthropic API key (https://console.anthropic.com)
- Chrome or Edge (voice requires Web Speech API)

## Development

Server:

    cd server && npm install && npm run dev

Client (separate terminal):

    cd client && npm install && npm run dev

Open http://localhost:5173 and use ws://localhost:3001 as the server URL.

## Environment Variables

ANTHROPIC_API_KEY  (required) Powers ARIA's intelligence
COMPANY_NAME       (optional) Your company name
COFOUNDER_NAME     (optional) ARIA's name (default: ARIA)
STRIPE_SECRET_KEY  (optional) Enables revenue tracking
GITHUB_TOKEN       (optional) Enables repo monitoring
PORT               (optional) Server port (default: 3001)

## Voice cloning (self-hosted)

ARIA can speak in a cloned voice via a local XTTS-v2 service (no third party).

Run three processes locally:

    # 1. TTS engine (native — NOT Docker; needs the Mac GPU)
    cd tts-service && ./.venv/bin/uvicorn app:app --port 8020
    # 2. server
    cd server && npm run dev
    # 3. client
    cd client && npm run dev

Set `TTS_PROVIDER=clone` in `server/.env`, open the **Voice** tab, upload a
6–15s clip, set it active, and hit **Preview**. If the engine is down, ARIA
automatically falls back to Edge TTS.

See `tts-service/README.md` for first-time setup (Python 3.11 venv + model download).
