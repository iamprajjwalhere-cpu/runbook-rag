"""Upload-first student study workspace (Streamlit fallback interface)."""

from html import escape
import streamlit as st

from api_client import (
    MAX_DISTANCE,
    MAX_UPLOAD_BYTES,
    SUPPORTED_EXTENSIONS,
    add_sample_document,
    answer_question,
    delete_document,
    get_sample_documents,
    get_workspace_summary,
    upload_document,
)

st.set_page_config(
    page_title="Studyspace | Student notebook",
    page_icon="S",
    layout="wide",
    initial_sidebar_state="expanded",
)


st.markdown(
    """
    <style>
    :root { --navy:#172b4d; --blue:#1769aa; --blue-dark:#0f5da8; --ink:#1f2937; --muted:#667085; --line:#e4e7ec; --canvas:#f5f7fa; --paper:#fff; --green:#067647; }
    html, body, [class*="css"] { font-family:'Segoe UI Variable','Segoe UI',Arial,sans-serif; color:var(--ink); }
    .stApp { --text-color:#1f2937; --background-color:#f5f7fa; --secondary-background-color:#fff; --primary-color:#1769aa; color-scheme:light; background:var(--canvas); color:var(--ink); }
    [data-testid="stHeader"] { background:transparent; }
    [data-testid="stMainBlockContainer"] { max-width:1420px; padding:1.25rem 2.25rem 3rem; }
    [data-testid="stSidebar"] { background:#fff; border-right:1px solid var(--line); }
    [data-testid="stSidebar"] > div:first-child { padding-top:1.15rem; }
    .brand { display:flex; align-items:center; gap:.7rem; padding:.25rem .3rem 1.25rem; border-bottom:1px solid var(--line); }
    .brand-mark { display:grid; place-items:center; width:2.15rem; height:2.15rem; border-radius:7px; color:#fff; background:var(--blue); font-size:1rem; font-weight:700; }
    .brand-name { color:var(--navy); font-size:.96rem; font-weight:700; letter-spacing:-.02em; }
    .brand-caption { color:var(--muted); font-size:.7rem; margin-top:.1rem; }
    .side-label,.eyebrow,.metric-label,.meta-label { color:#667085; font-family:Consolas,'Cascadia Code',monospace; font-size:.65rem; letter-spacing:.075em; text-transform:uppercase; }
    .workspace-bar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:.1rem 0 1.45rem; padding:0 0 .9rem; border-bottom:1px solid var(--line); }
    .workspace-path { color:#475467; font-size:.82rem; }
    .workspace-path strong { color:var(--navy); font-weight:600; }
    .prototype-pill { padding:.33rem .62rem; border:1px solid #d0d5dd; border-radius:999px; color:#475467; background:#fff; font-size:.7rem; white-space:nowrap; }
    .page-title { margin:.2rem 0 .3rem; color:var(--navy) !important; font-size:2rem; font-weight:600; letter-spacing:-.045em; line-height:1.2; }
    [data-testid="stMarkdownContainer"] h1,[data-testid="stMarkdownContainer"] h2,[data-testid="stMarkdownContainer"] h3 { color:var(--navy) !important; }
    .page-subtitle { max-width:760px; margin:0 0 1.25rem; color:#667085; font-size:.93rem; line-height:1.6; }
    .stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.75rem; margin:1.1rem 0 1.5rem; }
    .stat-card { min-height:83px; padding:.85rem 1rem; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .stat-value { margin:.32rem 0 .08rem; color:var(--navy); font-size:1.4rem; font-weight:600; letter-spacing:-.04em; }
    .stat-detail { color:var(--muted); font-size:.73rem; }
    .section-heading { margin:1.5rem 0 .4rem; color:var(--navy); font-size:1rem; font-weight:600; }
    .section-caption { margin:0 0 .85rem; color:var(--muted); font-size:.81rem; line-height:1.5; }
    .surface { padding:1.15rem 1.2rem; border:1px solid var(--line); border-radius:9px; background:#fff; box-shadow:0 1px 2px #1018280a; }
    .surface-title { margin:0 0 .22rem; color:var(--navy); font-size:.98rem; font-weight:600; }
    .surface-copy { margin:0; color:var(--muted); font-size:.8rem; line-height:1.5; }
    .empty-state { padding:2.5rem 1.5rem; border:1px dashed #b8c4d2; border-radius:10px; text-align:center; background:#fff; }
    .empty-icon { display:grid; place-items:center; width:2.8rem; height:2.8rem; margin:0 auto .85rem; border-radius:9px; color:var(--blue); background:#eff8ff; font-size:1.25rem; font-weight:600; }
    .empty-title { margin:0 0 .35rem; color:var(--navy) !important; font-size:1.1rem; font-weight:600; }
    .empty-copy { max-width:530px; margin:0 auto; color:var(--muted); font-size:.84rem; line-height:1.55; }
    .file-card { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:.5rem 0; padding:.85rem 1rem; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .file-name { color:var(--navy); font-size:.86rem; font-weight:600; }
    .file-detail { margin-top:.2rem; color:var(--muted); font-size:.73rem; }
    div[data-testid="stTextArea"] textarea { min-height:108px; border:1px solid #cfd4dc; border-radius:7px; color:var(--ink); background:white; font-family:'Segoe UI Variable','Segoe UI',Arial,sans-serif; font-size:.94rem; line-height:1.55; }
    div[data-testid="stTextArea"] textarea:focus { border-color:#84caff; box-shadow:0 0 0 3px #2e90fa26; }
    .stButton > button,.stFormSubmitButton > button { min-height:2.5rem; border:1px solid #d0d5dd; border-radius:7px; color:#344054; background:#fff; font-size:.82rem; font-weight:600; }
    .stButton > button:hover { border-color:#84caff; color:var(--blue-dark); background:#f5faff; }
    .stFormSubmitButton > button[kind="primary"] { border-color:var(--blue); color:#fff; background:var(--blue); }
    .stFormSubmitButton > button[kind="primary"]:hover { border-color:var(--blue-dark); background:var(--blue-dark); }
    .answer-card { padding:1rem 1.1rem; border:1px solid #b2ddff; border-left:3px solid var(--blue); border-radius:8px; background:#f8fbff; }
    .evidence-card { margin:.55rem 0; padding:.85rem .95rem; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .evidence-head { display:flex; justify-content:space-between; gap:.5rem; margin-bottom:.4rem; }
    .evidence-id { color:var(--blue-dark); font-family:Consolas,monospace; font-size:.75rem; font-weight:600; }
    .evidence-distance { color:#667085; font-family:Consolas,monospace; font-size:.67rem; }
    .evidence-status { display:inline-block; margin-left:.45rem; padding:.16rem .38rem; border:1px solid #fedf89; border-radius:999px; color:#93370d; background:#fffaeb; font-family:'Segoe UI',Arial,sans-serif; font-size:.62rem; font-weight:600; letter-spacing:0; }
    .evidence-meta { margin-bottom:.4rem; color:#667085; font-size:.7rem; text-transform:capitalize; }
    .evidence-text { color:#344054; font-size:.83rem; line-height:1.6; }
    .note { padding:.75rem .9rem; border:1px solid #fedf89; border-radius:8px; color:#93370d; background:#fffaeb; font-size:.79rem; line-height:1.5; }
    .footer { margin-top:2.3rem; padding-top:.9rem; border-top:1px solid var(--line); color:#667085; font-size:.7rem; }
    [data-testid="stSidebar"] [data-testid="stRadio"] label,[data-testid="stSidebar"] [data-testid="stRadio"] label * { color:#344054 !important; }
    [data-testid="stSidebar"] [data-testid="stCaptionContainer"], [data-testid="stSidebar"] [data-testid="stCaptionContainer"] * { color:#667085 !important; }
    [data-testid="stFileUploader"] label,[data-testid="stFileUploader"] label * { color:#344054 !important; }
    [data-testid="stFileUploaderDropzone"] { border:1px dashed #aab7c4 !important; border-radius:8px !important; background:#fff !important; }
    [data-testid="stFileUploaderDropzone"] * { color:#344054 !important; }
    [data-testid="stFileUploaderDropzone"] button { border:1px solid #d0d5dd !important; color:#344054 !important; background:#fff !important; }
    [data-testid="stCaptionContainer"], [data-testid="stCaptionContainer"] * { color:#667085 !important; }
    [data-testid="stExpander"] { border:1px solid var(--line); border-radius:8px; background:#fff; }
    @media(max-width:850px) { .stat-grid { grid-template-columns:1fr 1fr; } [data-testid="stMainBlockContainer"] { padding:1rem 1rem 2rem; } }
    @media(max-width:560px) { .page-title { font-size:1.65rem; } .workspace-bar { align-items:flex-start; } .stat-grid { gap:.5rem; } }
    </style>
    """,
    unsafe_allow_html=True,
)


with st.sidebar:
    st.markdown(
        '<div class="brand"><div class="brand-mark">S</div><div><div class="brand-name">Studyspace</div><div class="brand-caption">Student study notebook</div></div></div>',
        unsafe_allow_html=True,
    )
    st.markdown('<div class="side-label">WORKSPACE</div>', unsafe_allow_html=True)
    page = st.radio(
        "Navigation",
        ["Overview", "Documents", "Study chat"],
        key="main_navigation",
        label_visibility="collapsed",
    )
    st.divider()
    st.markdown('<div class="side-label">THIS PROTOTYPE</div>', unsafe_allow_html=True)
    st.caption("One local study notebook")
    st.caption("MD · TXT · PDF · PPTX ingestion")
    st.caption("Gemini embeddings · ChromaDB")
    st.markdown("---")
    st.caption("Local prototype only. Sign-in and separate student accounts are not implemented.")


try:
    workspace = get_workspace_summary()
except RuntimeError as error:
    st.error(str(error))
    st.info("The API and Streamlit run in separate terminals. Start the API, wait for its startup message, then refresh this page.")
    st.stop()
documents = workspace["documents"]
unit_count = workspace["passage_count"]

st.markdown(
    '<div class="workspace-bar"><div class="workspace-path">Studyspace&nbsp; / &nbsp;<strong>My study notebook</strong></div><div class="prototype-pill">LOCAL PROTOTYPE</div></div>',
    unsafe_allow_html=True,
)


def render_stats() -> None:
    st.markdown(
        f'''<div class="stat-grid">
        <div class="stat-card"><div class="metric-label">DOCUMENTS</div><div class="stat-value">{len(documents):02d}</div><div class="stat-detail">Added to this workspace</div></div>
        <div class="stat-card"><div class="metric-label">SEARCHABLE PASSAGES</div><div class="stat-value">{unit_count:02d}</div><div class="stat-detail">Section-aware indexed units</div></div>
        <div class="stat-card"><div class="metric-label">SUPPORTED FORMATS</div><div class="stat-value">04</div><div class="stat-detail">MD · TXT · PDF · PPTX</div></div>
        </div>''',
        unsafe_allow_html=True,
    )


def render_upload() -> None:
    st.markdown('<div class="section-heading">Add course material</div>', unsafe_allow_html=True)
    st.markdown('<p class="section-caption">Upload lecture notes, readings, and slides. Page and slide references are retained with searchable passages.</p>', unsafe_allow_html=True)
    uploads = st.file_uploader(
        "Choose study materials to add",
        type=[extension.lstrip(".") for extension in sorted(SUPPORTED_EXTENSIONS)],
        accept_multiple_files=True,
        help=f"Up to {MAX_UPLOAD_BYTES // (1024 * 1024)} MB per file. Scanned PDF pages need OCR, which is not included yet.",
    )
    if st.button("Add to notebook", type="primary", disabled=not uploads):
        for upload in uploads or []:
            try:
                result = upload_document(upload.name, upload.getvalue())
                st.success(f"Indexed {result['filename']} · {result['chunks']} passages")
                for warning in result["warnings"]:
                    st.warning(f"{upload.name}: {warning}")
            except Exception as error:
                st.error(f"Could not index {upload.name}: {error}")
        st.rerun()


def render_sample_documents() -> None:
    st.markdown('<div class="section-heading">Try a sample study note</div>', unsafe_allow_html=True)
    st.markdown('<p class="section-caption">Add a short Computer Networks lesson to explore source-grounded study chat.</p>', unsafe_allow_html=True)
    try:
        samples = get_sample_documents()
    except RuntimeError as error:
        st.error(f"Could not load the sample study note: {error}")
        return
    existing = {document["filename"] for document in documents}
    if not samples:
        st.info("No sample study notes are available in data/study_samples.")
        return
    for sample in samples:
        filename = sample["filename"]
        label = "Already added" if filename in existing else f"Add {sample['title']}"
        if st.button(label, key=f"sample_{filename}", disabled=filename in existing):
            try:
                result = add_sample_document(filename)
                st.success(f"Added {result['filename']} · {result['chunks']} passages")
                st.rerun()
            except Exception as error:
                st.error(f"Could not add {filename}: {error}")


if page == "Overview":
    st.markdown('<div class="eyebrow">STUDENT STUDY · NOTEBOOK</div>', unsafe_allow_html=True)
    st.markdown('<h1 class="page-title">Learn from your own material</h1>', unsafe_allow_html=True)
    st.markdown('<p class="page-subtitle">Bring class notes, readings, and slides together. Ask questions and follow answers back to their sources.</p>', unsafe_allow_html=True)
    render_stats()
    if not documents:
        st.markdown(
            '<div class="empty-state"><div class="empty-icon">+</div><h2 class="empty-title">Start with your course material</h2><p class="empty-copy">Add lecture notes, a reading, or a slide deck to create your searchable study notebook.</p></div>',
            unsafe_allow_html=True,
        )
        render_upload()
        render_sample_documents()
    else:
        st.markdown('<div class="section-heading">Recently added</div>', unsafe_allow_html=True)
        for document in documents[:5]:
            st.markdown(
                f'<div class="file-card"><div><div class="file-name">{escape(document["filename"])}</div><div class="file-detail">{document["chunks"]} indexed passages</div></div><div class="prototype-pill">READY</div></div>',
                unsafe_allow_html=True,
            )
        st.markdown('<div class="section-heading">Next step</div>', unsafe_allow_html=True)
        st.markdown('<div class="surface"><div class="surface-title">Study with your sources</div><p class="surface-copy">Open Study chat to ask questions and inspect the passages supporting each answer.</p></div>', unsafe_allow_html=True)

elif page == "Documents":
    st.markdown('<div class="eyebrow">YOUR STUDY NOTEBOOK</div>', unsafe_allow_html=True)
    st.markdown('<h1 class="page-title">Your study sources</h1>', unsafe_allow_html=True)
    st.markdown('<p class="page-subtitle">Manage the class materials that ground answers in your notebook.</p>', unsafe_allow_html=True)
    render_stats()
    render_upload()
    render_sample_documents()
    st.markdown('<div class="section-heading">Indexed documents</div>', unsafe_allow_html=True)
    if not documents:
        st.info("No documents yet. Add a supported file above to begin.")
    for index, document in enumerate(documents):
        left, right = st.columns([5, 1])
        with left:
            uploaded = document.get("uploaded_at", "")
            st.markdown(
                f'<div class="file-card"><div><div class="file-name">{escape(document["filename"])}</div><div class="file-detail">{document["chunks"]} passages &nbsp;·&nbsp; Added {escape(uploaded[:10] or "date unavailable")}</div></div><div class="prototype-pill">INDEXED</div></div>',
                unsafe_allow_html=True,
            )
        with right:
            if st.button("Remove", key=f"remove_{index}"):
                delete_document(document["document_hash"])
                st.rerun()

elif page == "Study chat":
    st.markdown('<div class="eyebrow">SOURCE-GROUNDED STUDY CHAT</div>', unsafe_allow_html=True)
    st.markdown('<h1 class="page-title">Explore what you’re learning</h1>', unsafe_allow_html=True)
    st.markdown('<p class="page-subtitle">Ask about your course materials. Answers use retrieved passages and include citations you can inspect.</p>', unsafe_allow_html=True)
    render_stats()
    if not documents:
        st.markdown(
            '<div class="empty-state"><div class="empty-icon">0</div><h2 class="empty-title">Your notebook is empty</h2><p class="empty-copy">Add a Markdown, text, PDF, or PowerPoint file first. Study chat searches only sources indexed in this notebook.</p></div>',
            unsafe_allow_html=True,
        )
        st.button("Go to documents", on_click=lambda: st.session_state.update({"main_navigation": "Documents"}))
    else:
        with st.form("ask_form", border=True):
            question = st.text_area(
                "Question",
                placeholder="Ask a question about your notes, readings, or slides…",
                height=115,
                label_visibility="collapsed",
            )
                st.caption(f"Searches {len(documents)} sources · relevance threshold {MAX_DISTANCE:.2f}")
            submitted = st.form_submit_button("Search and answer  →", type="primary")
        if submitted:
            if not question.strip():
                st.warning("Enter a question to search the workspace.")
            else:
                with st.spinner("Finding relevant passages…"):
                    try:
                        answer, hits = answer_question(question.strip())
                    except Exception as error:
                        st.error(f"The search could not be completed: {error}")
                        st.stop()
                accepted_hits = [hit for hit in hits if hit.get("accepted", True)]
                rejected_hits = [hit for hit in hits if not hit.get("accepted", True)]
                st.session_state["current_answer"] = {
                    "question": question.strip(),
                    "answer": answer,
                    "hits": hits,
                }
                st.session_state.setdefault("qa_history", []).append(
                    {"question": question.strip(), "answer": answer, "hits": hits}
                )
        if st.session_state.get("qa_history"):
            st.markdown('<div class="section-heading">Recent questions</div>', unsafe_allow_html=True)
            for item in reversed(st.session_state["qa_history"][-10:]):
                with st.expander(item["question"]):
                    st.markdown(item["answer"])
                    for source_hit in item["hits"]:
                        source = source_hit["metadata"].get("source", "unknown source")
                        section = source_hit["metadata"].get("section", "")
                        st.caption(f"Evidence [{source_hit['id']}] · {source} · {section}")
        current_answer = st.session_state.get("current_answer")
        if current_answer:
                answer = current_answer["answer"]
                hits = current_answer["hits"]
                accepted_hits = [hit for hit in hits if hit.get("accepted", True)]
                rejected_hits = [hit for hit in hits if not hit.get("accepted", True)]
                st.markdown(f"**Question:** {escape(current_answer['question'])}")
                st.markdown('<div class="section-heading">Answer and evidence</div>', unsafe_allow_html=True)
                answer_column, evidence_column = st.columns([1.05, .95], gap="large")
                with answer_column:
                    st.markdown('<div class="meta-label">GROUNDED ANSWER</div>', unsafe_allow_html=True)
                    with st.container(border=True):
                        st.markdown(answer)
                    if accepted_hits:
                        st.caption(f"{len(accepted_hits)} evidence passages passed the relevance cutoff.")
                    elif rejected_hits:
                        st.caption("The closest passages are shown for diagnosis; none were sent to Gemini as answer evidence.")
                    else:
                        st.caption("No passages are indexed for this workspace.")
                with evidence_column:
                    evidence_heading = "SOURCE PASSAGES" if accepted_hits else "CLOSEST MATCHES · NOT USED AS EVIDENCE"
                    st.markdown(f'<div class="meta-label">{evidence_heading}</div>', unsafe_allow_html=True)
                    if not hits:
                        st.info("No passages are indexed for this workspace.")
                    elif rejected_hits:
                        nearest = min(rejected_hits, key=lambda hit: hit["distance"])
                        nearest_page = nearest["metadata"].get("page_number")
                        nearest_slide = nearest["metadata"].get("slide_number")
                        location_text = (
                            f" on page {nearest_page}" if nearest_page
                            else f" on slide {nearest_slide}" if nearest_slide
                            else ""
                        )
                        st.warning(
                            f"No passage passed the {MAX_DISTANCE:.2f} relevance cutoff. "
                            f"The closest match was {nearest['metadata'].get('source', 'a document')}{location_text} "
                            f"at distance {nearest['distance']:.3f}. Try a complete question, such as “What projects are listed in my CV?”"
                        )
                    for hit in hits:
                        metadata = hit["metadata"]
                        locations = []
                        if metadata.get("page_number") is not None:
                            locations.append(f"Page {metadata['page_number']}")
                        if metadata.get("slide_number") is not None:
                            locations.append(f"Slide {metadata['slide_number']}")
                        location_label = " &nbsp;·&nbsp; ".join(locations)
                        status = "" if hit.get("accepted", True) else '<span class="evidence-status">BELOW CUTOFF</span>'
                        st.markdown(
                            f'<div class="evidence-card"><div class="evidence-head"><span><span class="evidence-id">{escape(hit["id"])}</span>{status}</span><span class="evidence-distance">distance {hit["distance"]:.3f}</span></div><div class="evidence-meta">{escape(metadata.get("source", ""))} &nbsp;·&nbsp; {escape(metadata.get("section", ""))} {location_label}</div><div class="evidence-text">{escape(hit["text"])}</div></div>',
                            unsafe_allow_html=True,
                        )
                        citation_parts = [hit["id"], metadata.get("source", "unknown source"), metadata.get("section", "section unavailable")]
                        if metadata.get("page_number") is not None:
                            citation_parts.append(f"Page {metadata['page_number']}")
                        if metadata.get("slide_number") is not None:
                            citation_parts.append(f"Slide {metadata['slide_number']}")
                        st.caption("Citation: [" + "] · ".join(citation_parts) + "]")

st.markdown('<div class="footer">STUDYSPACE&nbsp; · &nbsp;SOURCE-GROUNDED STUDY NOTEBOOK&nbsp; · &nbsp;LOCAL SINGLE-WORKSPACE PROTOTYPE</div>', unsafe_allow_html=True)
