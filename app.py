import os
import tempfile
import time
from pathlib import Path

import streamlit as st
import whisper
import yt_dlp


st.set_page_config(
    page_title="TranscBot YouTube",
    page_icon="🎙️",
    layout="wide",
)

MODEL_OPTIONS = ("tiny", "base", "small", "medium")


@st.cache_resource(show_spinner=False)
def load_whisper_model(model_name: str):
    return whisper.load_model(model_name)


def format_timestamp(seconds: float) -> str:
    total_seconds = max(0, int(seconds))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def download_audio(url: str, destination: str) -> str:
    output_template = os.path.join(destination, "audio.%(ext)s")
    options = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        downloader.download([url])

    audio_path = os.path.join(destination, "audio.mp3")
    if not os.path.isfile(audio_path):
        raise FileNotFoundError(
            "O áudio não foi criado. Verifique o FFmpeg e o link informado."
        )
    return audio_path


def transcribe_audio(audio_path: str, model_name: str, progress_bar, status_box, text_box):
    model = load_whisper_model(model_name)
    audio = whisper.load_audio(audio_path)
    sample_rate = whisper.audio.SAMPLE_RATE
    duration = len(audio) / sample_rate
    block_size = 30 * sample_rate
    segments = []
    started_at = time.monotonic()

    for block_start in range(0, len(audio), block_size):
        block = audio[block_start:block_start + block_size]
        offset = block_start / sample_rate
        result = model.transcribe(
            block,
            language="pt",
            fp16=False,
            verbose=False,
        )

        block_lines = []
        for segment in result.get("segments", []):
            text = segment.get("text", "").strip()
            if text:
                segment_data = {
                    "start": offset + segment["start"],
                    "end": offset + segment["end"],
                    "text": text,
                }
                segments.append(segment_data)
                block_lines.append(
                    f"[{format_timestamp(segment_data['start'])}] {text}"
                )

        processed = min(offset + len(block) / sample_rate, duration)
        percent = processed / duration if duration else 1.0
        elapsed = time.monotonic() - started_at
        eta = elapsed * (duration - processed) / processed if processed else 0
        minutes, seconds = divmod(max(0, int(eta)), 60)

        progress_bar.progress(percent)
        status_box.info(
            f"{percent * 100:.1f}% concluído • tempo restante aproximado: "
            f"{minutes:02d}:{seconds:02d}"
        )
        if block_lines:
            text_box.text("\n".join(
                f"[{format_timestamp(item['start'])}] {item['text']}"
                for item in segments
            ))

    return segments


def transcription_as_text(segments: list[dict]) -> str:
    return "\n".join(
        f"[{format_timestamp(segment['start'])}] "
        f"{' '.join(segment['text'].split())}"
        for segment in segments
    ) + "\n"


st.title("🎙️ TranscBot YouTube")
st.caption("Baixe o áudio e transcreva vídeos localmente com Whisper.")

with st.sidebar:
    st.header("Configurações")
    model_name = st.selectbox(
        "Modelo Whisper",
        MODEL_OPTIONS,
        index=2,
        help="Modelos maiores tendem a ser mais precisos, mas demoram mais.",
    )
    st.markdown(
        "O processamento ocorre no servidor da aplicação. "
        "O arquivo temporário é removido ao final."
    )

url = st.text_input(
    "Link do vídeo do YouTube",
    placeholder="https://www.youtube.com/watch?v=...",
)
output_name = st.text_input("Nome do arquivo", value="transcricao.txt")

if not output_name.lower().endswith(".txt"):
    output_name += ".txt"

start = st.button("Iniciar transcrição", type="primary", use_container_width=True)

if start:
    if not url.strip():
        st.error("Informe um link do YouTube.")
        st.stop()

    progress_bar = st.progress(0)
    status_box = st.empty()
    text_box = st.empty()

    try:
        with tempfile.TemporaryDirectory(prefix="transcbot_") as temp_dir:
            status_box.info("Baixando o áudio do YouTube...")
            audio_path = download_audio(url.strip(), temp_dir)
            status_box.info("Transcrevendo localmente com Whisper...")
            segments = transcribe_audio(
                audio_path,
                model_name,
                progress_bar,
                status_box,
                text_box,
            )

        if not segments:
            raise ValueError("Nenhum trecho de fala foi encontrado no vídeo.")

        transcription = transcription_as_text(segments)
        progress_bar.progress(1.0)
        status_box.success("100% concluído • transcrição finalizada.")
        st.download_button(
            "Baixar transcrição TXT",
            data=transcription.encode("utf-8"),
            file_name=Path(output_name).name,
            mime="text/plain",
            use_container_width=True,
        )
    except Exception as error:
        progress_bar.empty()
        status_box.empty()
        st.error(f"Não foi possível concluir a transcrição: {error}")
