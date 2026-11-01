import { useEffect, useRef, useState } from "react";
import "./App.css";
import { scheduleReview } from "./reviewSchedule.js";

const API = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");
const PROGRESS_STORAGE_KEY = "studyspace-progress-v1";
const SAVED_NOTES_KEY = "studyspace-saved-notes-v1";
const THEME_KEY = "studyspace-theme-v1";
const REVIEW_CARDS_KEY = "studyspace-review-cards-v1";

const NAV_ITEMS = [
  { id: "hero", label: "Home" },
  { id: "sources", label: "Sources" },
  { id: "chat", label: "Study chat" },
  { id: "atlas", label: "Atlas" },
  { id: "practice", label: "Practice" },
  { id: "guide", label: "Study guide" },
  { id: "progress", label: "Progress" },
];

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.date === "string" && typeof item.type === "string").slice(0, 250) : [];
  } catch {
    return [];
  }
}

function loadSavedNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_NOTES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((note) => note && typeof note.id === "string" && typeof note.answer === "string") : [];
  } catch {
    return [];
  }
}

function loadReviewCards() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEW_CARDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((card) => card && typeof card.review_id === "string" && typeof card.due_at === "number").slice(0, 500) : [];
  } catch {
    return [];
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

function calculateProgress(entries) {
  const activeDays = new Set(entries.map((entry) => entry.date));
  const today = new Date();
  const currentDay = localDayKey(today);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!activeDays.has(currentDay)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const week = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    day.setDate(day.getDate() - offset);
    const key = localDayKey(day);
    week.push({
      key,
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      count: entries.filter((entry) => entry.date === key).length,
    });
  }
  return { streak, week };
}

function readableDay(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function downloadTextFile(text, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const ACTIVITY_LABELS = {
  question: "Asked a source-grounded question",
  study_set_created: "Created a practice set",
  flashcards_completed: "Completed a flashcard session",
  quiz_completed: "Completed a quiz",
  guide_created: "Built a revision guide",
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || `Request failed (${response.status})`);
  }

  return data;
}

function uploadFileWithProgress(file, onProgress, onProcessing) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API}/api/v1/documents/upload`);
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
      if (progress === 100) onProcessing();
    };
    request.onload = () => {
      const result = JSON.parse(request.responseText || "{}");
      if (request.status >= 200 && request.status < 300) resolve(result);
      else reject(new Error(result.detail || `Upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error("Upload connection failed. Check that the API is running."));
    request.send(form);
  });
}

function citationParts(answer, evidence, onSelect) {
  const accepted = evidence.filter((item) => item.accepted);
  return answer.split(/(\[\d+\])/g).map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/);
    if (!citation) return <span key={`text-${index}`}>{part}</span>;
    const item = accepted[Number(citation[1]) - 1];
    if (!item) return <span key={`unknown-${index}`}>{part}</span>;
    return <button
      className="citation-chip"
      key={`citation-${index}`}
      type="button"
      title={`${item.source || "Source"} · ${item.section || "Passage"}: ${item.text.slice(0, 180)}`}
      onClick={() => onSelect(item)}
    >[{citation[1]}]</button>;
  });
}

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeSection, setActiveSection] = useState("hero");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [passageCount, setPassageCount] = useState(0);
  const [sampleDocuments, setSampleDocuments] = useState([]);
  const [selectedDocumentHashes, setSelectedDocumentHashes] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [question, setQuestion] = useState("");
  const [answerResult, setAnswerResult] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [answerMode, setAnswerMode] = useState("exam");
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [savedNotes, setSavedNotes] = useState(loadSavedNotes);
  const [darkTheme, setDarkTheme] = useState(loadTheme);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [studyToolTopic, setStudyToolTopic] = useState("");
  const [studyToolType, setStudyToolType] = useState("flashcards");
  const [quizFormat, setQuizFormat] = useState("multiple_choice");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [studyToolCount, setStudyToolCount] = useState(5);
  const [studyToolResult, setStudyToolResult] = useState(null);
  const [studyToolBusy, setStudyToolBusy] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [quizSelections, setQuizSelections] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [flashcardsCompleted, setFlashcardsCompleted] = useState(false);
  const [progressLog, setProgressLog] = useState(loadProgress);
  const [reviewCards, setReviewCards] = useState(loadReviewCards);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [studyGuideTopic, setStudyGuideTopic] = useState("");
  const [studyGuideResult, setStudyGuideResult] = useState(null);
  const [studyGuideBusy, setStudyGuideBusy] = useState(false);
  const [studyAtlas, setStudyAtlas] = useState(null);
  const [atlasEvidence, setAtlasEvidence] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [atlasBusy, setAtlasBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef(null);
  const streamController = useRef(null);
  const commandInput = useRef(null);

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/auth/status")
      .then((status) => {
        if (!active) return;
        setAuthConfigured(status.configured);
        setAuthenticated(status.authenticated);
        if (!status.configured) {
          setLoginError("Owner access is not configured yet. Add the two Studyspace access values in Render’s Environment settings.");
        }
      })
      .catch(() => {
        if (active) setLoginError("Could not connect to Studyspace. Refresh the page and try again.");
      })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressLog));
    } catch {
      console.warn("Study progress could not be saved in this browser.");
    }
  }, [progressLog]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkTheme ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, darkTheme ? "dark" : "light");
    } catch {
      console.warn("Your theme preference could not be saved in this browser.");
    }
  }, [darkTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_NOTES_KEY, JSON.stringify(savedNotes));
    } catch {
      console.warn("Saved notes could not be stored in this browser.");
    }
  }, [savedNotes]);

  useEffect(() => {
    try {
      localStorage.setItem(REVIEW_CARDS_KEY, JSON.stringify(reviewCards));
    } catch {
      console.warn("Flashcard review progress could not be saved in this browser.");
    }
  }, [reviewCards]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery("");
      } else if (event.key === "Escape") {
        setCommandOpen(false);
        setNotesOpen(false);
        setSelectedCitation(null);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!commandOpen) {
      return undefined;
    }
    commandInput.current?.focus();
    const query = commandQuery.trim();
    if (query.length < 3) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const response = await fetch(`${API}/api/v1/search`, {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || `Search failed (${response.status})`);
        setSearchResults(data.results || []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setSearchError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [commandOpen, commandQuery]);

  function recordProgress(type, title, detail = "") {
    const entry = { id: crypto.randomUUID(), type, title: title.slice(0, 220), detail: detail.slice(0, 180), date: localDayKey() };
    setProgressLog((previous) => [entry, ...previous].slice(0, 250));
  }

  const progressMetrics = calculateProgress(progressLog);
  const askedQuestionCount = progressLog.filter((entry) => entry.type === "question").length;
  const completedPracticeCount = progressLog.filter((entry) => ["flashcards_completed", "quiz_completed"].includes(entry.type)).length;
  const completedGuideCount = progressLog.filter((entry) => entry.type === "guide_created").length;
  const maxDailyActivity = Math.max(1, ...progressMetrics.week.map((day) => day.count));
  const dueReviewCards = reviewCards.filter((card) => card.due_at <= clockNow);
  const commandActions = [
    ...NAV_ITEMS.map((item) => ({ id: item.id, title: `Go to ${item.label}`, detail: "Navigate to section", type: "section" })),
    { id: "theme", title: darkTheme ? "Switch to light mode" : "Switch to dark mode", detail: "Change appearance", type: "theme" },
    { id: "notes", title: "Open saved notes", detail: `${savedNotes.length} saved answers`, type: "notes" },
  ].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(commandQuery.trim().toLowerCase()));

  function executeCommand(item) {
    setCommandOpen(false);
    if (item.type === "section") scrollToSection(item.id);
    if (item.type === "theme") setDarkTheme((current) => !current);
    if (item.type === "notes") setNotesOpen(true);
  }

  function openSearchPassage(item) {
    setSelectedCitation(item);
    setCommandOpen(false);
  }

  function scrollToSection(id) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
  }

  useEffect(() => {
    const sections = NAV_ITEMS
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-22% 0px -62% 0px", threshold: 0 },
    );
    sections.forEach((section) => sectionObserver.observe(section));

    const revealTargets = document.querySelectorAll(".reveal");
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    revealTargets.forEach((target) => revealObserver.observe(target));

    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      sectionObserver.disconnect();
      revealObserver.disconnect();
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  async function refreshWorkspace() {
    const summary = await apiRequest("/api/v1/documents");
    const nextDocuments = summary.documents || [];
    const currentHashes = new Set(documents.map((item) => item.document_hash));
    setSelectedDocumentHashes((previous) => {
      const available = new Set(nextDocuments.map((item) => item.document_hash));
      const retained = previous.filter((hash) => available.has(hash));
      const newlyAdded = nextDocuments
        .filter((item) => !currentHashes.has(item.document_hash))
        .map((item) => item.document_hash);
      return [...new Set([...retained, ...newlyAdded])];
    });
    setDocuments(nextDocuments);
    setPassageCount(summary.passage_count || 0);
  }

  useEffect(() => {
    if (!authenticated) return undefined;
    async function loadWorkspace() {
      try {
        const [summary, samples] = await Promise.all([
          apiRequest("/api/v1/documents"),
          apiRequest("/api/v1/sample-documents"),
        ]);
        const nextDocuments = summary.documents || [];
        setDocuments(nextDocuments);
        setSelectedDocumentHashes(nextDocuments.map((item) => item.document_hash));
        setPassageCount(summary.passage_count || 0);
        setSampleDocuments(samples.documents || []);
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadWorkspace();
    return undefined;
  }, [authenticated]);

  async function signIn(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });
      setLoginPassword("");
      setAuthenticated(true);
    } catch (requestError) {
      setLoginError(requestError.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
    } finally {
      setAuthenticated(false);
      setDocuments([]);
      setPassageCount(0);
      setSelectedDocumentHashes([]);
      setPreviewDocument(null);
      setConversation([]);
      setAnswerResult(null);
      setStudyAtlas(null);
      setStudyToolResult(null);
      setStudyGuideResult(null);
      setCommandOpen(false);
    }
  }

  async function askQuestion(text, { replaceMessageId = null } = {}) {
    const normalizedQuestion = text.trim();
    if (!normalizedQuestion) return;

    setBusy(true);
    setStreaming(true);
    setError("");
    setAnswerResult(null);
    setStudyAtlas(null);
    setAtlasEvidence([]);
    setSelectedConceptId("");
    setQuestion(normalizedQuestion);

    const messageId = replaceMessageId || crypto.randomUUID();
    const message = { id: messageId, question: normalizedQuestion, answer: "", evidence: [], streaming: true };
    if (replaceMessageId) {
      setConversation((previous) => previous.map((item) => item.id === replaceMessageId ? message : item));
    } else {
      setConversation((previous) => [...previous, message]);
    }
    const priorTurns = conversation
      .filter((item) => item.id !== replaceMessageId && item.answer)
      .slice(-4)
      .flatMap((item) => [
        { role: "user", content: item.question },
        { role: "assistant", content: item.answer },
      ]);
    const updateMessage = (updates) => setConversation((previous) => previous.map((item) => (
      item.id === messageId ? { ...item, ...updates } : item
    )));
    const controller = new AbortController();
    streamController.current = controller;
    let answer = "";
    let evidence = [];

    try {
      const response = await fetch(`${API}/api/v1/ask/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: normalizedQuestion,
          top_k: 5,
          selected_document_hashes: selectedDocumentHashes,
          mode: answerMode,
          history: priorTurns,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.detail || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleEvent = (block) => {
        const data = block.split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) return;
        const event = JSON.parse(data);
        if (event.type === "evidence") {
          evidence = event.items || [];
          updateMessage({ evidence });
        } else if (event.type === "token") {
          answer += event.text || "";
          updateMessage({ answer });
        } else if (event.type === "error") {
          throw new Error(event.message || "The answer stream failed.");
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        blocks.forEach(handleEvent);
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);

      updateMessage({ streaming: false });
      setAnswerResult({ question: normalizedQuestion, answer, evidence });
      recordProgress("question", normalizedQuestion, `${evidence.filter((item) => item.accepted).length} cited passages`);
      scrollToSection("chat");
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
      updateMessage({ streaming: false });
      if (answer) setAnswerResult({ question: normalizedQuestion, answer, evidence });
    } finally {
      setBusy(false);
      setStreaming(false);
      streamController.current = null;
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    await askQuestion(question);
  }

  async function copyAnswer(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const entries = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setUploadQueue(entries.map(({ id, file }) => ({ id, name: file.name, status: "queued", progress: 0, message: "Waiting to upload" })));
    setBusy(true);
    setError("");
    setNotice("");
    let indexedCount = 0;

    const updateUpload = (id, updates) => setUploadQueue((previous) => previous.map((item) => (
      item.id === id ? { ...item, ...updates } : item
    )));

    for (const { id, file } of entries) {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (![".md", ".txt", ".pdf", ".pptx"].includes(extension)) {
        updateUpload(id, { status: "failed", message: "Use a Markdown, TXT, PDF, or PPTX file." });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        updateUpload(id, { status: "failed", message: "This file is larger than the 5 MB limit." });
        continue;
      }

      updateUpload(id, { status: "uploading", message: "Uploading…" });
      try {
        const result = await uploadFileWithProgress(
          file,
          (progress) => updateUpload(id, { status: "uploading", progress, message: `Uploading · ${progress}%` }),
          () => updateUpload(id, { status: "processing", progress: 100, message: "Parsing, chunking, and indexing…" }),
        );
        await refreshWorkspace();
        setSelectedDocumentHashes((previous) => [...new Set([...previous, result.document_hash])]);
        updateUpload(id, { status: "indexed", progress: 100, message: `${result.chunks} searchable passages` });
        indexedCount += 1;
      } catch (requestError) {
        updateUpload(id, { status: "failed", message: requestError.message });
      }
    }

    if (indexedCount) setNotice(`Added ${indexedCount} source${indexedCount === 1 ? "" : "s"} to your notebook.`);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function openDocumentPreview(document) {
    setError("");
    setPreviewDocument({ document, loading: true });
    try {
      const preview = await apiRequest(`/api/v1/documents/${document.document_hash}/preview`);
      setPreviewDocument({ document, ...preview, loading: false });
    } catch (requestError) {
      setPreviewDocument({ document, loading: false, error: requestError.message });
    }
  }

  function toggleSource(documentHash) {
    setSelectedDocumentHashes((previous) => previous.includes(documentHash)
      ? previous.filter((hash) => hash !== documentHash)
      : [...previous, documentHash]);
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
    setAnswerResult(null);
    scrollToSection("chat");
  }

  async function createStudyAtlas() {
    const topic = answerResult?.question || question;
    if (!topic.trim()) return;

    setAtlasBusy(true);
    setError("");
    setStudyAtlas(null);
    try {
      const result = await apiRequest("/api/v1/study-atlas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), selected_document_hashes: selectedDocumentHashes }),
      });
      if (!result.atlas) {
        setError("There wasn’t enough relevant source material to build a Study Atlas for that topic.");
        return;
      }
      setStudyAtlas(result.atlas);
      setAtlasEvidence(result.evidence || []);
      setSelectedConceptId(result.atlas.nodes[0]?.id || "");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAtlasBusy(false);
    }
  }

  async function generateStudyTool(event) {
    event.preventDefault();
    const topic = studyToolTopic.trim();
    if (!topic || !selectedDocumentHashes.length) return;

    setStudyToolBusy(true);
    setError("");
    setNotice("");
    setStudyToolResult(null);
    setQuizSelections({});
    setQuizSubmitted(false);
    setPracticeIndex(0);
    setCardRevealed(false);
    setFlashcardsCompleted(false);
    try {
      const result = await apiRequest("/api/v1/study-tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tool: studyToolType,
          count: Number(studyToolCount),
          quiz_format: quizFormat,
          difficulty: quizDifficulty,
          selected_document_hashes: selectedDocumentHashes,
        }),
      });
      if (!result.study_tool) {
        setError("There wasn’t enough relevant material in the selected sources to build this study set. Try a more specific topic or select more sources.");
        return;
      }
      const evidence = result.evidence || [];
      let studyTool = result.study_tool;
      if (studyTool.type === "flashcards") {
        const setId = crypto.randomUUID();
        const scheduledCards = studyTool.cards.map((card, index) => ({
          ...card,
          review_id: `${setId}-${index}`,
          due_at: clockNow,
          repetitions: 0,
          interval_days: 0,
          ease: 2.5,
          deck_title: studyTool.title,
          evidence: (card.evidence_ids || [])
            .map((id) => evidence.find((item) => item.id === id))
            .filter(Boolean),
        }));
        setReviewCards((previous) => [...scheduledCards, ...previous].slice(0, 500));
        studyTool = { ...studyTool, cards: scheduledCards };
      }
      setStudyToolResult({ ...studyTool, evidence });
      const itemCount = (result.study_tool.cards || result.study_tool.questions || []).length;
      recordProgress("study_set_created", result.study_tool.title, `${itemCount} ${studyToolType === "quiz" ? "quiz questions" : "flashcards"}`);
      setNotice(`Created ${itemCount} source-grounded ${studyToolType === "quiz" ? "questions" : "flashcards"}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStudyToolBusy(false);
    }
  }

  function openStudyEvidence(evidenceId) {
    const item = studyToolResult?.evidence?.find((entry) => entry.id === evidenceId);
    if (item) setSelectedCitation(item);
  }

  function openGuideEvidence(evidenceId) {
    const item = studyGuideResult?.evidence?.find((entry) => entry.id === evidenceId);
    if (item) setSelectedCitation(item);
  }

  function revealCurrentFlashcard() {
    if (cardRevealed) {
      setCardRevealed(false);
      return;
    }
    setCardRevealed(true);
  }

  function gradeCurrentFlashcard(grade) {
    const card = studyToolResult?.cards?.[practiceIndex];
    const scheduled = reviewCards.find((item) => item.review_id === card?.review_id);
    if (!card || !scheduled) return;
    const scheduledNext = scheduleReview(scheduled, grade, clockNow);
    setReviewCards((previous) => previous.map((item) => item.review_id === card.review_id
      ? scheduledNext
      : item));
    setCardRevealed(false);
    if (practiceIndex < studyToolResult.cards.length - 1) {
      setPracticeIndex((index) => index + 1);
      return;
    }
    if (!flashcardsCompleted) {
      setFlashcardsCompleted(true);
      recordProgress("flashcards_completed", studyToolResult.title, `${studyToolResult.cards.length} cards reviewed`);
      setNotice("Review complete. Your next due dates are saved.");
    }
  }

  function startDailyReview() {
    if (!dueReviewCards.length) return;
    const evidenceById = new Map();
    dueReviewCards.forEach((card) => card.evidence?.forEach((item) => evidenceById.set(item.id, item)));
    setStudyToolResult({
      type: "flashcards",
      title: "Daily review",
      cards: dueReviewCards,
      evidence: [...evidenceById.values()],
    });
    setPracticeIndex(0);
    setCardRevealed(false);
    setFlashcardsCompleted(false);
    scrollToSection("practice");
  }

  function openFlashcardSetup() {
    setStudyToolType("flashcards");
    setNotice("Create a flashcard set to start building your review queue.");
    document.getElementById("study-topic")?.focus({ preventScroll: true });
  }

  function submitQuiz() {
    if (!studyToolResult?.questions || quizSubmitted) return;
    if (studyToolResult.quiz_format === "short_answer") {
      setQuizSubmitted(true);
      recordProgress("quiz_completed", studyToolResult.title, `${studyToolResult.questions.length} short answers reviewed`);
      setNotice("Answers revealed. Compare your responses with the cited reference answers.");
      return;
    }
    const score = studyToolResult.questions.reduce((total, item, index) => total + (quizSelections[index] === item.answer_index ? 1 : 0), 0);
    setQuizSubmitted(true);
    recordProgress("quiz_completed", studyToolResult.title, `Score: ${score} of ${studyToolResult.questions.length}`);
    setNotice(`Quiz complete · ${score} of ${studyToolResult.questions.length} correct.`);
  }

  async function generateStudyGuide(event) {
    event.preventDefault();
    const topic = studyGuideTopic.trim();
    if (!topic || !selectedDocumentHashes.length) return;

    setStudyGuideBusy(true);
    setError("");
    setNotice("");
    setStudyGuideResult(null);
    try {
      const result = await apiRequest("/api/v1/study-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, selected_document_hashes: selectedDocumentHashes }),
      });
      if (!result.study_guide) {
        setError("There wasn’t enough relevant evidence in the selected sources to build a complete guide. Try a more focused topic or select more material.");
        return;
      }
      setStudyGuideResult({ ...result.study_guide, evidence: result.evidence || [] });
      recordProgress("guide_created", result.study_guide.title, `${result.study_guide.key_points.length} key ideas · ${result.study_guide.exam_prompts.length} exam prompts`);
      setNotice("Your source-grounded revision guide is ready.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStudyGuideBusy(false);
    }
  }

  function studyGuideMarkdown(guide) {
    const references = (ids) => ids.map((id) => `[${id}]`).join(" ");
    return [
      `# ${guide.title}`,
      "",
      guide.summary,
      "",
      "## Key ideas",
      ...guide.key_points.map((item) => `- ${item.text} ${references(item.evidence_ids)}`),
      "",
      "## Glossary",
      ...guide.glossary.map((item) => `- **${item.term}:** ${item.definition} ${references(item.evidence_ids)}`),
      "",
      "## Exam prompts",
      ...guide.exam_prompts.map((item) => `- **${item.question}**\n  - ${item.answer_outline} ${references(item.evidence_ids)}`),
    ].join("\n");
  }

  function downloadGuideMarkdown() {
    if (studyGuideResult) downloadTextFile(studyGuideMarkdown(studyGuideResult), `${studyGuideResult.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study-guide"}.md`, "text/markdown;charset=utf-8");
  }

  function printStudyGuide() {
    document.body.classList.add("print-study-guide");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("print-study-guide"), 400);
    }, 30);
  }

  function exportAnkiCsv() {
    const cards = studyToolResult?.cards;
    if (!cards?.length) return;
    const rows = [["Front", "Back", "Tags"], ...cards.map((card) => [
      card.front,
      `${card.back}\n\nSources: ${card.evidence_ids.join(", ")}`,
      `Studyspace ${studyToolResult.title}`,
    ])];
    downloadTextFile(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`, "studyspace-flashcards-anki.csv", "text/csv;charset=utf-8");
  }

  if (!authChecked) {
    return <main className="auth-screen"><div className="auth-card"><span className="brand-mark">S</span><p className="eyebrow">STUDENT NOTEBOOK</p><h1>Opening your private notebook…</h1></div></main>;
  }

  if (!authenticated) {
    return (
      <main className="auth-screen">
        <form className="auth-card" onSubmit={signIn}>
          <span className="brand-mark">S</span>
          <p className="eyebrow"><span className="eyebrow-dot" /> PRIVATE STUDYSPACE</p>
          <h1>Welcome back.</h1>
          <p className="auth-description">This notebook is private. Enter your owner password to open your study materials.</p>
          <label htmlFor="owner-password">Owner password</label>
          <input
            autoComplete="current-password"
            id="owner-password"
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            placeholder="Enter your private password"
            required
            disabled={!authConfigured || loginBusy}
          />
          {loginError && <p className="auth-error" role="alert">{loginError}</p>}
          <button className="primary-button" type="submit" disabled={!authConfigured || loginBusy || !loginPassword}>
            {loginBusy ? "Unlocking…" : "Open my notebook"}
          </button>
          <small>Only you should know this password. Do not share it.</small>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => scrollToSection("hero")} aria-label="Studyspace home">
          <span className="brand-mark">S</span>
          <span>
            <strong>Studyspace</strong>
            <small>STUDENT NOTEBOOK</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              className={activeSection === id ? "nav-link active" : "nav-link"}
              onClick={() => scrollToSection(id)}
              aria-current={activeSection === id ? "location" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="connection-status">
          <span className="status-dot" />
          PRIVATE SESSION
        </div>
        <div className="topbar-actions">
          <button className="topbar-tool-button command-trigger" type="button" onClick={() => { setCommandOpen(true); setCommandQuery(""); }} aria-label="Search Studyspace and commands" aria-keyshortcuts="Control+K Meta+K"><span aria-hidden="true">⌕</span><span>Search</span><kbd>⌘K</kbd></button>
          <button className="topbar-tool-button theme-trigger" type="button" onClick={() => setDarkTheme((current) => !current)} aria-label={darkTheme ? "Switch to light mode" : "Switch to dark mode"} title={darkTheme ? "Switch to light mode" : "Switch to dark mode"}><span aria-hidden="true">{darkTheme ? "☼" : "◐"}</span></button>
          <button className="topbar-tool-button notes-trigger" type="button" onClick={() => setNotesOpen(true)} aria-label={`Open ${savedNotes.length} saved notes`} title="Saved notes"><span aria-hidden="true">▤</span><span>Notes</span></button>
          <button className="topbar-tool-button logout-trigger" type="button" onClick={signOut} aria-label="Lock this notebook" title="Lock this notebook"><span aria-hidden="true">↪</span><span>Lock</span></button>
        </div>
        <div className="scroll-progress-track" aria-hidden="true">
          <span className="scroll-progress-value" style={{ width: `${scrollProgress}%` }} />
        </div>
      </header>

      <main className="page-wrap">
        {error && <div className="alert error-alert">{error}</div>}
        {notice && <div className="alert success-alert">{notice}</div>}

        <section id="hero" className="study-section reveal" aria-labelledby="hero-title">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL STUDY WORKSPACE</div>
              <h1 id="hero-title">Learn deeply<br />from <em>your sources.</em></h1>
              <p>Bring together your class notes, slides, and readings. Ask questions, explore difficult ideas, and trace answers back to the material you shared.</p>
              <div className="hero-tags">
                <span>Course material, together</span>
                <span>Source-grounded answers</span>
                <span>Citations you can inspect</span>
              </div>
              <button className="primary-button hero-cta" onClick={() => scrollToSection("sources")}>Build your notebook <span>↓</span></button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orb orb-one" /><div className="orb orb-two" /><div className="orb orb-three" />
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="art-caption">IDEAS IN MOTION</div>
            </div>
          </section>
          <section className="stats-row hero-stats" aria-label="Notebook overview">
            <div className="stat-card"><span>DOCUMENTS</span><strong>{String(documents.length).padStart(2, "0")}</strong><small>In your workspace</small></div>
            <div className="stat-card"><span>PASSAGES</span><strong>{String(passageCount).padStart(2, "0")}</strong><small>Ready for retrieval</small></div>
            <div className="stat-card accent-stat"><span>STUDY STREAK</span><strong>—</strong><small>Tracking arrives in a later phase</small></div>
          </section>
        </section>

        <section id="sources" className="study-section content-page reveal" aria-labelledby="sources-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR STUDY NOTEBOOK</div>
          <div className="page-title-row">
            <div>
              <h1 id="sources-title">Bring your materials together.</h1>
              <p>Upload notes, readings, and slides to build a source-grounded study space.</p>
            </div>
          </div>
          <label
            className={`drop-zone ${dragActive ? "drag-active" : ""} ${busy ? "upload-disabled" : ""}`}
            htmlFor="source-file-input"
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (!busy) uploadFiles(event.dataTransfer.files);
            }}
          >
            <input id="source-file-input" ref={fileInput} className="hidden-input" type="file" accept=".md,.txt,.pdf,.pptx" multiple disabled={busy} onChange={(event) => uploadFiles(event.target.files)} />
            <span className="drop-icon" aria-hidden="true">＋</span>
            <span className="drop-copy"><strong>Drop your course materials here</strong><small>or choose files · MD, TXT, PDF, PPTX · up to 5 MB each</small></span>
            <span className="drop-browse">Browse files</span>
          </label>
          {uploadQueue.length > 0 && <div className="upload-queue" aria-live="polite">
            {uploadQueue.map((item) => <div className={`upload-item ${item.status}`} key={item.id}>
              <span className="upload-state-mark">{item.status === "indexed" ? "✓" : item.status === "failed" ? "!" : "·"}</span>
              <div className="upload-item-copy"><strong>{item.name}</strong><small>{item.message}</small></div>
              {item.status === "uploading" && <div className="upload-meter"><span style={{ width: `${item.progress}%` }} /></div>}
            </div>)}
          </div>}
          <div className="stats-row compact-stats">
            <div className="stat-card"><span>DOCUMENTS</span><strong>{documents.length}</strong><small>Indexed here</small></div>
            <div className="stat-card"><span>PASSAGES</span><strong>{passageCount}</strong><small>Searchable units</small></div>
            <div className="stat-card"><span>FORMATS</span><strong>04</strong><small>MD · TXT · PDF · PPTX</small></div>
          </div>
          <div className="library-panel">
            <div className="panel-heading"><h2>Your sources</h2><span>{selectedDocumentHashes.length} of {documents.length} selected for chat</span></div>
            {documents.map((document) => (
              <div className="document-row library-row" key={document.document_hash}>
                <label className="source-checkbox" title="Include this source in Study chat"><input type="checkbox" checked={selectedDocumentHashes.includes(document.document_hash)} onChange={() => toggleSource(document.document_hash)} aria-label={`Use ${document.filename} in chat`} /></label>
                <span className="file-icon">DOC</span>
                <div className="document-row-copy"><strong>{document.filename}</strong><small>{document.chunks} passages · Added {document.uploaded_at?.slice(0, 10) || "recently"}</small></div>
                <span className="ready-pill">INDEXED</span>
                <button className="preview-button" onClick={() => openDocumentPreview(document)}>Preview</button>
                <button className="remove-button" onClick={() => removeDocument(document.document_hash)} disabled={busy}>Remove</button>
              </div>
            ))}
            {!documents.length && <div className="empty-card">No sources yet. Upload class material or add the sample study note below.</div>}
          </div>
          {previewDocument && <div className="document-preview-panel">
            <div className="panel-heading"><div><span className="section-kicker">SOURCE PREVIEW</span><h2>{previewDocument.document.filename}</h2></div><button className="preview-button" onClick={() => setPreviewDocument(null)}>Close</button></div>
            {previewDocument.loading ? <div className="empty-card">Loading source preview…</div> : previewDocument.error ? <div className="alert error-alert">{previewDocument.error}</div> : <>
              <div className="preview-summary"><strong>Quick overview</strong><ul>{previewDocument.summary.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></div>
              <div className="preview-topics"><strong>Sections / topics</strong><div>{previewDocument.topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div>
              <div className="preview-passages">{previewDocument.passages.map((passage) => <article key={passage.id}><small>{passage.section}{passage.page ? ` · Page ${passage.page}` : ""}{passage.slide ? ` · Slide ${passage.slide}` : ""}</small><p>{passage.text}</p></article>)}</div>
            </>}
          </div>}
          <div className="library-panel samples-panel">
            <div className="panel-heading"><div><h2>Try a sample study note</h2><p>Explore the notebook with a short lesson.</p></div></div>
            <div className="sample-grid">
              {sampleDocuments.map((sample) => {
                const alreadyAdded = documents.some((doc) => doc.filename === sample.filename);
                return <button className="sample-card" key={sample.filename} disabled={busy || alreadyAdded} onClick={() => addSample(sample.filename)}>
                  <span className="sample-mark">↗</span><strong>{sample.title}</strong><small>{alreadyAdded ? "Already in your notebook" : "Add to notebook"}</small>
                </button>;
              })}
            </div>
          </div>
        </section>

        <section id="chat" className="study-section content-page answer-page reveal" aria-labelledby="chat-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> STUDY CHAT</div>
          <h1 id="chat-title">Explore what you’re learning.</h1>
          <p className="page-intro">Ask about your sources and follow each answer back to its passage.</p>
          <section className="ask-panel">
            <div className="section-kicker">ASK YOUR MATERIAL <span>GROUNDED IN YOUR SOURCES</span></div>
            <div className="chat-controls">
              <label htmlFor="answer-mode">Answer style</label>
              <select id="answer-mode" value={answerMode} onChange={(event) => setAnswerMode(event.target.value)} disabled={streaming}>
                <option value="simple">Simple</option><option value="exam">Exam-ready</option><option value="deep">Deep-dive</option><option value="steps">Step-by-step</option>
              </select>
              <span>{selectedDocumentHashes.length} of {documents.length} sources selected</span>
            </div>
            <form onSubmit={submitQuestion}>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about your notes, readings, or slides…" aria-label="Ask a question about your documents" maxLength={2000} />
              <div className="ask-panel-footer">
                <p>Uses {selectedDocumentHashes.length} selected sources · citations included</p>
                <div className="ask-actions">
                  <button className="atlas-launch-button" type="button" disabled={atlasBusy || busy || !question.trim() || selectedDocumentHashes.length === 0} onClick={createStudyAtlas}><span aria-hidden="true">✳</span>{atlasBusy ? "Building atlas…" : "Visualize topic"}</button>
                  {streaming ? <button className="stop-button" type="button" onClick={() => streamController.current?.abort()}>Stop response</button> : <button className="primary-button" disabled={busy}>{busy ? "Preparing…" : "Find an answer"} <span>↗</span></button>}
                </div>
              </div>
            </form>
            <div className="suggestions"><span>TRY</span>{[
              "Explain a difficult idea from my notes in simple terms.",
              "What are the key points I should revise before an exam?",
            ].map((text) => <button key={text} onClick={() => askSuggestedQuestion(text)}>{text} <span>→</span></button>)}</div>
          </section>
          {conversation.length ? <section className="conversation-list" aria-label="Conversation">
            {conversation.map((turn) => {
              const accepted = turn.evidence.filter((item) => item.accepted);
              const confidenceDistance = Math.min(...accepted.map((item) => item.distance));
              return <article className="conversation-turn" key={turn.id}>
                <div className="student-message"><span>YOU ASKED</span><p>{turn.question}</p></div>
                <div className="answer-column">
                  <div className="section-kicker">GROUNDED ANSWER <span>{turn.streaming ? "GENERATING" : `${accepted.length} CITED PASSAGES`}</span></div>
                  <article className="answer-card"><p>{citationParts(turn.answer, turn.evidence, setSelectedCitation)}{turn.streaming && <span className="stream-caret" aria-label="Generating answer" />}</p></article>
                  {!turn.streaming && accepted.length > 0 && <div className="confidence-line"><span className="confidence-dot" />{confidenceDistance <= 0.2 ? "Strong source match" : "Grounded in selected sources"}</div>}
                  {!turn.streaming && <div className="answer-toolbar">
                    <button type="button" onClick={() => copyAnswer(turn.answer)}>Copy</button>
                    <button type="button" onClick={() => askQuestion(turn.question, { replaceMessageId: turn.id })}>Regenerate</button>
                    <button type="button" onClick={() => {
                      setSavedNotes((previous) => previous.some((note) => note.id === turn.id) ? previous : [...previous, { id: turn.id, question: turn.question, answer: turn.answer }]);
                      setNotice("Answer saved to your notes.");
                    }}>{savedNotes.some((note) => note.id === turn.id) ? "Saved to notes ✓" : "Save to notes"}</button>
                  </div>}
                  {!turn.streaming && <div className="follow-up-row"><span>CONTINUE</span><button onClick={() => askQuestion(`Give me a concrete example related to: ${turn.question}`)}>Give me an example</button><button onClick={() => askQuestion(`What are the most important points to remember about: ${turn.question}`)}>Key points to remember</button></div>}
                  <details className="inline-evidence"><summary>Inspect {turn.evidence.length} retrieved passages</summary>
                    {turn.evidence.map((item) => <article className={item.accepted ? "evidence-card" : "evidence-card rejected"} key={item.id}>
                      <div className="evidence-top"><strong>{item.source || "Source"}</strong><span>{item.accepted ? `CITATION [${item.citation_number}]` : "BELOW CUTOFF"}</span></div>
                      <small>{item.section || "Passage"}{item.page ? ` · Page ${item.page}` : ""}{item.slide ? ` · Slide ${item.slide}` : ""}</small><p>{item.text}</p>
                    </article>)}
                  </details>
                </div>
              </article>;
            })}
          </section> : <div className="empty-card chat-empty">Ask a question to get a cited explanation from the sources in this notebook.</div>}
        </section>

        <section id="atlas" className="study-section content-page reveal" aria-labelledby="atlas-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> VISUAL STUDY TOOL</div>
          <h1 id="atlas-title">See how ideas connect.</h1>
          <p className="page-intro">Turn a topic into a source-linked concept map you can explore.</p>
          {studyAtlas ? <StudyAtlas atlas={studyAtlas} evidence={atlasEvidence} selectedConceptId={selectedConceptId} onSelectConcept={setSelectedConceptId} /> : (
            <div className="coming-card atlas-empty"><span className="coming-mark">✳</span><h2>Your Study Atlas will live here.</h2><p>Ask a question in Study chat, then choose <strong>Visualize topic</strong> to map the main ideas and inspect their sources.</p><button className="text-button" onClick={() => scrollToSection("chat")}>Go to Study chat <span>↗</span></button></div>
          )}
        </section>

        <section id="practice" className="study-section content-page reveal" aria-labelledby="practice-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> ACTIVE RECALL</div>
          <h1 id="practice-title">Practice what you’ve learned.</h1>
          <p className="page-intro">Turn your selected notes into a quick study session. Every card and answer stays tied to its source.</p>
          <div className="practice-builder">
            <div className="practice-builder-copy"><span className="section-kicker">MAKE A STUDY SET</span><h2>What are you learning today?</h2><p>Choose a topic and we’ll build a focused practice set from the sources you selected above.</p></div>
            <form onSubmit={generateStudyTool} className="practice-form">
              <label htmlFor="study-topic">Topic or chapter</label>
              <input id="study-topic" value={studyToolTopic} onChange={(event) => setStudyToolTopic(event.target.value)} placeholder="e.g. binary search, process scheduling…" maxLength={500} />
              {answerResult?.question && <button type="button" className="topic-from-chat" onClick={() => setStudyToolTopic(answerResult.question)}>Use my last chat question ↗</button>}
              <div className="practice-options">
                <label>Number of cards/questions<select value={studyToolCount} onChange={(event) => setStudyToolCount(event.target.value)}><option value="3">3</option><option value="5">5</option><option value="8">8</option><option value="10">10</option></select></label>
                {studyToolType === "quiz" && <>
                  <label>Quiz style<select value={quizFormat} onChange={(event) => setQuizFormat(event.target.value)}><option value="multiple_choice">Multiple choice</option><option value="true_false">True or false</option><option value="short_answer">Short answer</option></select></label>
                  <label>Difficulty<select value={quizDifficulty} onChange={(event) => setQuizDifficulty(event.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
                </>}
              </div>
              <div className="practice-form-bottom">
                <div className="study-tool-switch" role="group" aria-label="Choose study tool">
                  <button type="button" className={studyToolType === "flashcards" ? "selected" : ""} onClick={() => setStudyToolType("flashcards")}>Flashcards</button>
                  <button type="button" className={studyToolType === "quiz" ? "selected" : ""} onClick={() => setStudyToolType("quiz")}>Quick quiz</button>
                </div>
                <button className="primary-button" type="submit" disabled={studyToolBusy || !studyToolTopic.trim() || selectedDocumentHashes.length === 0}>{studyToolBusy ? "Building your set…" : "Create study set"}<span>↗</span></button>
              </div>
              <small className="practice-source-note">Using {selectedDocumentHashes.length} selected {selectedDocumentHashes.length === 1 ? "source" : "sources"}</small>
            </form>
          </div>

          <div className="daily-review-card">
            <div><span className="section-kicker">SPACED REPETITION</span><h2>Your review queue</h2><p>{dueReviewCards.length ? `${dueReviewCards.length} ${dueReviewCards.length === 1 ? "card is" : "cards are"} ready to revisit.` : reviewCards.length ? "You’re all caught up. More cards will appear here when they’re due." : "The queue needs flashcards first. Create a set, rate each card, then review them here."}</p></div>
            <div className="daily-review-action"><strong>{dueReviewCards.length}</strong><span>{dueReviewCards.length ? "DUE NOW" : reviewCards.length ? "UP TO DATE" : "NO CARDS YET"}</span>{dueReviewCards.length ? <button className="primary-button" type="button" onClick={startDailyReview}>Start review <span>↗</span></button> : reviewCards.length ? <button className="primary-button" type="button" disabled>Nothing due yet</button> : <button className="primary-button" type="button" onClick={openFlashcardSetup}>Create flashcards <span>↗</span></button>}</div>
          </div>

          {studyToolResult?.type === "flashcards" && <section className="practice-result" aria-label="Generated flashcards">
            <div className="practice-result-heading"><div><span className="section-kicker">FLASHCARD SESSION</span><h2>{studyToolResult.title}</h2></div><div className="practice-result-actions"><button type="button" className="preview-button" onClick={exportAnkiCsv}>Export for Anki</button><span>{practiceIndex + 1} / {studyToolResult.cards.length}</span></div></div>
            {flashcardsCompleted ? <div className="review-complete"><span className="review-complete-icon">✓</span><span className="section-kicker">SESSION COMPLETE</span><h3>Good work. These cards are scheduled.</h3><p>Your self-ratings set the next review dates. Come back when cards are due to strengthen recall.</p><button className="primary-button" type="button" onClick={startDailyReview} disabled={!dueReviewCards.length}>Review {dueReviewCards.length} other due cards <span>↗</span></button></div> : <>
            <div className={`flashcard ${cardRevealed ? "revealed" : ""}`}>
              <span className="flashcard-face-label">{cardRevealed ? "ANSWER" : "PROMPT"}</span>
              <p>{cardRevealed ? studyToolResult.cards[practiceIndex].back : studyToolResult.cards[practiceIndex].front}</p>
              {cardRevealed && <div className="study-source-refs">{studyToolResult.cards[practiceIndex].evidence_ids.map((id) => <button key={id} type="button" onClick={() => openStudyEvidence(id)}>Inspect source ↗</button>)}</div>}
              {!cardRevealed && <button className="flashcard-reveal" type="button" onClick={revealCurrentFlashcard}>Reveal answer</button>}
              {cardRevealed && <div className="flashcard-grading"><span>How well did you recall it?</span><div>{[{ id: "again", label: "Again", hint: "10 min" }, { id: "hard", label: "Hard", hint: "Short" }, { id: "good", label: "Good", hint: "1–6 days" }, { id: "easy", label: "Easy", hint: "Longer" }].map((grade) => <button type="button" className={`grade-${grade.id}`} key={grade.id} onClick={() => gradeCurrentFlashcard(grade.id)}><strong>{grade.label}</strong><small>{grade.hint}</small></button>)}</div></div>}
            </div>
            <div className="flashcard-controls"><button type="button" disabled={practiceIndex === 0} onClick={() => { setPracticeIndex((index) => index - 1); setCardRevealed(false); }}>← Previous</button><div className="practice-progress"><span style={{ width: `${((practiceIndex + 1) / studyToolResult.cards.length) * 100}%` }} /></div><span>{cardRevealed ? "Choose a rating to schedule this card" : "Recall first, then reveal"}</span></div>
            </>}
          </section>}

          {studyToolResult?.type === "quiz" && <section className="practice-result quiz-result" aria-label="Generated quiz">
            <div className="practice-result-heading"><div><span className="section-kicker">{studyToolResult.quiz_format === "short_answer" ? "SHORT ANSWER" : studyToolResult.quiz_format === "true_false" ? "TRUE OR FALSE" : "QUICK QUIZ"} · {(studyToolResult.difficulty || "medium").toUpperCase()}</span><h2>{studyToolResult.title}</h2></div><span>{studyToolResult.questions.length} questions</span></div>
            {quizSubmitted && studyToolResult.quiz_format !== "short_answer" && <div className="quiz-score">You got <strong>{studyToolResult.questions.filter((item, index) => quizSelections[index] === item.answer_index).length} of {studyToolResult.questions.length}</strong> correct.</div>}
            {quizSubmitted && studyToolResult.quiz_format === "short_answer" && <div className="quiz-score">Compare your response to each cited reference answer below.</div>}
            <div className="quiz-question-list">{studyToolResult.questions.map((item, index) => <article className="quiz-question" key={`${index}-${item.question}`}>
              <span className="quiz-question-number">QUESTION {String(index + 1).padStart(2, "0")}</span><h3>{item.question}</h3>
              {studyToolResult.quiz_format === "short_answer" ? <label className="short-answer-field"><span>Your answer</span><textarea value={quizSelections[index] || ""} disabled={quizSubmitted} onChange={(event) => setQuizSelections((previous) => ({ ...previous, [index]: event.target.value }))} placeholder="Write a few words from memory…" rows={3} />{quizSubmitted && <div className="short-answer-key"><strong>Reference answer</strong><p>{item.answer_text}</p></div>}</label> : <div className="quiz-options">{item.options.map((option, optionIndex) => {
                const selected = quizSelections[index] === optionIndex;
                const isCorrect = item.answer_index === optionIndex;
                const state = quizSubmitted && isCorrect ? "correct" : quizSubmitted && selected ? "incorrect" : selected ? "selected" : "";
                return <button type="button" key={`${optionIndex}-${option}`} className={state} disabled={quizSubmitted} onClick={() => setQuizSelections((previous) => ({ ...previous, [index]: optionIndex }))}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>;
              })}</div>}
              {quizSubmitted && <div className="quiz-explanation"><p>{item.explanation}</p><div className="study-source-refs">{item.evidence_ids.map((id) => <button key={id} type="button" onClick={() => openStudyEvidence(id)}>Inspect source ↗</button>)}</div></div>}
            </article>)}</div>
            {!quizSubmitted ? <button className="primary-button submit-quiz" type="button" disabled={Object.keys(quizSelections).length < studyToolResult.questions.length || (studyToolResult.quiz_format === "short_answer" && studyToolResult.questions.some((_, index) => !String(quizSelections[index] || "").trim()))} onClick={submitQuiz}>{studyToolResult.quiz_format === "short_answer" ? "Reveal reference answers" : "Check my answers"}<span>✓</span></button> : <button className="text-button" type="button" onClick={() => { setQuizSelections({}); setQuizSubmitted(false); }}>Try again ↻</button>}
          </section>}
        </section>

        <section id="guide" className="study-section content-page reveal" aria-labelledby="guide-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR REVISION COMPANION</div>
          <h1 id="guide-title">Make a guide you can return to.</h1>
          <p className="page-intro">Create a compact revision pack from your selected course material, with a source trail for every key idea.</p>
          <form className="guide-builder" onSubmit={generateStudyGuide}>
            <div className="guide-builder-copy"><span className="section-kicker">REVISION GUIDE</span><h2>Pull the chapter together.</h2><p>Generate an overview, key ideas, a glossary, and exam-style prompts from your notebook.</p></div>
            <div className="guide-builder-controls"><label htmlFor="guide-topic">Topic or chapter</label><input id="guide-topic" value={studyGuideTopic} onChange={(event) => setStudyGuideTopic(event.target.value)} placeholder="e.g. binary search, memory management…" maxLength={500} />
              {answerResult?.question && <button type="button" className="topic-from-chat" onClick={() => setStudyGuideTopic(answerResult.question)}>Use my last chat question ↗</button>}
              <div className="guide-builder-actions"><small>Using {selectedDocumentHashes.length} selected sources</small><button className="primary-button" type="submit" disabled={studyGuideBusy || !studyGuideTopic.trim() || selectedDocumentHashes.length === 0}>{studyGuideBusy ? "Writing your guide…" : "Build revision guide"}<span>↗</span></button></div>
            </div>
          </form>
          {studyGuideResult && <article className="study-guide-result">
            <header className="guide-result-header"><div><span className="section-kicker">YOUR STUDY GUIDE</span><h2>{studyGuideResult.title}</h2></div><div className="guide-export-actions"><button type="button" className="preview-button" onClick={downloadGuideMarkdown}>Download Markdown</button><button type="button" className="preview-button" onClick={printStudyGuide}>Save as PDF</button></div></header>
            <section className="guide-summary"><span className="guide-label">THE BIG PICTURE</span><p>{studyGuideResult.summary}</p></section>
            <section className="guide-content-section"><div className="guide-section-title"><span>01</span><div><h3>Key ideas</h3><p>The concepts worth keeping in your working memory.</p></div></div>
              <div className="guide-key-points">{studyGuideResult.key_points.map((item, index) => <article key={`${index}-${item.text}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{item.text}</p><div className="study-source-refs">{item.evidence_ids.map((id) => <button key={id} type="button" onClick={() => openGuideEvidence(id)}>Inspect source ↗</button>)}</div></article>)}</div>
            </section>
            <section className="guide-content-section"><div className="guide-section-title"><span>02</span><div><h3>Glossary</h3><p>Definitions pulled from the material you shared.</p></div></div>
              <div className="guide-glossary">{studyGuideResult.glossary.map((item) => <article key={item.term}><h4>{item.term}</h4><p>{item.definition}</p><div className="study-source-refs">{item.evidence_ids.map((id) => <button key={id} type="button" onClick={() => openGuideEvidence(id)}>Inspect source ↗</button>)}</div></article>)}</div>
            </section>
            <section className="guide-content-section"><div className="guide-section-title"><span>03</span><div><h3>Exam prompts</h3><p>Try answering before revealing the outline.</p></div></div>
              <div className="guide-prompts">{studyGuideResult.exam_prompts.map((item, index) => <details key={`${index}-${item.question}`}><summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}</summary><div><p>{item.answer_outline}</p><div className="study-source-refs">{item.evidence_ids.map((id) => <button key={id} type="button" onClick={() => openGuideEvidence(id)}>Inspect source ↗</button>)}</div></div></details>)}</div>
            </section>
            <footer className="guide-evidence-note">Grounded in {studyGuideResult.evidence.filter((item) => item.accepted).length} retrieved source passages. Select any source link to inspect the passage.</footer>
          </article>}
        </section>

        <section id="progress" className="study-section content-page reveal" aria-labelledby="progress-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> YOUR LEARNING JOURNEY</div>
          <h1 id="progress-title">A little progress, every day.</h1>
          <p className="page-intro">A private view of the work you’ve done in this browser. Your learning activity stays on this device.</p>
          <div className="progress-summary-grid">
            <div className="stat-card accent-stat"><span>ACTIVE STREAK</span><strong>{progressMetrics.streak} {progressMetrics.streak === 1 ? "day" : "days"}</strong><small>Consecutive days with study activity</small></div>
            <div className="stat-card"><span>QUESTIONS EXPLORED</span><strong>{askedQuestionCount}</strong><small>Source-grounded chat turns</small></div>
            <div className="stat-card"><span>PRACTICE COMPLETED</span><strong>{completedPracticeCount}</strong><small>Finished flashcard or quiz sessions</small></div>
            <div className="stat-card"><span>CARDS DUE</span><strong>{dueReviewCards.length}</strong><small>{reviewCards.length} cards in your review library</small></div>
            <div className="stat-card"><span>GUIDES CREATED</span><strong>{completedGuideCount}</strong><small>Revision guides made from sources</small></div>
          </div>
          <div className="progress-dashboard-grid">
            <section className="progress-panel weekly-activity" aria-labelledby="week-activity-title">
              <div className="panel-heading"><div><h2 id="week-activity-title">Your last seven days</h2><p>Small steps add up.</p></div><span>ACTIVITY</span></div>
              <div className="activity-bars">{progressMetrics.week.map((day) => <div className="activity-day" key={day.key} aria-label={`${day.label}: ${day.count} activities`}><span className="activity-count">{day.count || ""}</span><div className="activity-bar-track"><span style={{ height: `${day.count ? Math.max(12, (day.count / maxDailyActivity) * 100) : 3}%` }} /></div><small>{day.label}</small></div>)}</div>
            </section>
            <section className="progress-panel recent-activity" aria-labelledby="recent-activity-title">
              <div className="panel-heading"><div><h2 id="recent-activity-title">Recent activity</h2><p>Your latest study moments.</p></div><span>{progressLog.length} SAVED</span></div>
              {progressLog.length ? <div className="activity-list">{progressLog.slice(0, 8).map((entry) => <article className="activity-entry" key={entry.id}><span className={`activity-icon ${entry.type}`} aria-hidden="true">{entry.type === "question" ? "?" : entry.type === "guide_created" ? "✳" : entry.type === "quiz_completed" ? "✓" : entry.type === "flashcards_completed" ? "▤" : "＋"}</span><div><strong>{ACTIVITY_LABELS[entry.type] || "Study activity"}</strong><p>{entry.title}</p>{entry.detail && <small>{entry.detail}</small>}</div><time dateTime={entry.date}>{readableDay(entry.date)}</time></article>)}</div> : <div className="progress-empty"><strong>Your first study session starts here.</strong><p>Ask a question, complete a practice set, or create a guide and it’ll appear in this timeline.</p><button className="text-button" type="button" onClick={() => scrollToSection("chat")}>Go to Study chat <span>↗</span></button></div>}
            </section>
          </div>
          <p className="progress-privacy-note">Progress is saved in this browser’s local storage. Clearing browser data will reset this history.</p>
        </section>

        <footer className="site-footer">
          <span>STUDYSPACE</span>
          <span>A LOCAL STUDY NOTEBOOK</span>
          <span>ANSWERS GROUNDED IN YOUR SOURCES</span>
        </footer>
      </main>
      {commandOpen && <div className="command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
        <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
          <div className="command-input-row"><span aria-hidden="true">⌕</span><input ref={commandInput} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search your sources or jump to…" aria-label="Search your sources or commands" /><kbd>ESC</kbd></div>
          <h2 id="command-title" className="command-section-label">QUICK ACTIONS</h2>
          <div className="command-action-list">{commandActions.length ? commandActions.slice(0, 8).map((item) => <button type="button" key={item.id} onClick={() => executeCommand(item)}><span className="command-action-icon">{item.type === "section" ? "↗" : item.type === "theme" ? "◐" : "▤"}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><kbd>↵</kbd></button>) : <p className="command-hint">No matching actions.</p>}</div>
          <h2 className="command-section-label">SOURCE SEARCH <span>SEMANTIC</span></h2>
          {commandQuery.trim().length < 3 ? <p className="command-hint">Type at least 3 characters to search across your indexed passages.</p> : searchLoading ? <p className="command-hint">Looking through your sources…</p> : searchError ? <p className="command-error">{searchError}</p> : searchResults.length ? <div className="command-search-results">{searchResults.map((item) => <button type="button" key={item.id} onClick={() => openSearchPassage(item)}><span className="search-result-source">{item.source || "Study source"}<small>{item.section || "Passage"}{item.page ? ` · Page ${item.page}` : ""}{item.slide ? ` · Slide ${item.slide}` : ""}</small></span><span className="search-result-text">{item.text}</span><span className={item.accepted ? "search-result-match accepted" : "search-result-match"}>{item.accepted ? "GOOD MATCH" : "RELATED"}</span></button>)}</div> : <p className="command-hint">No passages found for that search.</p>}
          <footer className="command-footer"><span>Navigate with Tab · Open with Enter</span><span><kbd>CTRL</kbd> + <kbd>K</kbd> to open</span></footer>
        </section>
      </div>}
      {notesOpen && <div className="citation-drawer-backdrop" role="presentation" onClick={() => setNotesOpen(false)}>
        <aside className="citation-drawer notes-drawer" role="dialog" aria-modal="true" aria-labelledby="saved-notes-title" onClick={(event) => event.stopPropagation()}>
          <div className="citation-drawer-heading"><div><span className="section-kicker">YOUR LIBRARY</span><h2 id="saved-notes-title">Saved notes</h2></div><button className="preview-button" type="button" onClick={() => setNotesOpen(false)}>Close</button></div>
          {savedNotes.length ? <div className="saved-note-list">{savedNotes.slice().reverse().map((note) => <article className="saved-note-card" key={note.id}><span className="section-kicker">FROM STUDY CHAT</span><h3>{note.question}</h3><p>{note.answer}</p><div><button type="button" onClick={() => copyAnswer(note.answer)}>Copy</button><button type="button" onClick={() => setSavedNotes((previous) => previous.filter((item) => item.id !== note.id))}>Remove</button></div></article>)}</div> : <div className="progress-empty"><strong>No saved notes yet.</strong><p>Use “Save to notes” on any chat answer to keep it here.</p><button className="text-button" type="button" onClick={() => { setNotesOpen(false); scrollToSection("chat"); }}>Go to Study chat <span>↗</span></button></div>}
          <p className="progress-privacy-note">Saved notes stay in this browser.</p>
        </aside>
      </div>}
      {selectedCitation && <div className="citation-drawer-backdrop" role="presentation" onClick={() => setSelectedCitation(null)}>
        <aside className="citation-drawer" role="dialog" aria-modal="true" aria-labelledby="citation-drawer-title" onClick={(event) => event.stopPropagation()}>
          <div className="citation-drawer-heading"><div><span className="section-kicker">SOURCE PASSAGE</span><h2 id="citation-drawer-title">{selectedCitation.source || "Study source"}</h2></div><button className="preview-button" type="button" onClick={() => setSelectedCitation(null)} aria-label="Close source passage">Close</button></div>
          <p className="citation-location">{selectedCitation.section || "Passage"}{selectedCitation.page ? ` · Page ${selectedCitation.page}` : ""}{selectedCitation.slide ? ` · Slide ${selectedCitation.slide}` : ""}</p>
          <blockquote>{selectedCitation.text}</blockquote>
          <button className="text-button" type="button" onClick={() => { setSelectedCitation(null); scrollToSection("sources"); }}>Open source library <span>↗</span></button>
        </aside>
      </div>}
      <button className={`back-to-top ${scrollProgress > 8 ? "visible" : ""}`} onClick={() => scrollToSection("hero")} aria-label="Back to top">↑</button>
    </div>
  );
}

function StudyAtlas({ atlas, evidence, selectedConceptId, onSelectConcept }) {
  const nodeStep = 156;
  const nodeTop = (index) => 32 + index * nodeStep;
  const canvasHeight = Math.max(620, atlas.nodes.length * nodeStep + 64);
  const rootY = canvasHeight / 2;
  const sourceDetailRef = useRef(null);
  const previousConceptId = useRef(selectedConceptId);
  const selectedConcept = atlas.nodes.find((node) => node.id === selectedConceptId);
  const linkedEvidence = selectedConcept
    ? evidence.filter((item) => selectedConcept.evidence_ids.includes(item.id))
    : [];

  useEffect(() => {
    if (
      previousConceptId.current &&
      selectedConceptId &&
      previousConceptId.current !== selectedConceptId
    ) {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      sourceDetailRef.current?.scrollIntoView({ behavior, block: "nearest" });
    }
    previousConceptId.current = selectedConceptId;
  }, [selectedConceptId]);

  return (
    <section className="atlas-panel">
      <div className="atlas-heading">
        <div>
          <div className="section-kicker">VISUAL STUDY TOOL <span>{atlas.nodes.length} CONCEPTS</span></div>
          <h2>{atlas.title}</h2>
          <p>Select a concept to inspect the source passages behind it.</p>
        </div>
        <span className="atlas-badge">STUDY ATLAS</span>
      </div>

      <div className="atlas-scroll">
        <div className="atlas-canvas" style={{ height: `${canvasHeight}px` }}>
          <svg
            className="atlas-connectors"
            viewBox={`0 0 1200 ${canvasHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {atlas.nodes.map((node, index) => {
              const nodeCenterY = nodeTop(index) + 62;
              const controlX = 460;
              const midY = (rootY + nodeCenterY) / 2;
              return (
                <g key={node.id}>
                  <path d={`M 308 ${rootY} C ${controlX} ${rootY}, ${controlX} ${nodeCenterY}, 620 ${nodeCenterY}`} />
                  <text x="462" y={midY - 6} textAnchor="middle">{node.relationship}</text>
                </g>
              );
            })}
          </svg>

          <div className="atlas-root" style={{ top: `${rootY - 64}px` }}>
            <span>FOCUS</span>
            <strong>{atlas.title}</strong>
            <small>{evidence.filter((item) => item.accepted).length} supporting passages</small>
          </div>

          {atlas.nodes.map((node, index) => (
            <button
              className={selectedConceptId === node.id ? "atlas-node selected" : "atlas-node"}
              key={node.id}
              style={{ top: `${nodeTop(index)}px` }}
              onClick={() => onSelectConcept(selectedConceptId === node.id ? "" : node.id)}
              type="button"
              aria-pressed={selectedConceptId === node.id}
              aria-expanded={selectedConceptId === node.id}
              aria-controls="atlas-source-detail"
            >
              <span className="atlas-node-label">{node.label}</span>
              <span className="atlas-node-explanation">{node.explanation}</span>
              <span className="atlas-citations">
                {node.evidence_ids.map((id) => <span key={id}>[{id}]</span>)}
              </span>
              <span className="atlas-node-action">
                {selectedConceptId === node.id ? "Sources shown below · click to close" : "Click to inspect source ↘"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedConcept && (
        <div className="atlas-source-detail" id="atlas-source-detail" ref={sourceDetailRef}>
          <div className="section-kicker">SOURCE TRAIL <span>{linkedEvidence.length} PASSAGES</span></div>
          {linkedEvidence.map((item) => (
            <article className="atlas-source-card" key={item.id}>
              <div>
                <strong>{item.source || "Study source"}</strong>
                <small>
                  {item.section || "Passage"}
                  {item.page ? ` · Page ${item.page}` : ""}
                  {item.slide ? ` · Slide ${item.slide}` : ""}
                </small>
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default App;
