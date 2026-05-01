import React, { useState, useEffect, useRef } from "react";

/* =========================================================
   1. Logic & Helpers (完全維持)
   ========================================================= */

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

function renderWithBold(text) {
  if (!text) return "";
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ fontWeight: "800", color: "#000" }}>
        {p}
      </strong>
    ) : (
      p
    )
  );
}

/* =========================================================
   2. UI Styles (UX/UIの完全維持)
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
  minHeight: "420px",
  marginTop: "20px",
  cursor: "pointer",
  userSelect: "none",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  backgroundColor: "#ffffff",
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
  WebkitTapHighlightColor: "transparent"
};

const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
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
  const [entries, setEntries] = useState(() => {
    try {
      const saved = localStorage.getItem("entries");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [mistakes, setMistakes] = useState(() => {
    try {
      const saved = localStorage.getItem("mistakes");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [mistakeLog, setMistakeLog] = useState(() => {
    try {
      const saved = localStorage.getItem("mistakeLog");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [priorityWords, setPriorityWords] = useState(() => {
    try {
      const saved = localStorage.getItem("priorityWords");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [screen, setScreen] = useState("home");
  const [reviewRange, setReviewRange] = useState("today");
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); 
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [selectedTestFiles, setSelectedTestFiles] = useState([]); 

  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    meaning: "",
    sentence: "",
    sentence_jp: ""
  });
  const [isListening, setIsListening] = useState(null);

  // Confirmation States (完全復元)
  const [confirmDeleteWord, setConfirmDeleteWord] = useState(false);
  const [confirmClearMistake, setConfirmClearMistake] = useState(false);
  const [confirmFileDelete, setConfirmFileDelete] = useState(false);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);

  useEffect(() => {
    localStorage.setItem("entries", JSON.stringify(entries));
  }, [entries]);
  useEffect(() => {
    localStorage.setItem("mistakes", JSON.stringify(mistakes));
  }, [mistakes]);
  useEffect(() => {
    localStorage.setItem("mistakeLog", JSON.stringify(mistakeLog));
  }, [mistakeLog]);
  useEffect(() => {
    localStorage.setItem("priorityWords", JSON.stringify(priorityWords));
  }, [priorityWords]);

  const fileList = [...new Set(entries.map(e => e.source).filter(Boolean))];
  const isAllSelected = fileList.length > 0 && (selectedTestFiles.length === fileList.length || selectedTestFiles.length === 0);
  
  const current = pool[index];

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
    if (!SpeechRecognition) return alert("非対応です。");
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.start();
    setIsListening(field);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setEditData(prev => ({ ...prev, [field]: prev[field] + transcript }));
      }
    };
    recognition.onend = () => setIsListening(null);
  };

  const startTest = (mode) => {
    let base = entries;
    if (!isAllSelected) {
      base = entries.filter(e => selectedTestFiles.includes(e.source));
    }
    if (base.length === 0) {
      alert("単語がありません。");
      return;
    }

    let p = [];
    if (mode === "all") {
      p = shuffle([...base]);
    } else if (mode === "weak") {
      p = buildWeakPool(base, mistakes);
    } else if (mode === "priority") {
      p = shuffle(base.filter(e => priorityWords[e.word]));
    } else if (mode === "review") {
      const now = new Date();
      const start = new Date(now);
      if (reviewRange === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (reviewRange === "yesterday") {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() - 1);
        now.setHours(23, 59, 59, 999);
      } else if (reviewRange === "week") {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      }
      p = shuffle(entries.filter(e => {
        const logs = mistakeLog[e.word] || [];
        return logs.some(timestamp => {
          const d = new Date(timestamp);
          return d >= start && d <= now;
        });
      }));
    }

    if (p.length === 0) {
      alert("該当なし");
      return;
    }
    setPool(p);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setScreen("test");
  };

  const handleNext = () => {
    if (index >= pool.length - 1) {
      setScreen("home");
    } else {
      setHistory([...history, index]);
      setIndex(index + 1);
      setStep(0);
    }
  };

  const handleWrong = () => {
    const word = current.word;
    const now = new Date().toISOString();
    setMistakes(prev => ({ ...prev, [word]: (prev[word] || 0) + 1 }));
    setMistakeLog(prev => ({ ...prev, [word]: [...(prev[word] || []), now] }));
    handleNext();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      const newEntries = lines.map(line => {
        const [word, meaning, sentence, sentence_jp] = parseCSVLine(line);
        return { word, meaning, sentence, sentence_jp, source: file.name };
      });
      setEntries(prev => {
        const map = new Map();
        prev.forEach(item => map.set(item.word, item));
        newEntries.forEach(item => map.set(item.word, item));
        return [...map.values()];
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* =========================================================
     4. Render Screens (UIの復元)
     ========================================================= */

  if (screen === "home") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "10px" }}>英単語マスター</h1>
        <p style={{ color: "#777", marginBottom: "40px" }}>現在の総単語数: <span style={{ color: "#333", fontWeight: "bold" }}>{entries.length}</span> 語</p>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "18px", color: "#555", marginBottom: "15px" }}>－ LEARNING －</h2>
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
          <h2 style={{ fontSize: "18px", color: "#555", marginBottom: "15px" }}>－ MANAGEMENT －</h2>
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

  if (screen === "test") {
    return (
      <div style={{ textAlign: "center", padding: "20px", maxWidth: "500px", margin: "0 auto", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <button style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "14px" }} onClick={() => setScreen("home")}>［ホームへ］</button>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#666" }}>{index + 1} / {pool.length}</div>
        </div>

        <div onClick={() => setStep(s => Math.min(s + 1, 2))} style={cardStyle}>
          <div style={{ position: "absolute", top: "15px", left: "15px", padding: "12px", fontSize: "24px", cursor: "pointer", opacity: 0.3 }} onClick={(e) => { e.stopPropagation(); setShowEditMenu(true); }}>⋮</div>
          
          {/* Word (位置固定) */}
          <div style={{ margin: "10px 0 10px 0" }}>
            <h2 style={{ fontSize: "36px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {current?.word}
              <span style={{ cursor: "pointer", marginLeft: "20px", fontSize: "30px", filter: "grayscale(1)" }} onClick={(e) => { e.stopPropagation(); speak(current.word); }}>🔊</span>
            </h2>
          </div>

          {/* Sentence (行間調整) */}
          <div style={{ minHeight: "60px", width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: "10px" }}>
            {step >= 1 && (
              <div style={{ fontSize: "19px", color: "#444", lineHeight: "1.5" }}>
                {renderWithBold(current.sentence)}
              </div>
            )}
          </div>

          {/* Meaning (行間を統一) */}
          <div style={{ width: "100%", marginTop: "10px" }}>
            {step === 2 && (
              <div style={{ borderTop: "2px solid #f0f0f0", paddingTop: "20px" }}>
                <div style={{ fontWeight: "bold", fontSize: "24px", color: "#d32f2f", marginBottom: "10px" }}>{current.meaning}</div>
                <div style={{ fontSize: "17px", color: "#777", lineHeight: "1.5" }}>{current.sentence_jp}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginBottom: "15px" }}>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#f1f3f5", border: "none" }} onClick={(e) => { e.stopPropagation(); if(history.length > 0){ const n = [...history]; const p = n.pop(); setHistory(n); setIndex(p); setStep(0); } }} disabled={history.length === 0}>戻る</button>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#333", color: "#fff", border: "none" }} onClick={(e) => { e.stopPropagation(); handleNext(); }}>次へ</button>
          </div>
          <button style={{ ...btnBase, background: "#fff5f5", borderColor: "#ff4d4d", color: "#ff4d4d", fontWeight: "bold", height: "60px", fontSize: "18px" }} onClick={(e) => { e.stopPropagation(); handleWrong(); }}>間違えた</button>
          
          <div style={{ margin: "30px 0" }}>
            <button style={{ ...btnBase, border: "1px solid #ddd" }} onClick={(e) => { e.stopPropagation(); setPriorityWords(prev => { const c={...prev}; if(c[current.word]) delete c[current.word]; else c[current.word]=true; return c; }); }}>
              {priorityWords[current?.word] ? "★ 最優先から外す" : "☆ 最優先課題に指定"}
            </button>
            <button style={{ ...btnBase, border: "none", color: "#888", fontSize: "14px", textDecoration: "underline" }} onClick={(e) => { e.stopPropagation(); setConfirmClearMistake(true); }}>
              この単語のミス記録をリセット
            </button>
          </div>
        </div>

        {/* MODALS */}
        {showEditMenu && (
          <div style={modalOverlay} onClick={() => setShowEditMenu(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: "20px", marginBottom: "10px" }}>単語の設定</h3>
              <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "30px" }}>Source: {current?.source}</p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => { setEditData({ ...current }); setIsEditing(true); }}>✎ 登録内容を編集</button>
              
              {/* 【重要】リストから削除ボタンの復元 */}
              <button style={{ ...btnBase, width: "100%", color: "#e53935", borderColor: "#e53935", marginTop: "10px" }} onClick={() => setConfirmDeleteWord(true)}>［この単語をリストから削除］</button>
              
              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "10px" }} onClick={() => setShowEditMenu(false)}>閉じる</button>
            </div>
          </div>
        )}

        {/* 単語削除確認ダイアログ */}
        {confirmDeleteWord && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "600", color: "#e53935", marginBottom: "10px" }}>単語の削除</p>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "30px" }}>この単語をリストから完全に削除しますか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#e53935", color: "#fff", border: "none" }} onClick={() => {
                const updated = entries.filter(e => e.word !== current.word);
                setEntries(updated);
                const newPool = pool.filter(e => e.word !== current.word);
                if (newPool.length === 0) {
                  setScreen("home");
                } else {
                  setPool(newPool);
                  setIndex(prev => Math.min(prev, newPool.length - 1));
                  setStep(0);
                }
                setConfirmDeleteWord(false);
                setShowEditMenu(false);
              }}>削除を実行</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmDeleteWord(false)}>キャンセル</button>
            </div>
          </div>
        )}

        {isEditing && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ marginBottom: "25px" }}>内容の修正</h3>
              <div style={{ textAlign: "left", marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>意味 (日本語) <span onClick={() => startListening("meaning", "ja-JP")} style={{ marginLeft: "15px", color: "#2196f3", cursor: "pointer", fontSize: "12px" }}>🎤 音声入力</span></label>
                <textarea style={textareaStyle} value={editData.meaning} onChange={e => setEditData({ ...editData, meaning: e.target.value })} />
              </div>
              <div style={{ textAlign: "left", marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>例文 (英語) <span onClick={() => startListening("sentence", "en-US")} style={{ marginLeft: "15px", color: "#2196f3", cursor: "pointer", fontSize: "12px" }}>🎤 音声入力</span></label>
                <textarea style={textareaStyle} value={editData.sentence} onChange={e => setEditData({ ...editData, sentence: e.target.value })} />
              </div>
              <div style={{ textAlign: "left", marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>例文の訳 <span onClick={() => startListening("sentence_jp", "ja-JP")} style={{ marginLeft: "15px", color: "#2196f3", cursor: "pointer", fontSize: "12px" }}>🎤 音声入力</span></label>
                <textarea style={textareaStyle} value={editData.sentence_jp} onChange={e => setEditData({ ...editData, sentence_jp: e.target.value })} />
              </div>
              <button style={{ ...btnBase, width: "100%", background: "#4caf50", color: "#fff", border: "none" }} onClick={() => setConfirmSaveEdit(true)}>変更を保存</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setIsEditing(false)}>キャンセル</button>
            </div>
          </div>
        )}

        {confirmSaveEdit && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "600", marginBottom: "30px" }}>変更を保存しますか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => {
                const updated = entries.map(e => e.word === current.word ? { ...e, ...editData } : e);
                setEntries(updated);
                setPool(pool.map(e => e.word === current.word ? { ...e, ...editData } : e));
                setConfirmSaveEdit(false); setIsEditing(false); setShowEditMenu(false);
              }}>保存</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmSaveEdit(false)}>戻る</button>
            </div>
          </div>
        )}

        {confirmClearMistake && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "600", marginBottom: "20px" }}>ミス履歴をリセットしますか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#e53935", color: "#fff", border: "none" }} onClick={() => { setMistakes(prev => ({ ...prev, [current.word]: 0 })); setConfirmClearMistake(false); }}>リセット</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmClearMistake(false)}>キャンセル</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // File Selection
  if (screen === "fileSelectModal") {
    return (
      <div style={modalOverlay}>
        <div style={modalContent}>
          <h3 style={{ fontSize: "20px", marginBottom: "20px" }}>テスト対象ファイル</h3>
          <div style={{ textAlign: "left", borderTop: "1px solid #eee" }}>
            <label style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}>
              <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? setSelectedTestFiles([]) : setSelectedTestFiles([...fileList])} style={{ width: "20px", height: "20px", marginRight: "12px" }} />
              <span style={{ fontWeight: "700" }}>すべてのファイル</span>
            </label>
            {fileList.map(file => (
              <label key={file} style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                <input type="checkbox" checked={selectedTestFiles.includes(file)} onChange={() => setSelectedTestFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} style={{ width: "18px", height: "18px", marginRight: "12px" }} />
                <span>{file}</span>
              </label>
            ))}
          </div>
          <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff", marginTop: "30px" }} onClick={() => setScreen("home")}>完了</button>
        </div>
      </div>
    );
  }

  // Review Range
  if (screen === "reviewSelect") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: "8px" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h3 style={{ fontSize: "22px", marginBottom: "40px" }}>復習範囲</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "50px" }}>
          {["today", "yesterday", "week"].map(val => (
            <label key={val} style={{ display: "flex", alignItems: "center", padding: "20px", border: "1px solid #ddd", borderRadius: "15px", background: reviewRange === val ? "#f0f7ff" : "white" }}>
              <input type="radio" checked={reviewRange === val} onChange={() => setReviewRange(val)} style={{ width: "20px", marginRight: "15px" }} />
              <span style={{ fontWeight: "600" }}>{val === "today" ? "今日" : val === "yesterday" ? "昨日" : "1週間以内"}</span>
            </label>
          ))}
        </div>
        <button style={{ ...btnBase, background: "#333", color: "#fff" }} onClick={() => startTest("review")}>開始</button>
      </div>
    );
  }

  // Ranking Screen (Pagination UI 復元)
  if (screen === "ranking") {
    const sorted = entries
      .map(e => ({ ...e, count: mistakes[e.word] || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);

    const itemsPerPage = 20;
    const maxPage = Math.ceil(sorted.length / itemsPerPage) || 1;
    const currentData = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("home")}>← ホーム</button>
        <h3 style={{ marginBottom: "20px" }}>苦手ランキング</h3>
        <div style={{ textAlign: "left", marginBottom: "30px" }}>
          {currentData.map((e, i) => (
            <div key={e.word} style={{ padding: "15px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: "bold" }}>{(currentPage - 1) * itemsPerPage + i + 1}. {e.word}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>{e.meaning}</div>
              </div>
              <div style={{ color: "#d32f2f", fontWeight: "bold" }}>{e.count} miss</div>
            </div>
          ))}
        </div>
        
        {/* << < > >> UIの復元 */}
        {maxPage > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "20px" }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} style={{ padding: "8px" }}>&lt;&lt;</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: "8px" }}>&lt;</button>
            <span style={{ margin: "0 10px", fontSize: "14px" }}>{currentPage} / {maxPage}</span>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "8px" }}>&gt;</button>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(maxPage)} style={{ padding: "8px" }}>&gt;&gt;</button>
          </div>
        )}
      </div>
    );
  }

  // File Delete
  if (screen === "fileDelete") {
    return (
      <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h3>削除するファイルを選択</h3>
        <div style={{ textAlign: "left", marginBottom: "30px" }}>
          {fileList.map(file => (
            <label key={file} style={{ display: "flex", alignItems: "center", padding: "15px 0", borderBottom: "1px solid #eee" }}>
              <input type="checkbox" checked={selectedFiles.includes(file)} onChange={() => setSelectedFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} style={{ marginRight: "12px" }} />
              <span>{file}</span>
            </label>
          ))}
        </div>
        <button style={{ ...btnBase, background: "#d32f2f", color: "white", border: "none" }} onClick={() => { if(selectedFiles.length > 0) setConfirmFileDelete(true); }}>削除</button>

        {confirmFileDelete && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "bold", color: "#d32f2f" }}>本当に削除します覚悟はいいですか？</p>
              <button style={{ ...btnBase, background: "#d32f2f", color: "white", marginTop: "20px" }} onClick={() => {
                setEntries(prev => prev.filter(e => !selectedFiles.includes(e.source)));
                setSelectedFiles([]); setConfirmFileDelete(false); setScreen("home");
              }}>削除を実行</button>
              <button style={{ ...btnBase, border: "none" }} onClick={() => setConfirmFileDelete(false)}>戻る</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
