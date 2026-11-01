import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status})`);
  }

  return data;
}

function App() {
  const [page, setPage] = useState("overview");
  const [documents, setDocuments] = useState([]);
  const [passageCount, setPassageCount] = useState(0);
  const [sampleDocuments, setSampleDocuments] = useState([]);
  const [question, setQuestion] = useState("");
  const [answerResult, setAnswerResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef(null);

  async function refreshWorkspace() {
    const summary = await apiRequest("/api/v1/documents");
    setDocuments(summary.documents || []);
    setPassageCount(summary.passage_count || 0);
  }

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [summary, samples] = await Promise.all([
          apiRequest("/api/v1/documents"),
          apiRequest("/api/v1/sample-documents"),
        ]);
        setDocuments(summary.documents || []);
        setPassageCount(summary.passage_count || 0);
        setSampleDocuments(samples.documents || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadWorkspace();
  }, []);

  async function submitQuestion(event) {
    event.preventDefault();
    if (!question.trim()) return;

    setBusy(true);
    setError("");
    setAnswerResult(null);

    try {
      const result = await apiRequest("/api/v1/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), top_k: 5 }),
      });
      setAnswerResult(result);
      setPage("ask");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file) {
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest("/api/v1/documents/upload", {
        method: "POST",
        body: form,
      });
      await refreshWorkspace();
      setNotice(`Added ${result.filename} · ${result.chunks} passages`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function addSample(filename) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest(
        `/api/v1/sample-documents/${encodeURIComponent(filename)}`,
        { method: "POST" },
      );
      await refreshWorkspace();
      setNotice(`Added ${result.filename} · ${result.chunks} passages`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(documentHash) {
    setError("");
    setNotice("");

    try {
      await apiRequest(`/api/v1/documents/${documentHash}`, {
        method: "DELETE",
      });
      await refreshWorkspace();
      setNotice("Document removed from this workspace.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function askSuggestedQuestion(text) {
    setQuestion(text);
    setPage("ask");
    setAnswerResult(null);
  }

  const acceptedEvidence =
    answerResult?.evidence?.filter((item) => item.accepted) || [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPage("overview")}>
          <span className="brand-mark">S</span>
          <span>
            <strong>Studyspace</strong>
            <small>STUDENT NOTEBOOK</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {[
            ["overview", "Overview"],
            ["documents", "My notebook"],
            ["ask", "Study chat"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "nav-link active" : "nav-link"}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="connection-status">
          <span className="status-dot" />
          LOCAL WORKSPACE
        </div>
      </header>

      <main className="page-wrap">
        {error && <div className="alert error-alert">{error}</div>}
        {notice && <div className="alert success-alert">{notice}</div>}

        {page === "overview" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="eyebrow-dot" />
                  YOUR PERSONAL STUDY WORKSPACE
                </div>
                <h1>
                  Learn deeply
                  <br />
                  from <em>your sources.</em>
                </h1>
                <p>
                  Bring together your class notes, slides, and readings. Ask
                  questions, explore difficult ideas, and trace answers back to
                  the material you shared.
                </p>
                <div className="hero-tags">
                  <span>Course material, together</span>
                  <span>Source-grounded answers</span>
                  <span>Citations you can inspect</span>
                </div>
              </div>

              <div className="hero-art" aria-hidden="true">
                <div className="orb orb-one" />
                <div className="orb orb-two" />
                <div className="orb orb-three" />
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="art-caption">IDEAS IN MOTION</div>
              </div>
            </section>

            <section className="stats-row">
              <div className="stat-card">
                <span>DOCUMENTS</span>
                <strong>{String(documents.length).padStart(2, "0")}</strong>
                <small>In your workspace</small>
              </div>
              <div className="stat-card">
                <span>PASSAGES</span>
                <strong>{String(passageCount).padStart(2, "0")}</strong>
                <small>Ready for retrieval</small>
              </div>
              <div className="stat-card accent-stat">
                <span>ANSWER STYLE</span>
                <strong>Cited</strong>
                <small>Weak matches are declined</small>
              </div>
            </section>

            <section className="ask-panel">
              <div className="section-kicker">ASK YOUR MATERIAL <span>01</span></div>
              <form onSubmit={submitQuestion}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What should I know?"
                  aria-label="Ask a question about your documents"
                  maxLength={2000}
                />
                <div className="ask-panel-footer">
                  <p>Answers are grounded only in your indexed documents.</p>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Searching…" : "Find an answer"} <span>↗</span>
                  </button>
                </div>
              </form>
              <div className="suggestions">
                <span>TRY</span>
                {[
                  "Explain a difficult idea from my notes in simple terms.",
                  "What are the key points I should revise before an exam?",
                ].map((text) => (
                  <button key={text} onClick={() => askSuggestedQuestion(text)}>
                    {text} <span>→</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="lower-grid">
              <div>
                <div className="section-heading">
                  <div>
                    <div className="section-kicker">YOUR SOURCES <span>02</span></div>
                    <h2>My notebook</h2>
                  </div>
                  <button className="text-button" onClick={() => setPage("documents")}>
                    View library →
                  </button>
                </div>

                {documents.length ? (
                  <div className="document-list">
                    {documents.slice(0, 3).map((document) => (
                      <div className="document-row" key={document.document_hash}>
                        <span className="file-icon">MD</span>
                        <div>
                          <strong>{document.filename}</strong>
                          <small>{document.chunks} searchable passages</small>
                        </div>
                        <span className="ready-pill">READY</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-card">
                    Your notebook is empty. Add lecture notes, slides, or a
                    sample study source to get started.
                  </div>
                )}
              </div>

              <div className="quality-card study-loop-card">
                <div className="section-kicker">A SIMPLE STUDY LOOP <span>03</span></div>
                <h2>From source to understanding.</h2>
                <ol>
                  <li><span>01</span> Add your class material</li>
                  <li><span>02</span> Ask questions in context</li>
                  <li><span>03</span> Check the cited passages</li>
                </ol>
                <small>Answers stay grounded in the sources in this notebook.</small>
              </div>
            </section>
          </>
        )}

        {page === "documents" && (
          <section className="content-page">
            <div className="eyebrow"><span className="eyebrow-dot" />YOUR STUDY NOTEBOOK</div>
            <div className="page-title-row">
              <div>
                <h1>Bring your materials together.</h1>
                <p>Upload notes, readings, and slides to build a source-grounded study space.</p>
              </div>
              <button
                className="primary-button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                Add study material <span>＋</span>
              </button>
              <input
                ref={fileInput}
                className="hidden-input"
                type="file"
                accept=".md,.txt,.pdf,.pptx"
                onChange={(event) => uploadFile(event.target.files?.[0])}
              />
            </div>

            <div className="stats-row compact-stats">
              <div className="stat-card"><span>DOCUMENTS</span><strong>{documents.length}</strong><small>Indexed here</small></div>
              <div className="stat-card"><span>PASSAGES</span><strong>{passageCount}</strong><small>Searchable units</small></div>
              <div className="stat-card"><span>FORMATS</span><strong>04</strong><small>MD · TXT · PDF · PPTX</small></div>
            </div>

            <div className="library-panel">
              <div className="panel-heading">
                <h2>Your sources</h2>
                <span>{documents.length} total</span>
              </div>
              {documents.map((document) => (
                <div className="document-row library-row" key={document.document_hash}>
                  <span className="file-icon">DOC</span>
                  <div>
                    <strong>{document.filename}</strong>
                    <small>{document.chunks} passages · Added {document.uploaded_at?.slice(0, 10) || "recently"}</small>
                  </div>
                  <span className="ready-pill">INDEXED</span>
                  <button
                    className="remove-button"
                    onClick={() => removeDocument(document.document_hash)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!documents.length && (
                <div className="empty-card">No sources yet. Upload class material or add the sample study note below.</div>
              )}
            </div>

            <div className="library-panel samples-panel">
              <div className="panel-heading">
                <div>
                  <h2>Try a sample study note</h2>
                  <p>Explore the notebook with a short Computer Networks lesson.</p>
                </div>
              </div>
              <div className="sample-grid">
                {sampleDocuments.map((sample) => {
                  const alreadyAdded = documents.some((doc) => doc.filename === sample.filename);
                  return (
                    <button
                      className="sample-card"
                      key={sample.filename}
                      disabled={busy || alreadyAdded}
                      onClick={() => addSample(sample.filename)}
                    >
                      <span className="sample-mark">↗</span>
                      <strong>{sample.title}</strong>
                    <small>{alreadyAdded ? "Already in your notebook" : "Add to notebook"}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {page === "ask" && (
          <section className="content-page answer-page">
            <div className="eyebrow"><span className="eyebrow-dot" /> STUDY CHAT</div>
            <h1>Explore what you’re learning.</h1>
            <p className="page-intro">Ask about your sources and follow each answer back to its passage.</p>

            <section className="ask-panel">
              <form onSubmit={submitQuestion}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask a question about your notes, readings, or slides…"
                  aria-label="Ask a question about your documents"
                  maxLength={2000}
                />
                <div className="ask-panel-footer">
                  <p>Uses {documents.length} sources from your notebook · citations included</p>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Searching…" : "Find an answer"} <span>↗</span>
                  </button>
                </div>
              </form>
            </section>

            {answerResult && (
              <section className="answer-layout">
                <div className="answer-column">
                  <div className="section-kicker">GROUNDED ANSWER <span>01</span></div>
                  <article className="answer-card">
                    <p>{answerResult.answer}</p>
                  </article>
                </div>
                <div className="evidence-column">
                  <div className="section-kicker">
                    SOURCE EVIDENCE <span>{acceptedEvidence.length} ACCEPTED</span>
                  </div>
                  {answerResult.evidence?.map((item) => (
                    <article className={item.accepted ? "evidence-card" : "evidence-card rejected"} key={item.id}>
                      <div className="evidence-top">
                        <strong>{item.source || "Source"}</strong>
                        <span>{item.accepted ? "CITED" : "BELOW CUTOFF"}</span>
                      </div>
                      <small>
                        {item.section || "Passage"}
                        {item.page ? ` · Page ${item.page}` : ""}
                        {item.slide ? ` · Slide ${item.slide}` : ""}
                      </small>
                      <p>{item.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        <footer className="site-footer">
          <span>STUDYSPACE</span>
          <span>A LOCAL STUDY NOTEBOOK</span>
          <span>ANSWERS GROUNDED IN YOUR SOURCES</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
