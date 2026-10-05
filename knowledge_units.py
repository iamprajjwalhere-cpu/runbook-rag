import json
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
UNITS_FILE = PROJECT_DIR / "data" / "knowledge_units.jsonl"

REQUIRED_FIELDS = {
    "id",
    "topic",
    "unit_type",
    "text",
    "source",
    "source_url",
    "section",
    "scope",
}


def load_knowledge_units(
    path: Path = UNITS_FILE,
) -> list[dict[str, str]]:
    """Load JSONL records and check their required fields and IDs."""
    units = []
    seen_ids = set()

    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                continue

            try:
                unit = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Invalid JSON on line {line_number}: {error.msg}"
                ) from error

            if not isinstance(unit, dict):
                raise ValueError(
                    f"Line {line_number} must contain a JSON object."
                )

            missing_fields = REQUIRED_FIELDS.difference(unit)
            if missing_fields:
                fields = ", ".join(sorted(missing_fields))
                raise ValueError(
                    f"Line {line_number} is missing these fields: {fields}"
                )

            unit_id = unit["id"]
            if not isinstance(unit_id, str) or not unit_id.strip():
                raise ValueError(
                    f"Line {line_number} needs a non-empty string ID."
                )

            if unit_id in seen_ids:
                raise ValueError(f"Duplicate unit ID on line {line_number}: {unit_id}")

            if not isinstance(unit["text"], str) or not unit["text"].strip():
                raise ValueError(
                    f"Line {line_number} needs non-empty text."
                )

            seen_ids.add(unit_id)
            units.append(unit)

    if not units:
        raise ValueError(f"No knowledge units found in {path}.")

    return units