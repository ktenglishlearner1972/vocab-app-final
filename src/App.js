import React, { useState, useEffect } from "react";

/* =========================
   utils
========================= */

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
      for (let i = 0; i < weight; i++) pool.push(e);
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
    i % 2 === 1 ? <strong key={i}>{p}</strong> : p
  );
}

/* =========================
   styles
========================= */

const btn = {
  width: "220px",
  height: "48px",
  border: "1px solid #333",
  borderRadius: "10px",
  background: "white",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "8px auto", // ボタン間の余白を少し確保
  fontSize: "16px",
  fontFamily: "sans-serif",
  lineHeight: "1",
  boxSizing: "border-box"
};

const sectionTitle = {
  marginTop: 20,
  marginBottom: 8
};

const hrStyle = {
  width: "200px",
  margin: "12px auto",
  border: "0",
  borderTop: "1px solid #ccc"
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};

const modalContentStyle = {
  width: "320px",
  maxHeight: "80vh",
  background: "white",
  borderRadius: 16,
  padding: "32px 24px",
  textAlign: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  overflowY: "auto"
};

const inputGroupStyle = {
  marginBottom: "15px",
  textAlign: "left"
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  color: "#666",
  marginBottom: "4px"
};

const textareaStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
  fontSize: "14px",
  minHeight: "60px",
  fontFamily: "inherit"
};

/* =========================
   APP
========================= */

export default function App() {
  const [screen, setScreen] = useState("home");
  const [reviewRange, setReviewRange] = useState("today");

  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem("entries");
    return saved ? JSON.parse(saved) : [];
  });

  const [mistakes, setMistakes] = useState(() => {
    const saved = localStorage.getItem("mistakes");
    return saved ? JSON.parse(saved) : {};
  });

  const [mistakeLog, setMistakeLog] = useState(() => {
    const saved = localStorage.getItem("mistakeLog");
    return saved ? JSON.parse(saved) : {};
  });

  const [priorityWords, setPriorityWords] = useState(() => {
    const saved = localStorage.getItem("priorityWords");
    return saved ? JSON.parse(saved) : {};
  });

  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState([]);

  // 各種確認モーダル
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearMistake, setConfirmClearMistake] = useState(false);
  const [confirmFileDelete, setConfirmFileDelete] = useState(false);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  
  // 編集関連
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ meaning: "", sentence: "", sentence_jp: "" });
  const [isListening, setIsListening] = useState(null);

  // ファイル管理
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [selectedTestFiles, setSelectedTestFiles] = useState([]); 

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

  /* --- TTS (読み上げ) --- */
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = "en-US";
    window.speechSynthesis.speak(uttr);
  };

  /* --- STT (音声入力) --- */
  const startListening = (field, lang = "ja-JP") => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声入力に対応していません。");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.start();
    setIsListening(field);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setEditData(prev => ({ ...prev, [field]: prev[field] + transcript }));
      setIsListening(null);
    };

    recognition.onerror = () => setIsListening(null);
    recognition.onend = () => setIsListening(null);
  };

  /* --- Test Management --- */
  const startTest = (mode) => {
    let baseEntries = entries;
    if (!isAllSelected) {
      baseEntries = entries.filter(e => selectedTestFiles.includes(e.source));
    }

    let p = [];
    if (mode === "all") p = shuffle([...baseEntries]);
    if (mode === "weak") p = buildWeakPool(baseEntries, mistakes);
    if (mode === "priority") p = shuffle(baseEntries.filter(e => priorityWords[e.word]));

    if (mode === "review") {
      const now = new Date();
      const start = new Date(now);
      if (reviewRange === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (reviewRange === "yesterday") {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        now.setDate(now.getDate() - 1);
        now.setHours(23, 59, 59, 999);
      } else {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      }
      p = shuffle(entries.filter(e => {
        const logs = mistakeLog[e.word] || [];
        return logs.some(t => {
          const d = new Date(t);
          return d >= start && d <= now;
        });
      }));
    }

    if (p.length === 0) {
      alert("対象の単語がありません。");
      return;
    }

    setPool(p);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setScreen("test");
  };

  const next = () => {
    if (index >= pool.length - 1) {
      setScreen("home");
      return;
    }
    setHistory(h => [...h, index]);
    setIndex(i => i + 1);
    setStep(0);
  };

  const back = () => {
    if (history.length === 0) return;
    const copy = [...history];
    const prev = copy.pop();
    setHistory(copy);
    setIndex(prev);
    setStep(0);
  };

  const wrong = () => {
    if (!current) return;
    const now = Date.now();
    setMistakes(prev => ({ ...prev, [current.word]: (prev[current.word] || 0) + 1 }));
    setMistakeLog(prev => ({ ...prev, [current.word]: [...(prev[current.word] || []), now] }));
    next();
  };

  const clearMistakeCount = () => {
    if (!current) return;
    setMistakes(prev => ({ ...prev, [current.word]: 0 }));
    setConfirmClearMistake(false);
  };

  const togglePriority = () => {
    if (!current) return;
    if (priorityWords[current.word]) {
      setPriorityWords(prev => {
        const copy = { ...prev };
        delete copy[current.word];
        return copy;
      });
    } else {
      setPriorityWords(prev => ({ ...prev, [current.word]: true }));
    }
  };

  const executeSaveEdit = () => {
    setEntries(prev => prev.map(e => e.word === current.word ? { ...e, ...editData } : e));
    setPool(prev => prev.map(e => e.word === current.word ? { ...e, ...editData } : e));
    setConfirmSaveEdit(false);
    setIsEditing(false);
    setShowEditMenu(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split(/\r?\n/).filter(Boolean);
      const parsed = lines.map(line => {
        const [word, meaning, sentence, sentence_jp] = parseCSVLine(line);
        return { word, meaning, sentence, sentence_jp, source: file.name };
      });
      setEntries(prev => {
        const map = new Map();
        [...prev, ...parsed].forEach(e => map.set(e.word, e));
        return [...map.values()];
      });
    };
    reader.readAsText(file);
  };

  const blank = <div style={{ height: 24 }} />;

  const renderCard = () => {
    if (!current) return null;

    const wordHeader = (
      <h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {current.word}
        <span 
          style={{ cursor: "pointer", marginLeft: "12px", fontSize: "24px" }} 
          onClick={(e) => { e.stopPropagation(); speak(current.word); }}
        >
          🔊
        </span>
      </h2>
    );

    // 設定アイコン：左側の高さ中央付近に配置
    const infoTrigger = (
      <div 
        style={{ 
          position: "absolute", 
          top: "50%", 
          left: "0px", 
          transform: "translateY(-50%)", 
          padding: "16px", 
          fontSize: "24px", 
          cursor: "pointer", 
          opacity: 0.5 
        }}
        onClick={(e) => { e.stopPropagation(); setShowEditMenu(true); }}
      >
        ⋮
      </div>
    );

    if (step === 0) return (<div style={{position:"relative", height:"100%", display:"flex", flexDirection:"column", justifyContent:"center"}}>{wordHeader}{infoTrigger}</div>);
    if (step === 1) return (<div style={{position:"relative", height:"100%", display:"flex", flexDirection:"column", justifyContent:"center"}}>{wordHeader}<div>{renderWithBold(current.sentence)}</div>{infoTrigger}</div>);
    return (
      <div style={{position:"relative", height:"100%", display:"flex", flexDirection:"column", justifyContent:"center"}}>
        {wordHeader}
        <div style={{fontWeight:"bold"}}>{current.meaning}</div>
        <div style={{fontSize:"15px", margin:"8px 0"}}>{renderWithBold(current.sentence)}</div>
        <div style={{fontSize:"13px", color:"#555"}}>{current.sentence_jp}</div>
        {infoTrigger}
      </div>
    );
  }

  /* =========================
      Screens
  ========================= */
  if (screen === "home") {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <h2>英単語アプリ</h2>
        <p>単語数: {entries.length}</p>
        <h3 style={sectionTitle}>－ 単語テスト －</h3>
        <button style={btn} onClick={() => setScreen("fileSelectModal")}>ファイル選択</button>
        <hr style={hrStyle} />
        <div style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>{isAllSelected ? "全ファイルのテスト" : "指定ファイルのテスト"}</div>
        <button style={btn} onClick={() => startTest("all")}>すべて</button>
        <button style={btn} onClick={() => startTest("weak")}>苦手優先</button>
        <button style={btn} onClick={() => startTest("priority")}>最優先課題</button>
        <button style={btn} onClick={() => setScreen("reviewSelect")}>復習</button>
        <h3 style={sectionTitle}>－ 苦手ランキング －</h3>
        <button style={btn} onClick={() => setScreen("ranking")}>苦手単語</button>
        <h3 style={sectionTitle}>－ 単語ファイル管理 －</h3>
        <div style={{ ...btn, position: "relative" }}>追加ファイル選択<input type="file" accept=".csv" onChange={handleFile} style={{ position: "absolute", inset: 0, opacity: 0 }} /></div>
        <button style={btn} onClick={() => setScreen("fileDelete")}>ファイル削除</button>
      </div>
    );
  }

  if (screen === "fileSelectModal") {
    return (
      <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
          <h3 style={{ marginTop: 0 }}>テスト対象を選択</h3>
          <div style={{ textAlign: "left", marginBottom: 20 }}>
            <label style={{ display: "block", padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? setSelectedTestFiles([]) : setSelectedTestFiles([...fileList])} /> <span style={{ fontWeight: "bold" }}>すべてのファイル</span>
            </label>
            {fileList.map(file => (
              <label key={file} style={{ display: "block", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <input type="checkbox" checked={selectedTestFiles.includes(file)} onChange={() => setSelectedTestFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} /> {file}
              </label>
            ))}
          </div>
          <button style={{ ...btn, width: "100%" }} onClick={() => setScreen("home")}>選択</button>
        </div>
      </div>
    );
  }

  if (screen === "reviewSelect") {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <button onClick={() => setScreen("home")}>← ホーム</button>
        <h3>復習期間を選択</h3>
        <label><input type="radio" checked={reviewRange==="today"} onChange={()=>setReviewRange("today")} /> 当日</label><br/>
        <label><input type="radio" checked={reviewRange==="yesterday"} onChange={()=>setReviewRange("yesterday")} /> 前日</label><br/>
        <label><input type="radio" checked={reviewRange==="week"} onChange={()=>setReviewRange("week")} /> 直近7日間</label><br/><br/>
        <button style={btn} onClick={() => startTest("review")}>復習開始</button>
      </div>
    );
  }

  if (screen === "ranking") {
    const ranking = entries.map(e => ({ ...e, count: mistakes[e.word] || 0 })).filter(e => e.count > 0).sort((a, b) => b.count - a.count);
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <button onClick={() => setScreen("home")}>← ホーム</button>
        <h3>苦手単語ランキング</h3>
        {ranking.map((e, i) => (
          <div key={e.word} style={{margin:"10px 0"}}>
            {i + 1}. {e.word} ({e.count}回)
            <div style={{ fontSize: "14px", opacity: 0.8 }}>{e.meaning}</div>
          </div>
        ))}
      </div>
    );
  }

  if (screen === "fileDelete") {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <button onClick={() => setScreen("home")}>← ホーム</button>
        <h3>削除するファイルを選択</h3>
        {fileList.map(file => (
          <div key={file} style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <label><input type="checkbox" checked={selectedFiles.includes(file)} onChange={() => setSelectedFiles(prev => prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file])} /> {file}</label>
          </div>
        ))}
        <button style={btn} onClick={() => setConfirmFileDelete(true)}>削除する</button>

        {confirmFileDelete && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <p>以下のファイルを削除しますか？</p>
              <div style={{ margin: "12px 0", fontSize: "14px", color: "#666" }}>{selectedFiles.map(f => <div key={f}>{f}</div>)}</div>
              <button style={btn} onClick={() => { setEntries(prev => prev.filter(e => !selectedFiles.includes(e.source))); setSelectedFiles([]); setConfirmFileDelete(false); setScreen("home"); }}>はい</button>
              <button style={btn} onClick={() => setConfirmFileDelete(false)}>いいえ</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =========================
      Test Execution Screen
  ========================= */
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <button onClick={() => setScreen("home")}>← ホーム</button>
      <div
        onClick={() => setStep(s => Math.min(s + 1, 2))}
        style={{ border: "1px solid #333", borderRadius: 16, padding: 20, minHeight: 240, marginTop: 20, cursor: "pointer", userSelect: "none", position: "relative" }}
      >
        {renderCard()}
      </div>

      <div style={{marginTop: 10}}>
        <button style={btn} onClick={back}>戻る</button>
        <button style={btn} onClick={next}>次へ</button>
        <button style={btn} onClick={wrong}>間違えた</button>
        <button style={btn} onClick={togglePriority}>{priorityWords[current?.word] ? "最優先指定解除" : "最優先指定"}</button>
        <button style={btn} onClick={() => setConfirmClearMistake(true)}>失敗カウントクリア</button>
        <button style={btn} onClick={() => setConfirmDelete(true)}>単語を削除</button>
      </div>

      {/* 設定・情報メニュー */}
      {showEditMenu && (
        <div style={modalOverlayStyle} onClick={() => setShowEditMenu(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3>カード情報</h3>
            <p style={{ fontSize: "14px", color: "#666" }}>収録元: {current?.source || "不明"}</p>
            <button style={btn} onClick={() => { setEditData({ ...current }); setIsEditing(true); }}>✎ 編集する</button>
            <button style={btn} onClick={() => setShowEditMenu(false)}>閉じる</button>
          </div>
        </div>
      )}

      {/* 編集画面 */}
      {isEditing && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>「{current.word}」を編集</h3>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>語義 <span onClick={() => startListening("meaning", "ja-JP")} style={{ cursor: "pointer", color: isListening === "meaning" ? "red" : "blue" }}>{isListening === "meaning" ? "🔴 録音中..." : "🎤 音声入力"}</span></label>
              <textarea style={textareaStyle} value={editData.meaning} onChange={e => setEditData({ ...editData, meaning: e.target.value })} />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>例文 <span onClick={() => startListening("sentence", "en-US")} style={{ cursor: "pointer", color: isListening === "sentence" ? "red" : "blue" }}>{isListening === "sentence" ? "🔴 録音中..." : "🎤 音声入力(EN)"}</span></label>
              <textarea style={textareaStyle} value={editData.sentence} onChange={e => setEditData({ ...editData, sentence: e.target.value })} />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>例文和訳 <span onClick={() => startListening("sentence_jp", "ja-JP")} style={{ cursor: "pointer", color: isListening === "sentence_jp" ? "red" : "blue" }}>{isListening === "sentence_jp" ? "🔴 録音中..." : "🎤 音声入力"}</span></label>
              <textarea style={textareaStyle} value={editData.sentence_jp} onChange={e => setEditData({ ...editData, sentence_jp: e.target.value })} />
            </div>
            <button style={btn} onClick={() => setConfirmSaveEdit(true)}>保存</button>
            <button style={btn} onClick={() => setIsEditing(false)}>キャンセル</button>
          </div>
        </div>
      )}

      {/* 保存確認 */}
      {confirmSaveEdit && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <p>変更を保存しますか？</p>
            <button style={btn} onClick={executeSaveEdit}>はい</button>
            <button style={btn} onClick={() => setConfirmSaveEdit(false)}>いいえ</button>
          </div>
        </div>
      )}

      {/* カウントクリア確認 */}
      {confirmClearMistake && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <p>「{current?.word}」の失敗カウントをクリアしますか？</p>
            <button style={btn} onClick={clearMistakeCount}>はい</button>
            <button style={btn} onClick={() => setConfirmClearMistake(false)}>いいえ</button>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {confirmDelete && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <p>「{current?.word}」を削除しますか？</p>
            <button style={btn} onClick={() => { setEntries(prev => prev.filter(e => e.word !== current.word)); setConfirmDelete(false); next(); }}>はい</button>
            <button style={btn} onClick={() => setConfirmDelete(false)}>いいえ</button>
          </div>
        </div>
      )}
    </div>
  );
}
