import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import uvicorn


MODEL_NAME = os.getenv("LOCAL_WHISPER_MODEL", "small")
COMPUTE_TYPE = os.getenv("LOCAL_WHISPER_COMPUTE_TYPE", "int8")
DEVICE = os.getenv("LOCAL_WHISPER_DEVICE", "cpu")
HOST = os.getenv("LOCAL_WHISPER_HOST", "127.0.0.1")
PORT = int(os.getenv("LOCAL_WHISPER_PORT", "9000"))
VAD_FILTER = os.getenv("LOCAL_WHISPER_VAD_FILTER", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
VAD_MIN_SILENCE_MS = int(os.getenv("LOCAL_WHISPER_VAD_MIN_SILENCE_MS", "350"))


app = FastAPI(title="Local Whisper Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "endpoint": "/transcribe",
        "vadFilter": VAD_FILTER,
        "vadMinSilenceMs": VAD_MIN_SILENCE_MS,
    }


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile | None = File(default=None),
    file: UploadFile | None = File(default=None),
):
    upload = audio or file
    if upload is None:
        raise HTTPException(status_code=400, detail="audio or file is required")

    suffix = Path(upload.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name
        tmp.write(await upload.read())

    try:
        segments, info = model.transcribe(
            temp_path,
            language="en",
            vad_filter=VAD_FILTER,
            vad_parameters={"min_silence_duration_ms": VAD_MIN_SILENCE_MS},
            beam_size=1,
            temperature=0.0,
        )
        output_segments = []
        transcript_parts = []
        for seg in segments:
            text = (seg.text or "").strip()
            transcript_parts.append(text)
            output_segments.append(
                {
                    "start": float(seg.start),
                    "end": float(seg.end),
                    "text": text,
                    "start_ms": int(float(seg.start) * 1000),
                    "end_ms": int(float(seg.end) * 1000),
                }
            )

        transcript = " ".join(part for part in transcript_parts if part).strip()
        if not transcript:
            # Retry once without VAD for very short/quiet recordings.
            retry_segments, retry_info = model.transcribe(
                temp_path,
                language="en",
                vad_filter=False,
                beam_size=1,
                temperature=0.0,
            )
            output_segments = []
            transcript_parts = []
            for seg in retry_segments:
                text = (seg.text or "").strip()
                transcript_parts.append(text)
                output_segments.append(
                    {
                        "start": float(seg.start),
                        "end": float(seg.end),
                        "text": text,
                        "start_ms": int(float(seg.start) * 1000),
                        "end_ms": int(float(seg.end) * 1000),
                    }
                )
            transcript = " ".join(part for part in transcript_parts if part).strip()
            info = retry_info
        return {
            "text": transcript,
            "segments": output_segments,
            "language": getattr(info, "language", "en"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
