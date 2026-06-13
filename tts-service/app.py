from fastapi import FastAPI, Request, Response, HTTPException
from pydantic import BaseModel
from engine import XttsEngine

app = FastAPI(title="ARIA TTS")
app.state.engine = XttsEngine()


def get_engine(request: Request):
    return request.app.state.engine


@app.get("/health")
def health(request: Request):
    eng = get_engine(request)
    return {"status": "ok", "model_loaded": eng.loaded, "voices": eng.list_voices()}


@app.get("/voices")
def list_voices(request: Request):
    return {"voices": get_engine(request).list_voices()}


@app.post("/voices/{voice_id}")
async def register_voice(voice_id: str, request: Request):
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="empty clip body")
    eng = get_engine(request)
    eng.register(voice_id, body)
    return {"voices": eng.list_voices()}
