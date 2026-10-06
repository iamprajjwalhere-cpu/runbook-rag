import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

EMBEDDING_MODEL = "gemini-embedding-2"
GENERATION_MODEL = "gemini-3.5-flash-lite"

load_dotenv(
    dotenv_path=Path(__file__).resolve().parent / ".env",
    override=True,
)
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    try:
        import streamlit as st
        api_key = st.secrets["GEMINI_API_KEY"]
    except Exception:
        api_key = None

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is missing. Set it in .env or Streamlit secrets."
    )

client = genai.Client(api_key=api_key)
def embed_texts(texts: list[str]) -> list[list[float]]:
    """Turn each text into a vector that can be searched by similarity."""
    if not texts:
        return []

    contents = [
        types.Content(parts=[types.Part.from_text(text=text)])
        for text in texts
    ]

    response = client.models.embed_content(
        model= EMBEDDING_MODEL,
        contents=contents,
    )

    return [embedding.values for embedding in response.embeddings]


def generate_text(prompt: str) -> str:
    """Ask Gemini to generate text from a prompt."""
    response = client.models.generate_content(
        model=GENERATION_MODEL,
        contents=prompt,
    )

    return (response.text or "").strip()