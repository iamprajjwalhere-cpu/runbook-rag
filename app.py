import streamlit as st

from index_data import main as build_index
from retrieve import (
    CHUNK_COLLECTION,
    UNIT_COLLECTION,
    MAX_DISTANCE,
    answer_with_knowledge_units,
    chroma_client,
)


st.set_page_config(
    page_title="Runbook RAG | Ops Reference",
    page_icon="⌁",
    layout="wide",
)

@st.cache_resource
def ensure_runbook_index():
    """Build the Chroma index on a fresh deployment, once per app process."""
    required = {CHUNK_COLLECTION, UNIT_COLLECTION}
    existing = {
        collection.name
        for collection in chroma_client.list_collections()
    }

    if not required.issubset(existing):
        build_index()


with st.spinner("Checking the runbook index..."):
    ensure_runbook_index()

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
    --paper: #f4f1e8;
    --surface: #fffefa;
    --ink: #1b302a;
    --pine: #1d5147;
    --muted: #65746d;
    --line: #d9ded4;
    --coral: #ed5a3b;
    --lime: #d9ef70;
    --blue: #6369d8;
    --gold: #edb44f;
}

.stApp {
    color: var(--ink);
    background:
        radial-gradient(ellipse at 92% 4%, #d9ef7066 0%, transparent 23%),
        radial-gradient(ellipse at 3% 18%, #ed5a3b1c 0%, transparent 25%),
        var(--paper);
}

[data-testid="stHeader"] {
    background: transparent;
}

[data-testid="stMainBlockContainer"] {
    max-width: 1120px;
    padding-top: 2.2rem;
    padding-bottom: 4rem;
}

html, body, [class*="css"] {
    font-family: "DM Sans", "Segoe UI", sans-serif;
    color: var(--ink);
}

.hero {
    padding: 2rem 0 1.25rem;
}

.eyebrow,
.section-kicker,
.spec-label,
.hero-tag,
.footer-note {
    font-family: "IBM Plex Mono", "Cascadia Code", monospace;
    text-transform: uppercase;
    letter-spacing: 0.11em;
}

.eyebrow {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: var(--pine);
    font-size: 0.72rem;
    font-weight: 600;
}

.signal-dot {
    width: 9px;
    height: 9px;
    display: inline-block;
    border-radius: 50%;
    background: var(--coral);
    box-shadow: 0 0 0 4px #ed5a3b22;
}

.hero h1 {
    margin: 1.2rem 0 0.85rem;
    color: var(--ink);
    font-family: "Space Grotesk", "Segoe UI", sans-serif;
    font-size: clamp(2.8rem, 6vw, 5.2rem);
    font-weight: 600;
    letter-spacing: -0.075em;
    line-height: 0.98;
}

.hero h1 span {
    color: var(--coral);
    font-style: italic;
    font-weight: 500;
}

.hero-copy {
    max-width: 650px;
    color: var(--muted);
    font-size: 1.08rem;
    line-height: 1.75;
}

.hero-tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.25rem;
}

.hero-tag {
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 5px;
    color: var(--pine);
    background: var(--surface);
    font-size: 0.66rem;
}

.hero-tag:nth-child(2) {
    color: #454bb4;
    background: #e9e9ff;
    border-color: #d7d8ff;
}

.hero-tag:nth-child(3) {
    color: #8c3a27;
    background: #ffe2d8;
    border-color: #f6c4b5;
}

.spec-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.8rem;
    margin: 1.3rem 0 2.6rem;
}

.spec-card {
    position: relative;
    overflow: hidden;
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: 0 8px 22px #1b302a0a;
}

.spec-card::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: var(--pine);
    content: "";
}

.spec-card:nth-child(2)::before {
    background: var(--coral);
}

.spec-card:nth-child(3)::before {
    background: var(--blue);
}

.spec-label {
    color: var(--muted);
    font-size: 0.68rem;
}

.spec-card strong {
    display: block;
    margin-top: 0.45rem;
    color: var(--ink);
    font-family: "Space Grotesk", "Segoe UI", sans-serif;
    font-size: 1.9rem;
    font-weight: 600;
    letter-spacing: -0.05em;
}

.spec-card small {
    color: var(--muted);
    font-size: 0.82rem;
}

.section-kicker {
    margin: 1rem 0 0.8rem;
    color: var(--coral);
    font-size: 0.72rem;
}

.section-kicker span {
    margin-left: 0.55rem;
    color: var(--pine);
    font-family: inherit;
    letter-spacing: 0.08em;
}

div[data-testid="stForm"] {
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: 0 12px 32px #1b302a0c;
}

div[data-testid="stTextArea"] textarea {
    border: 1px solid #cbd4c9;
    border-radius: 7px;
    color: var(--ink);
    background: #fffefa;
    font-family: "DM Sans", "Segoe UI", sans-serif;
    font-size: 1rem;
    line-height: 1.55;
}

div[data-testid="stTextArea"] textarea:focus {
    border-color: var(--pine);
    box-shadow: 0 0 0 1px var(--pine);
}

.stButton > button {
    min-height: 2.8rem;
    border: 1px solid var(--pine);
    border-radius: 7px;
    color: #fffefa;
    background: var(--pine);
    font-family: "DM Sans", "Segoe UI", sans-serif;
    font-weight: 700;
    transition: all 160ms ease;
}

.stButton > button:hover {
    border-color: var(--coral);
    color: #fffefa;
    background: var(--coral);
    transform: translateY(-1px);
}

[data-testid="stMetric"] {
    padding: 0.9rem 1rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
}

[data-testid="stMetricLabel"] {
    color: var(--muted);
}

[data-testid="stMetricValue"] {
    color: var(--pine);
    font-family: "Space Grotesk", "Segoe UI", sans-serif;
}

[data-testid="stExpander"] {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
}

[data-testid="stAlert"] {
    border-radius: 8px;
}

.footer-note {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.68rem;
}

@media (max-width: 700px) {
    .spec-grid {
        grid-template-columns: 1fr;
    }

    .hero {
        padding-top: 1rem;
    }
    
    div[data-testid="stTextArea"] textarea::placeholder {
    color: #65746d !important;
    opacity: 1 !important;
}
}
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <section class="hero">
        <div class="eyebrow">
            <span class="signal-dot"></span>
            RUNBOOK INTELLIGENCE
            <span>/</span>
            OPS REFERENCE SYSTEM
        </div>
        <h1>Operational clarity.<br><span>Evidence attached.</span></h1>
        <p class="hero-copy">
            Ask about monitoring, overload response, incident coordination,
            SLOs and error budgets, or safer release rollouts.
            Every answer is grounded in the indexed runbooks, with its
            supporting knowledge units available for inspection.
        </p>
        <div class="hero-tag-row">
            <span class="hero-tag">GEMINI EMBEDDINGS</span>
            <span class="hero-tag">CHROMA VECTOR SEARCH</span>
            <span class="hero-tag">CITATION-AWARE</span>
        </div>
    </section>

    <div class="spec-grid">
        <div class="spec-card">
            <span class="spec-label">SOURCE LIBRARY</span>
            <strong>05</strong>
            <small>operational runbooks</small>
        </div>
        <div class="spec-card">
            <span class="spec-label">EVIDENCE LAYER</span>
            <strong>28</strong>
            <small>typed knowledge units</small>
        </div>
        <div class="spec-card">
            <span class="spec-label">RETRIEVAL EVALUATION</span>
            <strong>24/24</strong>
            <small>Hit@3 · MRR 0.958 for both methods</small>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    '<div class="section-kicker">01 <span>ASK THE RUNBOOKS</span></div>',
    unsafe_allow_html=True,
)

with st.form("question_form"):
    question = st.text_area(
        "Runbook question",
        placeholder="What should I compare between a canary and control before expanding a rollout?",
        height=96,
        label_visibility="collapsed",
    )

    left, right = st.columns([3, 1])
    with left:
        st.caption(
            "Try: “Who coordinates technical mitigation during an incident?”"
        )
    with right:
        submitted = st.form_submit_button(
            "Find evidence  →",
            type="primary",
            use_container_width=True,
        )

if submitted:
    if not question.strip():
        st.warning("Enter a question to search the runbooks.")
    else:
        with st.spinner("Searching the evidence base..."):
            try:
                answer, hits = answer_with_knowledge_units(question.strip())
            except Exception as error:
                st.error(f"Could not complete the search: {error}")
                st.stop()

        st.markdown(
            '<div class="section-kicker">02 <span>GROUNDED RESPONSE</span></div>',
            unsafe_allow_html=True,
        )

        with st.container(border=True):
            st.markdown(answer)

            if hits:
                st.caption(
                    f"GROUNDING TRACE · {len(hits)} knowledge units · "
                    f"distance cutoff {MAX_DISTANCE:.2f}"
                )
            else:
                st.caption("GROUNDING TRACE · no evidence passed the relevance gate")

        if hits:
            with st.expander("Inspect retrieved evidence", expanded=True):
                for hit in hits:
                    metadata = hit["metadata"] or {}
                    topic = metadata.get("topic", "unknown")
                    unit_type = metadata.get("unit_type", "unknown")
                    source = metadata.get("source", "unknown")
                    source_url = metadata.get("source_url")

                    st.markdown(f"### `{hit['id']}`")
                    st.caption(
                        f"{topic.upper()}  /  {unit_type}  /  "
                        f"{source}  /  distance {hit['distance']:.4f}"
                    )
                    st.write(hit["text"])

                    if source_url:
                        st.markdown(f"[Open source document ↗]({source_url})")

                    st.divider()

st.markdown(
    """
    <div class="footer-note">
        LOCAL RUNBOOK CORPUS · TOPIC-ROUTED RETRIEVAL ·
        LOW-RELEVANCE QUESTIONS ARE DECLINED
    </div>
    """,
    unsafe_allow_html=True,
)
