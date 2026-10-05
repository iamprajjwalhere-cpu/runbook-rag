from pathlib import Path
import re


DATA_DIR = Path(__file__).resolve().parent / "data" / "runbooks"


def split_into_sections(markdown: str) -> list[tuple[str, str]]:
    """Split Markdown into sections using its heading lines."""
    sections = []
    current_title = "Introduction"
    current_lines = []

    for line in markdown.splitlines():
        heading = re.match(r"^#{1,3}\s+(.+?)\s*$", line)

        if heading:
            body = "\n".join(current_lines).strip()
            if body:
                sections.append((current_title, body))

            current_title = heading.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    body = "\n".join(current_lines).strip()
    if body:
        sections.append((current_title, body))

    return sections


def split_into_chunks(
    text: str,
    max_words: int = 300,
    overlap_words: int = 50,
) -> list[str]:
    """Split text into word-based chunks with a small overlap."""
    if max_words <= 0:
        raise ValueError("max_words must be greater than zero.")

    if overlap_words < 0 or overlap_words >= max_words:
        raise ValueError("overlap_words must be at least zero and less than max_words.")

    words = text.split()
    chunks = []
    start = 0
    step = max_words - overlap_words

    while start < len(words):
        end = start + max_words
        chunks.append(" ".join(words[start:end]))

        if end >= len(words):
            break

        start += step

    return chunks


def load_all_chunks() -> list[dict[str, str]]:
    """Read every Markdown runbook and return chunks with source metadata."""
    files = sorted(DATA_DIR.glob("*.md"))

    if not files:
        raise FileNotFoundError(
            f"No Markdown runbooks found in {DATA_DIR}. "
            "Add at least one .md file to that folder."
        )

    all_chunks = []

    for path in files:
        markdown = path.read_text(encoding="utf-8")
        sections = split_into_sections(markdown)

        for section_number, (section_title, section_text) in enumerate(
            sections,
            start=1,
        ):
            text_chunks = split_into_chunks(section_text)

            for chunk_number, chunk_text in enumerate(text_chunks, start=1):
                all_chunks.append(
                    {
                        "id": (
                            f"{path.stem}-s{section_number}-c{chunk_number}"
                        ),
                        "text": f"{section_title}\n{chunk_text}",
                        "source": path.name,
                        "section": section_title,
                    }
                )

    return all_chunks