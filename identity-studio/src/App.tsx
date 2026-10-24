import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Camera as CameraIcon,
  Check,
  ChevronLeft,
  Download,
  ImagePlus,
  Layers,
  LockKeyhole,
  Plus,
  ScanFace,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import Camera from "./Camera";
import PhotoImage from "./PhotoImage";
import {
  shots,
  requiredShots,
  groupLabels,
  newSession,
  coverage,
  nextShot,
} from "./shots";
import { listSessions, saveSession, deleteSession, deleteAll } from "./storage";
import { analyze } from "./quality";
import { buildPack, download, presets } from "./export";
import type { Session, Photo, Group } from "./types";
export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [currentId, setCurrentId] = useState<string | null>(null),
    [view, setView] = useState<"home" | "capture" | "library" | "export">(
      "home",
    ),
    [shotId, setShotId] = useState("front-neutral"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [preset, setPreset] = useState("universal"),
    [selected, setSelected] = useState<string | null>(null),
    [confirm, setConfirm] = useState<"all" | "session" | null>(null);
  const importInput = useRef<HTMLInputElement>(null),
    working = useRef<Session | null>(null),
    mutation = useRef(false),
    pendingSave = useRef<Promise<void>>(Promise.resolve());
  const session = sessions.find((s) => s.id === currentId) ?? null;
  working.current = session;
  const shot = shots.find((s) => s.id === shotId)!;
  const progress = session
    ? coverage(session)
    : { complete: 0, total: 21, missing: [] };
  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() =>
        setError(
          "Local storage is unavailable. Enable browser storage and reload.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!selected && !confirm) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setConfirm(null);
      }
      if (event.key === "Tab") {
        const dialog = document.querySelector('[aria-modal="true"]');
        const items = dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [selected, confirm]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  async function commit(updated: Session) {
    await saveSession(updated);
    working.current = updated;
    setSessions((all) => [updated, ...all.filter((s) => s.id !== updated.id)]);
  }
  async function start() {
    if (mutation.current) return;
    mutation.current = true;
    try {
      const s = newSession();
      await commit(s);
      setCurrentId(s.id);
      setShotId(shots[0].id);
      setView("capture");
    } catch {
      setError("Could not create a session. Check available browser storage.");
    } finally {
      mutation.current = false;
    }
  }
  async function update(patch: Partial<Session>) {
    if (!working.current) return;
    const updated = {
      ...working.current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    working.current = updated;
    pendingSave.current = pendingSave.current
      .catch(() => {})
      .then(() => commit(updated));
    await pendingSave.current;
  }
  async function capture(photo: Photo) {
    if (!working.current || mutation.current) return;
    mutation.current = true;
    try {
      const s = {
        ...working.current,
        photos: { ...working.current.photos, [photo.shotId]: photo },
        skipped: working.current.skipped.filter((id) => id !== photo.shotId),
        updatedAt: new Date().toISOString(),
      };
      await commit(s);
      setNotice("Photo saved to this device");
      const next = nextShot(s, photo.shotId);
      if (next) setShotId(next);
      else setView("library");
    } catch {
      throw new Error(
        "Photo could not be saved. Storage may be full. Export existing photos before freeing space.",
      );
    } finally {
      mutation.current = false;
    }
  }
  async function skip() {
    if (!session) return;
    try {
      const s = {
        ...session,
        skipped: [...new Set([...session.skipped, shotId])],
        updatedAt: new Date().toISOString(),
      };
      await commit(s);
      const next = nextShot(s, shotId);
      if (next) setShotId(next);
      else setView("library");
    } catch {
      setError("Could not save skipped shot.");
    }
  }
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error(
          "Please choose a JPEG, PNG, or WebP image. Export HEIC photos as JPEG first.",
        );
      if (file.size > 40 * 1024 * 1024)
        throw new Error("Choose a photograph under 40 MB.");
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (bitmap.width * bitmap.height > 60_000_000) {
        bitmap.close();
        throw new Error("Choose a photograph under 60 megapixels.");
      }
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext("2d")!.drawImage(bitmap, 0, 0);
      bitmap.close();
      const p: Photo = {
        shotId,
        blob: file,
        width: c.width,
        height: c.height,
        source: "import",
        createdAt: new Date().toISOString(),
        quality: analyze(c, null, shot, Object.values(session?.photos ?? {})),
      };
      await capture(p);
      setView("library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import this photo.");
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }
  async function removePhoto(id: string) {
    if (!session) return;
    try {
      const photos = { ...session.photos };
      delete photos[id];
      await update({ photos });
      setSelected(null);
    } catch {
      setError("Could not remove photo.");
    }
  }
  async function erase() {
    setBusy(true);
    try {
      if (confirm === "all") {
        await deleteAll();
        setSessions([]);
      } else if (session) {
        await deleteSession(session.id);
        setSessions((s) => s.filter((x) => x.id !== session.id));
      }
      setCurrentId(null);
      setView("home");
      setConfirm(null);
    } catch {
      setError("Unable to delete local data. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function exportPack() {
    if (!session) return;
    setBusy(true);
    try {
      await pendingSave.current;
      const blob = await buildPack(working.current ?? session, preset);
      download(
        blob,
        `identity-pack-${preset}-${session.createdAt.slice(0, 10)}.zip`,
      );
      setNotice("Your reference pack is ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  function open(s: Session) {
    setCurrentId(s.id);
    setView("library");
    setSelected(null);
  }
  const icon = (
    <span className="brand-mark">
      <ScanFace size={25} />
    </span>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="brand"
          onClick={() => {
            setView("home");
            setSelected(null);
          }}
        >
          {icon}
          <span>
            identity<span className="brand-light"> studio</span>
            <small>REFERENCE CAPTURE SYSTEM</small>
          </span>
        </button>
        <div className="header-right">
          <span className="private-badge">
            <i /> LOCAL & PRIVATE
          </span>
          <span className="version">STUDIO / 01</span>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {view === "home" ? (
        <main className="home">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> YOUR NEXT CREATION STARTS WITH YOU
              </div>
              <h1>
                One identity.
                <br />
                <em>Every model.</em>
              </h1>
              <p className="hero-description">
                A personal reference studio, right in your browser. Capture your
                angles, build your identity pack, and bring yourself into your
                next AI creation.
              </p>
              <button
                className="primary start-button"
                onClick={() => void start()}
                disabled={loading}
              >
                Start Capture Session <ArrowUpRight size={20} />
              </button>
              <div className="hero-meta">
                <span>21 guided photographs</span>
                <i /> <span>About 10 minutes</span>
              </div>
              <div className="privacy-note">
                <LockKeyhole size={16} /> Your photos stay on your device.
                Always your call to share.
              </div>
            </div>
            <div
              className="hero-art"
              aria-label="Illustrated portrait framing guide"
            >
              <div className="art-grid" />
              <div className="art-top">
                <span>IDENTITY / 001</span>
                <span>FRONT NEUTRAL</span>
              </div>
              <svg
                viewBox="0 0 420 480"
                fill="none"
                role="img"
                aria-label="Abstract head and shoulder positioning illustration"
              >
                <defs>
                  <linearGradient
                    id="person"
                    x1="120"
                    y1="100"
                    x2="320"
                    y2="420"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#a8b6a2" />
                    <stop offset="1" stopColor="#425b4e" />
                  </linearGradient>
                </defs>
                <path
                  d="M63 480c4-89 33-125 101-141v-39c-30-22-46-63-46-106 0-74 35-112 92-112s92 38 92 112c0 43-16 84-46 106v39c68 16 97 52 101 141"
                  fill="url(#person)"
                />
                <path
                  d="M164 339c28 31 64 31 92 0M143 195c15-13 32-13 47-2m39 0c15-11 32-11 47 2m-66 5-10 43 18 4m-34 28c18 11 38 11 54-1"
                  stroke="#dce5d3"
                  strokeOpacity=".45"
                  strokeWidth="2"
                />
                <ellipse
                  cx="210"
                  cy="205"
                  rx="111"
                  ry="143"
                  stroke="#eff6df"
                  strokeOpacity=".7"
                  strokeDasharray="5 6"
                />
                <path
                  d="M65 140V75h65m160 0h65v65M65 280v65h65m160 0h65v-65"
                  stroke="#f4f6e9"
                  strokeWidth="2"
                />
                <path
                  d="M75 199h270M210 48v304"
                  stroke="#eef5df"
                  strokeOpacity=".25"
                  strokeDasharray="3 5"
                />
                <circle cx="166" cy="195" r="4" fill="#e5efcf" />
                <circle cx="252" cy="195" r="4" fill="#e5efcf" />
                <circle cx="210" cy="244" r="4" fill="#e5efcf" />
              </svg>
              <div className="art-caption">
                <span>
                  <i /> YOUR IDENTITY, IN FOCUS
                </span>
                <small>Illustrated guide · not a photograph</small>
              </div>
              <div className="floating-card">
                <ScanFace size={20} />
                <div>
                  Every angle. All you.
                  <small>Guided capture, natural results.</small>
                </div>
                <Check size={18} />
              </div>
            </div>
          </section>
          <div className="platform-strip">
            <span>CREATE REFERENCES FOR</span>
            <strong>Higgsfield</strong>
            <strong>Runway</strong>
            <strong>Kling</strong>
            <span>+ your next model</span>
          </div>
          <section className="how-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE PREPARATION. A BETTER REFERENCE.
                </span>
                <h2>Make room for your best light.</h2>
              </div>
              <span className="subtle">No studio required.</span>
            </div>
            <div className="prep-grid">
              <article>
                <span className="prep-icon">
                  <Sun />
                </span>
                <h3>Find soft light</h3>
                <p>
                  Face a window. Choose a neutral, light-colored wall and stand
                  away from it to avoid shadows.
                </p>
              </article>
              <article>
                <span className="prep-icon">
                  <CameraIcon />
                </span>
                <h3>Set the scene</h3>
                <p>
                  Keep the camera at eye level. For full-body shots, prop up
                  your phone and use the timer.
                </p>
              </article>
              <article>
                <span className="prep-icon">
                  <ScanFace />
                </span>
                <h3>Keep it naturally you</h3>
                <p>
                  Remove hats and unnecessary accessories. Keep your hair,
                  beard, and facial features visible.
                </p>
              </article>
            </div>
          </section>
          {sessions.length > 0 && (
            <section className="session-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">SAVED ON THIS DEVICE</span>
                  <h2>Your sessions</h2>
                </div>
                <button
                  className="text-button danger"
                  onClick={() => setConfirm("all")}
                >
                  <Trash2 size={15} /> Delete all data
                </button>
              </div>
              <div className="session-grid">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    className="session-card"
                    onClick={() => open(s)}
                  >
                    <span className="session-icon">
                      {s.photos["front-neutral"] ? (
                        <PhotoImage
                          blob={s.photos["front-neutral"].blob}
                          alt="Front portrait"
                        />
                      ) : (
                        <Layers />
                      )}
                    </span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {coverage(s).complete} / 21 references ·{" "}
                        {new Date(s.updatedAt).toLocaleDateString()}
                      </small>
                    </span>
                    <ArrowRight size={19} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        session && (
          <main className="workspace">
            <div className="workspace-heading">
              <button className="text-button" onClick={() => setView("home")}>
                <ChevronLeft size={16} /> All sessions
              </button>
              <span>
                <ShieldCheck size={15} /> Saved on this device
              </span>
            </div>
            <div className="session-title">
              <div>
                <span className="eyebrow">YOUR IDENTITY REFERENCE PACK</span>
                <h1>{session.name}</h1>
              </div>
              <div className="coverage">
                <strong>
                  {progress.complete}
                  <span> / {progress.total}</span>
                </strong>
                <small>essential shots captured</small>
              </div>
            </div>
            <nav className="tabs" aria-label="Session sections">
              {(["capture", "library", "export"] as const).map((tab, i) => (
                <button
                  key={tab}
                  className={view === tab ? "active" : ""}
                  onClick={() => {
                    setSelected(null);
                    setView(tab);
                  }}
                >
                  <span>0{i + 1}</span>
                  {tab === "capture"
                    ? "Capture"
                    : tab === "library"
                      ? "Reference library"
                      : "Export pack"}
                  {tab === "library" && (
                    <small>{Object.keys(session.photos).length}</small>
                  )}
                </button>
              ))}
            </nav>
            {view === "capture" && (
              <div className="capture-layout">
                <div>
                  <div className="shot-heading">
                    <div>
                      <span className="eyebrow">
                        {groupLabels[shot.group]} /{" "}
                        {String(shots.indexOf(shot) + 1).padStart(2, "0")}
                      </span>
                      <h2>{shot.label}</h2>
                      <p>{shot.instruction}</p>
                    </div>
                    <span className="shot-count">
                      {shots.indexOf(shot) + 1}
                      <span> / {shot.optional ? "25" : "21"}</span>
                    </span>
                  </div>
                  <Camera
                    key={session.id}
                    shot={shot}
                    photos={Object.values(session.photos)}
                    onCapture={capture}
                    onSkip={() => void skip()}
                    onError={setError}
                  />
                </div>
                <aside className="shot-sidebar">
                  <div className="sidebar-heading">
                    <h3>Your shot list</h3>
                    <span>{progress.complete}/21</span>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: `${(progress.complete / 21) * 100}%` }}
                    />
                  </div>
                  {(Object.keys(groupLabels) as Group[]).map((group) => (
                    <div className="shot-group" key={group}>
                      <h4>
                        {groupLabels[group]}{" "}
                        {group === "variants" && <small>OPTIONAL</small>}
                      </h4>
                      {shots
                        .filter((s) => s.group === group)
                        .map((s) => (
                          <button
                            key={s.id}
                            className={
                              "shot-row " + (s.id === shotId ? "selected" : "")
                            }
                            onClick={() => setShotId(s.id)}
                          >
                            <span
                              className={
                                "shot-dot " +
                                (session.photos[s.id] ? "done" : "")
                              }
                            >
                              {session.photos[s.id] ? (
                                <Check size={12} />
                              ) : s.id === shotId ? (
                                <i />
                              ) : null}
                            </span>
                            <span>{s.label}</span>
                            {session.skipped.includes(s.id) &&
                              !session.photos[s.id] && <small>Skipped</small>}
                          </button>
                        ))}
                    </div>
                  ))}
                  <div className="sidebar-note">
                    <LockKeyhole size={18} />
                    <p>
                      Only source photographs.
                      <br />
                      No filters. No face alterations.
                    </p>
                  </div>
                </aside>
              </div>
            )}
            {view === "library" && (
              <section className="library">
                <div className="section-heading">
                  <div>
                    <h2>Every angle of you.</h2>
                    <p className="subtle">
                      Review your source photos. Select an empty slot to capture
                      or import.
                    </p>
                  </div>
                  <button className="primary" onClick={() => setView("export")}>
                    Export pack <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="import-toolbar">
                  <ImagePlus size={20} />
                  <label htmlFor="import-shot">Assign photo to</label>
                  <select
                    id="import-shot"
                    value={shotId}
                    onChange={(e) => setShotId(e.target.value)}
                  >
                    {shots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                        {session.photos[s.id] ? " (replace)" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => importInput.current?.click()}
                    disabled={busy}
                  >
                    Import photograph
                  </button>
                  <input
                    ref={importInput}
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Import photograph file"
                    onChange={(e) => {
                      if (e.target.files?.[0])
                        void importFile(e.target.files[0]);
                    }}
                  />
                </div>
                <p className="fine-print">
                  Import replaces the selected slot and preserves the original
                  file. Facial checks are unavailable for imports; review them
                  yourself.
                </p>
                {(Object.keys(groupLabels) as Group[]).map((group) => (
                  <div className="gallery-section" key={group}>
                    <div className="gallery-heading">
                      <h3>{groupLabels[group]}</h3>
                      <span>
                        {
                          shots.filter(
                            (s) => s.group === group && session.photos[s.id],
                          ).length
                        }{" "}
                        / {shots.filter((s) => s.group === group).length}
                        {group === "variants" ? " · optional" : ""}
                      </span>
                    </div>
                    <div className="photo-grid">
                      {shots
                        .filter((s) => s.group === group)
                        .map((s) => {
                          const photo = session.photos[s.id];
                          return (
                            <button
                              aria-label={
                                photo
                                  ? `Review ${s.label}`
                                  : `Capture ${s.label}`
                              }
                              className={
                                "photo-card " + (!photo ? "empty" : "")
                              }
                              key={s.id}
                              onClick={() => {
                                setShotId(s.id);
                                if (photo) setSelected(s.id);
                                else setView("capture");
                              }}
                            >
                              {photo ? (
                                <>
                                  <PhotoImage blob={photo.blob} alt={s.label} />
                                  <span
                                    className={
                                      "photo-status " +
                                      (photo.quality.warnings.length
                                        ? "review"
                                        : "")
                                    }
                                  >
                                    {photo.quality.warnings.length
                                      ? "Review"
                                      : "Captured"}
                                  </span>
                                </>
                              ) : (
                                <div className="empty-photo">
                                  <Plus size={25} />
                                  <span>
                                    {session.skipped.includes(s.id)
                                      ? "Skipped"
                                      : "Not captured"}
                                  </span>
                                </div>
                              )}
                              <span className="photo-caption">
                                {s.label}
                                <ArrowUpRight size={14} />
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </section>
            )}
            {view === "export" && (
              <section className="export-layout">
                <div>
                  <span className="eyebrow">READY FOR YOUR NEXT CREATION</span>
                  <h2>Your identity. Ready to go.</h2>
                  <p className="subtle">
                    Source photographs, organized folders, a detailed manifest,
                    and adaptable prompts. Everything in one portable ZIP.
                  </p>
                  <div className="preset-list">
                    {presets.map((p) => (
                      <label
                        key={p.id}
                        className={
                          "preset " + (preset === p.id ? "chosen" : "")
                        }
                      >
                        <input
                          type="radio"
                          name="preset"
                          checked={preset === p.id}
                          onChange={() => setPreset(p.id)}
                        />
                        <span>
                          <strong>{p.label}</strong>
                          <small>{p.description}</small>
                        </span>
                        <span className="preset-count">
                          {
                            Object.keys(session.photos).filter(
                              (id) => !p.ids || p.ids.includes(id),
                            ).length
                          }{" "}
                          photos
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="fine-print">
                    Provider presets are suggested selections, not verified
                    platform requirements. Check the model’s current reference
                    limits before uploading.
                  </p>
                  <button
                    className="primary export-button"
                    disabled={
                      busy ||
                      Object.keys(session.photos).filter(
                        (id) =>
                          !presets.find((p) => p.id === preset)!.ids ||
                          presets
                            .find((p) => p.id === preset)!
                            .ids!.includes(id),
                      ).length === 0
                    }
                    onClick={() => void exportPack()}
                  >
                    <Download size={19} />
                    {busy ? "Preparing pack…" : "Download reference pack"}
                  </button>
                </div>
                <aside className="export-details">
                  <h3>Make it yours</h3>
                  <label>
                    Session name
                    <input
                      aria-label="Session name"
                      defaultValue={session.name}
                      key={session.id}
                      maxLength={100}
                      onBlur={(e) =>
                        void update({
                          name: e.target.value.trim() || "Untitled identity",
                        }).catch(() => setError("Could not save name."))
                      }
                    />
                  </label>
                  <label>
                    Identity notes <span>optional</span>
                    <textarea
                      defaultValue={session.details}
                      placeholder="Describe visible features you want to keep consistent…"
                      maxLength={4000}
                      onBlur={(e) =>
                        void update({ details: e.target.value }).catch(() =>
                          setError("Could not save notes."),
                        )
                      }
                    />
                  </label>
                  <div className="coverage-summary">
                    <h4>Coverage check</h4>
                    <p>{progress.complete} of 21 essential shots captured</p>
                    <div className="progress-track">
                      <div
                        style={{ width: `${(progress.complete / 21) * 100}%` }}
                      />
                    </div>
                    <small>
                      {progress.missing.length
                        ? `${progress.missing.length} missing shots. Partial packs are allowed.`
                        : "Your essential shot list is complete."}
                    </small>
                    <p>
                      {
                        Object.values(session.photos).filter(
                          (p) => p.quality.warnings.length,
                        ).length
                      }{" "}
                      photographs flagged for review.
                    </p>
                  </div>
                  <button
                    className="text-button danger"
                    onClick={() => setConfirm("session")}
                  >
                    <Trash2 size={16} /> Delete session
                  </button>
                </aside>
              </section>
            )}
          </main>
        )
      )}
      <footer>
        <span>
          identity studio{" "}
          <span className="subtle">/ One identity. Every model.</span>
        </span>
        <span>
          <LockKeyhole size={13} /> On-device processing. No automatic uploads.
        </span>
      </footer>
      {selected && session?.photos[selected] && (
        <div className="modal-backdrop">
          <section
            className="photo-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review photograph"
          >
            <button
              className="modal-close"
              aria-label="Close photograph"
              autoFocus
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <PhotoImage
              blob={session.photos[selected].blob}
              alt={shots.find((s) => s.id === selected)!.label}
            />
            <div className="photo-info">
              <span className="eyebrow">
                SOURCE PHOTOGRAPH · {session.photos[selected].source}
              </span>
              <h2>{shots.find((s) => s.id === selected)!.label}</h2>
              <p>
                {session.photos[selected].width} ×{" "}
                {session.photos[selected].height} pixels
              </p>
              <h3>Quality notes</h3>
              {session.photos[selected].quality.warnings.length ? (
                <ul>
                  {session.photos[selected].quality.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No basic image warnings. Review appearance and framing
                  yourself.
                </p>
              )}
              <p className="fine-print">
                Obstructions, expression accuracy, and body pose are not
                assessed. Face data:{" "}
                {session.photos[selected].quality.vision
                  ? "estimated"
                  : "unavailable"}
                .
              </p>
              <div className="modal-actions">
                <button
                  className="primary"
                  onClick={() => {
                    setShotId(selected);
                    setSelected(null);
                    setView("capture");
                  }}
                >
                  Retake photo
                </button>
                <button
                  onClick={() => {
                    setShotId(selected);
                    setSelected(null);
                    setTimeout(() => importInput.current?.click(), 0);
                  }}
                >
                  Replace from library
                </button>
                <button
                  className="text-button danger"
                  onClick={() => void removePhoto(selected)}
                >
                  <Trash2 size={17} /> Remove
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <Trash2 />
            <h2 id="delete-title">
              Delete {confirm === "all" ? "all local sessions" : "this session"}
              ?
            </h2>
            <p>
              Photographs and notes will be permanently removed from this
              browser. Download a pack first if you want to keep them.
            </p>
            <div>
              <button autoFocus onClick={() => setConfirm(null)}>
                Keep my photos
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void erase()}
              >
                Delete permanently
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
