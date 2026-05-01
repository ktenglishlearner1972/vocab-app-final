import React, { useState, useEffect } from "react";

/* =========================================================
   1. Logic & Helpers
   ========================================================= */

/**
 * 配列をランダムにシャッフルする (Fisher-Yates)
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 苦手な単語（ミス回数が多いもの）を重み付けして抽出
 */
function buildWeakPool(entries, mistakes) {
  const pool = [];
  for (const e of entries) {
    const count = mistakes[e.word] || 0;
    if (count > 0) {
      const weight = Math.min(5, count);
      for (let i = 0; i < weight; i++) {
        pool.push(e);
      }
    }
  }
  return shuffle(pool);
}

/**
 * CSVの1行をパースする
 */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, ""));
}

/**
 * **太字** 構文を React 要素に変換
 */
function renderWithBold(text) {
  if (!text) return "";
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: "800", color: "#000" }}>{p}</strong> : p
  );
}

/* =========================================================
   2. UI Styles
   ========================================================= */

const btnBase = {
  width: "240px",
  height: "52px",
  border: "1px solid #333",
  borderRadius: "12px",
  background: "white",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "10px auto",
  fontSize: "16px",
  fontWeight: "500",
  fontFamily: "sans-serif",
  boxSizing: "border-box",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
};

const cardStyle = {
  border: "2px solid #333",
  borderRadius: 24,
  padding: "40px 24px",
  minHeight: "300px",
  marginTop: "20px",
  cursor: "pointer",
  userSelect: "none",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  backgroundColor: "#ffffff",
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  WebkitTapHighlightColor: "transparent",
  transition: "transform 0.1s active"
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10000,
  backdropFilter: "blur(4px)",
  padding: "20px"
};

const modalContent = {
  width: "100%",
  maxWidth: "360px",
  maxHeight: "85vh",
  background: "#fff",
  borderRadius: "20px",
  padding: "36px 24px",
  textAlign: "center",
  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
  overflowY: "auto",
  position: "relative"
};

const textareaStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "10px",
  border: "1px solid #ddd",
  boxSizing: "border-box",
  fontSize: "16px",
  minHeight: "90px",
  fontFamily: "inherit",
  lineHeight: "1.6",
  backgroundColor: "#f9f9f9",
  outline: "none"
};

/* =========================================================
   3. Main Application Component
   ========================================================= */

export default function App() {
  // --- Persistent States ---
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem("entries");
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [mistakes, setMistakes] = useState(() => {
    try {
      const saved = localStorage.getItem("mistakes");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [mistakeLog, setMistakeLog] = useState(() => {
    try {
      const saved = localStorage.getItem("mistakeLog");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [priorityWords, setPriorityWords] = useState(() => {
    try {
      const saved = localStorage.getItem("priorityWords");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  // --- Operational States ---
  const [screen, setScreen] = useState("home");
  const [reviewRange, setReviewRange] = useState("today");
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); 
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1); // ページネーション用

  // --- Modal & Edit States ---
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearMistake, setConfirmClearMistake] = useState(false);
  const [confirmFileDelete, setConfirmFileDelete] = useState(false);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ meaning: "", sentence: "", sentence_jp: "" });
  const [isListening, setIsListening] = useState(null);

  // --- Selection States ---
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [selectedTestFiles, setSelectedTestFiles] = useState([]); 

  // --- Persistence Effects ---
  useEffect(() => { localStorage.setItem("entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("mistakes", JSON.stringify(mistakes)); }, [mistakes]);
  useEffect(() => { localStorage.setItem("mistakeLog", JSON.stringify(mistakeLog)); }, [mistakeLog]);
  useEffect(() => { localStorage.setItem("priorityWords", JSON.stringify(priorityWords)); }, [priorityWords]);

  const fileList = [...new Set(entries.map(e => e.source).filter(Boolean))];
  const isAllSelected = fileList.length > 0 && (selectedTestFiles.length === fileList.length || selectedTestFiles.length === 0);
  const current = pool[index];

  // --- Speech & Input Handlers ---
  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = "en-US";
    uttr.rate = 0.9;
    window.speechSynthesis.speak(uttr);
  };

  const startListening = (field, lang = "ja-JP") => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("ご使用のブラウザは音声入力に対応していません。");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    try {
      recognition.start();
      setIsListening(field);
    } catch (e) {
      console.error(e);
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setEditData(prev => ({ ...prev, [field]: prev[field] + transcript }));
      }
      recognition.stop();
    };
    recognition.onend = () => setIsListening(null);
    recognition.onerror = () => setIsListening(null);
  };

  // --- Test Sequence Control ---
  const startTest = (mode) => {
    let baseEntries = entries;
    if (!isAllSelected) {
      baseEntries = entries.filter(e => selectedTestFiles.includes(e.source));
    }
    if (baseEntries.length === 0) {
      alert("単語が登録されていません。");
      return;
    }
    let p = [];
    if (mode === "all") { p = shuffle([...baseEntries]); }
    else if (mode === "weak") { p = buildWeakPool(baseEntries, mistakes); }
    else if (mode === "priority") { p = shuffle(baseEntries.filter(e => priorityWords[e.word])); }
    else if (mode === "review") {
      const now = new Date();
      const start = new Date(now);
      if (reviewRange === "today") { start.setHours(0, 0, 0, 0); }
      else if (reviewRange === "yesterday") {
        start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() - 1); now.setHours(23, 59, 59, 999);
      } else { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
      p = shuffle(entries.filter(e => {
        const logs = mistakeLog[e.word] || [];
        return logs.some(t => { const d = new Date(t); return d >= start && d <= now; });
      }));
    }
    if (p.length === 0) {
      alert("条件に該当する単語がありません。");
      return;
    }
    setPool(p); setIndex(0); setStep(0); setHistory([]); setScreen("test");
  };

  const handleNext = () => {
    if (index >= pool.length - 1) { setScreen("home"); }
    else { setHistory([...history, index]); setIndex(index + 1); setStep(0); }
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const prevIndex = newHistory.pop();
    setHistory(newHistory); setIndex(prevIndex); setStep(0);
  };

  const handleWrong = () => {
    if (!current) return;
    const now = Date.now();
    setMistakes(prev => ({ ...prev, [current.word]: (prev[current.word] || 0) + 1 }));
    setMistakeLog(prev => ({ ...prev, [current.word]: [...(prev[current.word] || []), now] }));
    handleNext();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      const lines = content.split(/\r?\n/).filter(l => l.trim() !== "");
      const newEntries = lines.map(line => {
        const [word, meaning, sentence, sentence_jp] = parseCSVLine(line);
        return { word, meaning, sentence, sentence_jp, source: file.name };
      });
      setEntries(prev => {
        const map = new Map();
        [...prev, ...newEntries].forEach(item => map.set(item.word, item));
        return [...map.values()];
      });
    };
    reader.readAsText(file);
    e.target.value = ""; 
  };

/* =========================================================
   4. Screens: Rendering
   ========================================================= */

  // --- 1. HOME SCREEN ---
  if (screen === "home") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "10px" }}>英単語マスター</h1>
        <p style={{ color: "#777", marginBottom: "40px" }}>現在の総単語数: <span style={{ color: "#333", fontWeight: "bold" }}>{entries.length}</span> 語</p>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", color: "#555", marginBottom: "15px", letterSpacing: "0.1em" }}>－ LEARNING －</h2>
          <button style={btnBase} onClick={() => setScreen("fileSelectModal")}>テスト対象ファイルを選択</button>
          <div style={{ fontSize: "13px", color: "#999", marginBottom: "20px", height: "20px" }}>
            {isAllSelected ? "（すべてのファイルから出題）" : `（選択済み: ${selectedTestFiles.length} ファイル）`}
          </div>
          <button style={{ ...btnBase, background: "#f8f9fa" }} onClick={() => startTest("all")}>ランダムにテスト</button>
          <button style={btnBase} onClick={() => startTest("weak")}>苦手な単語を重点学習</button>
          <button style={btnBase} onClick={() => startTest("priority")}>★ 最優先課題のみ</button>
          <button style={btnBase} onClick={() => setScreen("reviewSelect")}>ミスした単語の復習</button>
        </section>

        <section style={{ marginTop: "50px", borderTop: "1px solid #eee", paddingTop: "30px" }}>
          <h2 style={{ fontSize: "18px", color: "#555", marginBottom: "15px", letterSpacing: "0.1em" }}>－ MANAGEMENT －</h2>
          <button style={btnBase} onClick={() => { setCurrentPage(1); setScreen("ranking"); }}>苦手ランキング</button>
          <div style={{ ...btnBase, position: "relative", backgroundColor: "#fff" }}>
            CSVファイルを追加
            <input type="file" accept=".csv" onChange={onFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
          </div>
          <button style={{ ...btnBase, color: "#e53935", borderColor: "#e53935" }} onClick={() => setScreen("fileDelete")}>ファイルを指定して削除</button>
        </section>
      </div>
    );
  }

  // --- 2. TEST SCREEN ---
  if (screen === "test") {
    return (
      <div style={{ textAlign: "center", padding: "20px", maxWidth: "500px", margin: "0 auto", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <button style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "14px" }} onClick={() => setScreen("home")}>［ホームへ］</button>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#666" }}><span style={{ color: "#333" }}>{index + 1}</span> / {pool.length}</div>
        </div>

        <div onClick={() => setStep(s => Math.min(s + 1, 2))} style={cardStyle}>
          <div style={{ position: "absolute", top: "15px", left: "15px", padding: "12px", fontSize: "24px", cursor: "pointer", opacity: 0.3 }} onClick={(e) => { e.stopPropagation(); setShowEditMenu(true); }}>⋮</div>
          <h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: 0, fontSize: "36px", fontWeight: "700" }}>
            {current?.word}
            <span style={{ cursor: "pointer", marginLeft: "20px", fontSize: "30px", filter: "grayscale(1)" }} onClick={(e) => { e.stopPropagation(); speak(current.word); }}>🔊</span>
          </h2>
          <div style={{ height: "30px" }}></div>
          {step >= 1 && <div style={{ fontSize: "19px", margin: "10px 0", color: "#444", lineHeight: "1.7" }}>{renderWithBold(current.sentence)}</div>}
          {step === 2 && (
            <div style={{ marginTop: "25px", borderTop: "2px solid #f0f0f0", paddingTop: "25px" }}>
              <div style={{ fontWeight: "bold", fontSize: "24px", color: "#d32f2f", marginBottom: "10px" }}>{current.meaning}</div>
              <div style={{ fontSize: "17px", color: "#777", lineHeight: "1.5" }}>{current.sentence_jp}</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginBottom: "15px" }}>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#f1f3f5", border: "none" }} onClick={handleBack} disabled={history.length === 0}>戻る</button>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#333", color: "#fff", border: "none" }} onClick={handleNext}>次へ</button>
          </div>
          <button style={{ ...btnBase, background: "#fff5f5", borderColor: "#ff4d4d", color: "#ff4d4d", fontWeight: "bold", height: "60px", fontSize: "18px" }} onClick={handleWrong}>間違えた</button>
          <div style={{ margin: "30px 0" }}>
            <button style={{ ...btnBase, border: "1px solid #ddd" }} onClick={() => setPriorityWords(prev => {
              const copy = { ...prev };
              if (copy[current.word]) delete copy[current.word]; else copy[current.word] = true;
              return copy;
            })}>{priorityWords[current?.word] ? "★ 最優先から外す" : "☆ 最優先課題に指定"}</button>
            <button style={{ ...btnBase, border: "none", color: "#888", fontSize: "14px", textDecoration: "underline" }} onClick={() => setConfirmClearMistake(true)}>この単語のミス記録をリセット</button>
            <button style={{ ...btnBase, border: "none", color: "#ccc", fontSize: "13px", marginTop: "20px" }} onClick={() => setConfirmDelete(true)}>この単語をリストから完全に削除</button>
          </div>
        </div>

        {/* Edit Context Menu */}
        {showEditMenu && (
          <div style={modalOverlay} onClick={() => setShowEditMenu(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: "20px", marginBottom: "10px" }}>単語の設定</h3>
              <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "30px" }}>Source: {current?.source}</p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => { setEditData({ ...current }); setIsEditing(true); }}>✎ 登録内容を編集</button>
              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "10px" }} onClick={() => setShowEditMenu(false)}>閉じる</button>
            </div>
          </div>
        )}

        {/* Data Editing Modal */}
        {isEditing && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ marginBottom: "25px" }}>内容の修正</h3>
              {[{ id: "meaning", label: "意味 (日本語)", lang: "ja-JP" }, { id: "sentence", label: "例文 (英語)", lang: "en-US" }, { id: "sentence_jp", label: "例文の訳", lang: "ja-JP" }].map(item => (
                <div key={item.id} style={{ textAlign: "left", marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px", color: "#555" }}>
                    {item.label}
                    <span onClick={() => startListening(item.id, item.lang)} style={{ marginLeft: "15px", color: isListening === item.id ? "#f44336" : "#2196f3", cursor: "pointer", fontSize: "12px", border: "1px solid", padding: "2px 6px", borderRadius: "4px" }}>
                      {isListening === item.id ? "● 録音中..." : "🎤 音声入力"}
                    </span>
                  </label>
                  <textarea style={textareaStyle} value={editData[item.id]} onChange={e => setEditData({ ...editData, [item.id]: e.target.value })} />
                </div>
              ))}
              <div style={{ marginTop: "30px" }}>
                <button style={{ ...btnBase, width: "100%", background: "#4caf50", color: "#fff", border: "none" }} onClick={() => setConfirmSaveEdit(true)}>変更を保存</button>
                <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setIsEditing(false)}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* Save Confirmation */}
        {confirmSaveEdit && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontSize: "18px", fontWeight: "600", marginBottom: "30px" }}>編集した内容を保存してもよろしいですか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => {
                const updated = entries.map(e => e.word === current.word ? { ...e, ...editData } : e);
                setEntries(updated); setPool(pool.map(e => e.word === current.word ? { ...e, ...editData } : e));
                setConfirmSaveEdit(false); setIsEditing(false); setShowEditMenu(false);
              }}>保存する</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmSaveEdit(false)}>戻る</button>
            </div>
          </div>
        )}

        {/* Clear Mistake Confirmation */}
        {confirmClearMistake && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px" }}>ミス履歴のリセット</p>
              <button style={{ ...btnBase, width: "100%", background: "#e53935", color: "#fff", border: "none" }} onClick={() => {
                setMistakes(prev => ({ ...prev, [current.word]: 0 })); setConfirmClearMistake(false);
              }}>リセットする</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmClearMistake(false)}>キャンセル</button>
            </div>
          </div>
        )}

        {/* Word Deletion Confirmation */}
        {confirmDelete && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#d32f2f", marginBottom: "15px" }}>単語の完全削除</p>
              <button style={{ ...btnBase, width: "100%", background: "#d32f2f", color: "#fff", border: "none" }} onClick={() => {
                setEntries(prev => prev.filter(e => e.word !== current.word));
                setConfirmDelete(false); handleNext();
              }}>削除を実行する</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmDelete(false)}>キャンセル</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 3. FILE SELECTION MODAL ---
  if (screen === "fileSelectModal") {
    return (
      <div style={modalOverlay}>
        <div style={modalContent}>
          <h3 style={{ fontSize: "20px", marginBottom: "20px" }}>テスト対象ファイル</h3>
          <div style={{ textAlign: "left", margin: "10px 0", borderTop: "1px solid #eee" }}>
            <label style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}>
              <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? setSelectedTestFiles([]) : setSelectedTestFiles([...fileList])} style={{ width: "20px", height: "20px", marginRight: "12px" }} />
              <span style={{ fontWeight: "700" }}>すべてのファイル</span>
            </label>
            {fileList.map(file => (
              <label key={file} style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                <input type="checkbox" checked={selectedTestFiles.includes(file)} onChange={() => setSelectedTestFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} style={{ width: "18px", height: "18px", marginRight: "12px" }} />
                <span style={{ fontSize: "15px" }}>{file}</span>
              </label>
            ))}
          </div>
          <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff", marginTop: "30px" }} onClick={() => setScreen("home")}>この設定で戻る</button>
        </div>
      </div>
    );
  }

  // --- 4. REVIEW SELECTION ---
  if (screen === "reviewSelect") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: "8px" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h3 style={{ fontSize: "22px", marginBottom: "40px" }}>復習するタイミングを選択</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "50px" }}>
          {["today", "yesterday", "week"].map(val => (
            <label key={val} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", border: "1px solid #ddd", borderRadius: "15px", cursor: "pointer", background: reviewRange === val ? "#f0f7ff" : "white", borderColor: reviewRange === val ? "#2196f3" : "#ddd" }}>
              <input type="radio" checked={reviewRange === val} onChange={() => setReviewRange(val)} style={{ width: "20px", height: "20px", marginRight: "15px" }} />
              <span style={{ fontSize: "18px", fontWeight: "600" }}>{val === "today" ? "今日 間違えた単語" : val === "yesterday" ? "昨日 間違えた単語" : "過去1週間のミス単語"}</span>
            </label>
          ))}
        </div>
        <button style={{ ...btnBase, background: "#333", color: "#fff", height: "60px", fontSize: "18px" }} onClick={() => startTest("review")}>復習テストを開始</button>
      </div>
    );
  }

  // --- 5. RANKING SCREEN ---
  if (screen === "ranking") {
    const allRanking = entries
      .map(e => ({ ...e, count: mistakes[e.word] || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);

    const itemsPerPage = 20;
    const maxPage = Math.ceil(allRanking.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPageData = allRanking.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>
          <button style={{ marginBottom: "30px", padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: "8px", cursor: "pointer" }} onClick={() => setScreen("home")}>← ホームへ</button>
          <h3 style={{ fontSize: "24px", marginBottom: "10px" }}>苦手単語ランキング</h3>
          <p style={{ fontSize: "13px", color: "#999", marginBottom: "30px" }}>
            全 {allRanking.length} 単語中 {startIndex + 1} ～ {Math.min(startIndex + itemsPerPage, allRanking.length)} 件目
          </p>
          <div style={{ textAlign: "left" }}>
            {allRanking.length === 0 && <p style={{ textAlign: "center", color: "#999", marginTop: "50px" }}>データがありません。</p>}
            {currentPageData.map((e, i) => (
              <div key={e.word} style={{ padding: "20px 10px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "17px", fontWeight: "bold" }}><span style={{ color: "#aaa", fontSize: "14px", marginRight: "8px", fontWeight: "400" }}>{startIndex + i + 1}.</span>{e.word}</div>
                  <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>{e.meaning}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "20px", fontWeight: "800", color: "#d32f2f" }}>{e.count}</span>
                  <span style={{ fontSize: "12px", color: "#d32f2f", marginLeft: "4px" }}>miss</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {allRanking.length > itemsPerPage && (
          <div style={{ marginTop: "40px", padding: "20px 0", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} style={{ ...btnBase, width: "44px", height: "36px", margin: 0, fontSize: "12px", opacity: currentPage === 1 ? 0.3 : 1 }}>≪</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} style={{ ...btnBase, width: "44px", height: "36px", margin: 0, fontSize: "12px", opacity: currentPage === 1 ? 0.3 : 1 }}>＜</button>
            <div style={{ margin: "0 15px", fontSize: "14px", color: "#666", fontWeight: "600" }}>{currentPage} / {maxPage}</div>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(prev => prev + 1)} style={{ ...btnBase, width: "44px", height: "36px", margin: 0, fontSize: "12px", opacity: currentPage === maxPage ? 0.3 : 1 }}>＞</button>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(maxPage)} style={{ ...btnBase, width: "44px", height: "36px", margin: 0, fontSize: "12px", opacity: currentPage === maxPage ? 0.3 : 1 }}>≫</button>
          </div>
        )}
      </div>
    );
  }

  // --- 6. FILE DELETE SCREEN ---
  if (screen === "fileDelete") {
    return (
      <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: "8px" }} onClick={() => setScreen("home")}>← ホームへ</button>
        <h3 style={{ marginBottom: "30px" }}>削除するファイルを選択</h3>
        <div style={{ textAlign: "left", marginBottom: "40px" }}>
          {fileList.length === 0 && <p style={{ textAlign: "center", color: "#999" }}>登録済みのファイルはありません。</p>}
          {fileList.map(file => (
            <label key={file} style={{ display: "flex", alignItems: "center", padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
              <input type="checkbox" checked={selectedFiles.includes(file)} onChange={() => setSelectedFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} style={{ width: "20px", height: "20px", marginRight: "15px" }} />
              <span style={{ fontSize: "16px" }}>{file}</span>
            </label>
          ))}
        </div>
        {selectedFiles.length > 0 && <button style={{ ...btnBase, background: "#d32f2f", color: "white", border: "none", height: "60px" }} onClick={() => setConfirmFileDelete(true)}>選択した {selectedFiles.length} 件を削除</button>}
        {confirmFileDelete && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#d32f2f", marginBottom: "15px" }}>ファイルの削除確認</p>
              <button style={{ ...btnBase, width: "100%", background: "#d32f2f", color: "#fff", border: "none" }} onClick={() => {
                setEntries(prev => prev.filter(e => !selectedFiles.includes(e.source)));
                setSelectedFiles([]); setConfirmFileDelete(false); setScreen("home");
              }}>はい、削除を実行する</button>
              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "10px" }} onClick={() => setConfirmFileDelete(false)}>キャンセル</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}