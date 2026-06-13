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
