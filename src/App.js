import React, { useState, useEffect, useRef } from "react";

/* =========================================================
   1. Logic & Helpers
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
    // 下書き(draft)は除外
    if (e.status === "draft") continue;
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
  minHeight: "420px",
  height: "auto",
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

const searchInputStyle = {
  width: "100%",
  padding: "16px",
  fontSize: "18px",
  borderRadius: "12px",
  border: "2px solid #333",
  boxSizing: "border-box",
  marginBottom: "10px",
  outline: "none"
};

/* =========================================================
   3. Main Application Component
   ========================================================= */

const App = () => {

const [entries, setEntries] = useState(() => {
  try {
    const saved = localStorage.getItem("entries");

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      console.error("entries is not array:", parsed);
      return [];
    }

    return parsed
      .filter(e => e && typeof e === "object")
      .map(e => ({
        word: e.word || "",
        meaning: e.meaning || "",
        sentence: e.sentence || "",
        sentence_jp: e.sentence_jp || "",
        level: e.level || "",
        source: e.source || "",
        status: e.status || "active"
      }));

  } catch (e) {
    console.error("entries load error:", e);
    return [];
  }
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

  const [testStats, setTestStats] = useState(() => {
    try {
      const saved = localStorage.getItem("testStats");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [srsData, setSrsData] = useState(() => {
    try {
      const saved = localStorage.getItem("srsData");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [isErrorLogging, setIsErrorLogging] = useState(false);

  const [screen, setScreen] = useState("home");
  const [reviewRange, setReviewRange] = useState("srs"); 
  const [pool, setPool] = useState([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); 
  const [history, setHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState([]); 
  const [selectedTestFiles, setSelectedTestFiles] = useState([]); 
  const [selectedDuplicateFiles, setSelectedDuplicateFiles] = useState([]);
  const [dupCheckAllFiles, setDupCheckAllFiles] = useState(true);

  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    word: "", meaning: "", sentence: "", sentence_jp: "", level: "", source: ""
  });
  const [isListening, setIsListening] = useState(null);

  const [dupCurrentPage, setDupCurrentPage] = useState(1);
  const [dupMergeTarget, setDupMergeTarget] = useState(null);
  const [mergeSelections, setMergeSelections] = useState({});
  const [finalMergeData, setFinalMergeData] = useState(null);

  const [confirmDeleteWord, setConfirmDeleteWord] = useState(false);
  const [confirmClearMistake, setConfirmClearMistake] = useState(false);
  const [confirmFileDelete, setConfirmFileDelete] = useState(false);
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  const [exportAsCopy, setExportAsCopy] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchEntry, setSelectedSearchEntry] = useState(null);
  const [rankingMemoEntry, setRankingMemoEntry] = useState(null);
  const [priorityToast, setPriorityToast] = useState("");
  const priorityToastTimer = useRef(null);

  const [pendingImports, setPendingImports] = useState([]);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  
  const [hasMissedInTest, setHasMissedInTest] = useState(false);
  const [hasMissedInSearch, setHasMissedInSearch] = useState(false);

  // --- 新規登録用ステート ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalStep, setAddModalStep] = useState("input"); // "input", "saveTarget"
  const [duplicateEntry, setDuplicateEntry] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [lastUsedFileName, setLastUsedFileName] = useState("");

  const [touchStartObj, setTouchStartObj] = useState(null);
  const [touchEndObj, setTouchEndObj] = useState(null);

  const togglePriority = (e, word) => {
    e.stopPropagation();
    setPriorityWords(prev => {
      const next = { ...prev };
      if (next[word]) {
        delete next[word];
        showPriorityToast("最優先指定を解除しました。");
      } else {
        next[word] = true;
        showPriorityToast("最優先単語に指定しました。");
      }
      return next;
    });
  };

  const showPriorityToast = (msg) => {
    setPriorityToast(msg);
    if (priorityToastTimer.current) clearTimeout(priorityToastTimer.current);
    priorityToastTimer.current = setTimeout(() => setPriorityToast(""), 2000);
  };

  useEffect(() => { localStorage.setItem("entries", JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem("mistakes", JSON.stringify(mistakes)); }, [mistakes]);
  useEffect(() => { localStorage.setItem("mistakeLog", JSON.stringify(mistakeLog)); }, [mistakeLog]);
  useEffect(() => { localStorage.setItem("priorityWords", JSON.stringify(priorityWords)); }, [priorityWords]);
  useEffect(() => { localStorage.setItem("testStats", JSON.stringify(testStats)); }, [testStats]);
  useEffect(() => { localStorage.setItem("srsData", JSON.stringify(srsData)); }, [srsData]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      const filtered = entries.filter(e => 
        e.word.toLowerCase().startsWith(q) || e.word.toLowerCase() === q
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, entries]);

  const fileList = [
    ...new Set(
      entries
        .filter(e => e && typeof e.source === "string")
        .map(e => e.source)
        .filter(Boolean)
    )
  ];
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

  const startListening = (target, lang = "ja-JP") => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("音声入力に非対応のブラウザです。");
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.start();
    setIsListening(target);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        if (target === "search") {
          setSearchQuery(transcript);
        } else if (target === "add_word") {
          setEditData(prev => ({ ...prev, word: transcript }));
        } else {
          setEditData(prev => ({ ...prev, [target]: (prev[target] || "") + transcript }));
        }
      }
    };
    recognition.onend = () => setIsListening(null);
  };

  const startTest = (mode, singleEntry = null) => {
    if (singleEntry) {
      setPool([singleEntry]);
      setIndex(0);
      setStep(0);
      setHistory([]);
      setHasMissedInTest(false);
      setScreen("test");
      return;
    }

    let base = entries.filter(e => e.status !== "draft");
    if (!isAllSelected) {
      base = base.filter(e => selectedTestFiles.includes(e.source));
    }
    if (base.length === 0) {
      alert("単語がありません（または下書きのみです）。");
      return;
    }

    let p = [];
    if (mode === "all") {
      let sorted = [...base].sort((a, b) => {
        const statA = testStats[a.word] || { presented: 0, lastTested: 0 };
        const statB = testStats[b.word] || { presented: 0, lastTested: 0 };
        if (statA.presented !== statB.presented) return statA.presented - statB.presented;
        return statA.lastTested - statB.lastTested;
      });
      const chunked = {};
      sorted.forEach(e => {
        const pres = testStats[e.word]?.presented || 0;
        if (!chunked[pres]) chunked[pres] = [];
        chunked[pres].push(e);
      });
      let finalPool = [];
      Object.keys(chunked).sort((a,b) => Number(a)-Number(b)).forEach(key => {
        finalPool = finalPool.concat(shuffle(chunked[key]));
      });
      const difficultWords = [...base].filter(e => (mistakes[e.word] || 0) > 0)
        .sort((a, b) => {
          const rateA = (mistakes[a.word]||0) / ((testStats[a.word]?.presented)||1);
          const rateB = (mistakes[b.word]||0) / ((testStats[b.word]?.presented)||1);
          return rateB - rateA;
        });
      if (difficultWords.length > 0) {
        let diffIndex = 0;
        for (let i = 49; i < finalPool.length; i += 50) {
          if (diffIndex < difficultWords.length) {
            finalPool.splice(i, 0, difficultWords[diffIndex]);
            diffIndex++;
          }
        }
        finalPool = [...new Map(finalPool.map(item => [item.word, item])).values()];
      }
      p = finalPool;
    } else if (mode === "weak") {
      p = buildWeakPool(base, mistakes);
    } else if (mode === "priority") {
      p = shuffle(base.filter(e => priorityWords[e.word]));
    } else if (mode === "review") {
      const now = Date.now();
      if (reviewRange === "srs") {
        p = shuffle(base.filter(e => {
          const srs = srsData[e.word];
          return srs && srs.nextReview <= now;
        }));
        if (p.length === 0) {
          alert("現在、復習タイミングの単語はありません。");
          return;
        }
      } else {
        const start = new Date(now);
        if (reviewRange === "today") start.setHours(0, 0, 0, 0);
        else if (reviewRange === "yesterday") {
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
        } else if (reviewRange === "week") {
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        }
        p = shuffle(base.filter(e => {
          const logs = mistakeLog[e.word] || [];
          return logs.some(timestamp => new Date(timestamp) >= start);
        }));
        if (p.length === 0) {
          alert("該当期間にミスした単語はありません。");
          return;
        }
      }
    }

    setPool(p);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setHasMissedInTest(false);
    setScreen("test");
  };

  const handleNext = () => {
    if (!current) return;
    const word = current.word;
    const now = Date.now();
    
    setTestStats(prev => ({
        ...prev,
        [word]: { 
          presented: ((prev[word]?.presented) || 0) + 1, 
          lastTested: now 
        }
    }));

    setSrsData(prev => {
        const d = prev[word] || { interval: 0, rep: 0 };
        let newRep = d.rep;
        let newInterval = d.interval;
        if (!hasMissedInTest) {
            if (newRep === 0) newInterval = 1;
            else if (newRep === 1) newInterval = 3;
            else newInterval = Math.round(newInterval * 1.5);
            newRep++;
        } else {
            newRep = 0;
            newInterval = 0;
        }
        const nextReview = now + (newInterval * 86400000);
        return { ...prev, [word]: { interval: newInterval, rep: newRep, nextReview } };
    });

    setHasMissedInTest(false);
    setIsErrorLogging(false);

    if (index >= pool.length - 1) {
      setScreen("home");
    } else {
      setHistory(prev => [...prev, index]);
      setIndex(index + 1);
      setStep(0); 
    }
  };

  const handleWrong = (word) => {
    const now = Date.now();
    setMistakes(prev => ({ ...prev, [word]: (prev[word] || 0) + 1 }));
    setMistakeLog(prev => {
      const currentLogs = prev[word] || [];
      return { ...prev, [word]: [...currentLogs, now] };
    });
    if (screen === "test") {
      setHasMissedInTest(true);
      setIsErrorLogging(true);
    } else if (screen === "search") {
      setHasMissedInSearch(true);
      setTimeout(() => setHasMissedInSearch(false), 1000);
    }
  };

  const onFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const newPending = [];
    let loadedCount = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length > 0 && lines[0].toLowerCase().includes("word")) lines.shift();
        const parsed = lines.map(line => {
          const [word, meaning, sentence, sentence_jp, level] = parseCSVLine(line);
          return { word, meaning, sentence, sentence_jp, level, source: file.name };
        }).filter(item => item.word);
        newPending.push(...parsed);
        loadedCount++;
        if (loadedCount === files.length) {
          const duplicates = newPending.filter(p => entries.some(existing => existing.word === p.word && existing.source === p.source));
          if (duplicates.length > 0) {
            setPendingImports(newPending);
            setShowImportConfirm(true);
          } else {
            setEntries(prev => [...prev, ...newPending]);
            alert(`${newPending.length}件の単語を読み込みました。`);
          }
        }
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const executeImport = (mode) => {
    let toAdd = pendingImports;
    if (mode === "diff") {
      toAdd = pendingImports.filter(p => !entries.some(existing => existing.word === p.word && existing.source === p.source));
    }
    setEntries(prev => [...prev, ...toAdd]);
    alert(`${toAdd.length}件の単語を読み込みました。`);
    setShowImportConfirm(false);
    setPendingImports([]);
  };

  const handleExportCSV = (targetFiles) => {
    const targets = entries.filter(e => targetFiles.includes(e.source));
    if (targets.length === 0) return alert("データがありません。");
    const grouped = {};
    targets.forEach(e => {
      if (!grouped[e.source]) grouped[e.source] = [];
      grouped[e.source].push(e);
    });
    Object.keys(grouped).forEach(sourceName => {
      let csvContent = "\uFEFF\"word\",\"meaning\",\"sentence\",\"sentence_jp\",\"level\"\n";
      grouped[sourceName].forEach(e => {
        const row = [e.word, e.meaning, e.sentence, e.sentence_jp, e.level || ""]
          .map(val => `"${(val || "").replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
      });
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const fileName = exportAsCopy ? `copy_${sourceName}` : sourceName;
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
    });
  };

// --- 新規登録用ロジック ---
  const handleAddWordChange = (val) => {
    setEditData(prev => ({ ...prev, word: val }));

    const dup = entries.find(
      e =>
        e &&
        typeof e.word === "string" &&
        e.word.toLowerCase() === val.toLowerCase().trim()
    );

    setDuplicateEntry(dup || null);
  };

  const handleAddNext = (isDraftMode) => {
    const word = editData.word?.trim() || "";
    const meaning = editData.meaning?.trim() || "";

    if (!word || !meaning) {
      return alert("単語と語義を入力してください。");
    }

    const status = isDraftMode ? "draft" : "active";
    const updatedData = { ...editData, word, meaning, status }; // トリム済みのデータを反映
  
    // ステートも更新しておくが、保存処理にはこの updatedData を直接使う
    setEditData(updatedData);

    if (isDraftMode) {
      const draftSource = lastUsedFileName || "draft_items.csv";
      const finalEntry = { ...updatedData, source: draftSource, createdAt: Date.now() };
      setEntries(prev => [...prev, finalEntry]);
    
      alert("下書きとして保存しました。");
      setShowAddModal(false);
      setAddModalStep("input");
    } else {
      // 次のステップ（保存先選択）へ
      if (lastUsedFileName && typeof lastUsedFileName === "string") {
        setNewFileName(lastUsedFileName);
      } else {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        // 変数に一度出してからセットするとエラー箇所の特定がしやすくなります
        const defaultName = `new_words_${yyyy}${mm}.csv`;
        setNewFileName(defaultName);
      }
      setAddModalStep("saveTarget");
    }
  };

  const finalizeAdd = (sourceName) => {
    console.log("finalizeAdd called", sourceName);
    const finalEntry = { ...editData, source: sourceName, createdAt: Date.now() };
    setEntries(prev => [...prev, finalEntry]);
    
    // 次回のためにファイル名を保存
    setLastUsedFileName(sourceName);

    // キャッシュ削除の警告（alertが効かない環境を考慮しつつ記述）
    alert(`「${sourceName}」に保存しました。\n\n【重要】このアプリのデータはブラウザのキャッシュを削除すると消去されます。定期的に「CSVファイルを書き出す」からバックアップを作成してください。`);
    
    setShowAddModal(false);
    setAddModalStep("input");
  };
  
  const getAIRecommendation = () => {
    // 擬似AI機能：実際はAPIが必要なため、サンプルを表示
    alert("AI機能を使用するにはAPI連携が必要です。現在はデモとしてサンプルを入力します。");
    setEditData(prev => ({
      ...prev,
      meaning: "（AI候補）意味のサンプル",
      sentence: "This is an **example** sentence generated by AI.",
      sentence_jp: "これはAIによって生成された例文のサンプルです。"
    }));
  };

  /* =========================================================
     4. Render Helpers (Screens)
     ========================================================= */

  if (screen === "home") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px", maxWidth: "600px", margin: "0 auto", position: "relative" }}>
        <div 
          style={{ position: "absolute", top: "20px", left: "20px", fontSize: "28px", cursor: "pointer", padding: "10px", zIndex: 100 }}
          onClick={() => setShowMainMenu(true)}
        >
          ⋮
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "10px" }}>英単語マスター</h1>
        <p style={{ color: "#777", marginBottom: "40px" }}>現在の総単語数: <span style={{ color: "#333", fontWeight: "bold" }}>{entries.length}</span> 語</p>

        <section style={{ marginBottom: "40px" }}>
          <button style={btnBase} onClick={() => setScreen("fileSelectModal")}>テスト対象ファイルを選択</button>
          <div style={{ fontSize: "13px", color: "#999", marginBottom: "20px", height: "20px" }}>
            {isAllSelected ? "（すべてのファイルから出題）" : `（選択済み: ${selectedTestFiles.length} ファイル）`}
          </div>
          <button style={{ ...btnBase, background: "#f8f9fa" }} onClick={() => startTest("all")}>ランダムにテスト</button>
          <button style={btnBase} onClick={() => startTest("weak")}>苦手な単語を重点学習</button>
          <button style={btnBase} onClick={() => startTest("priority")}>★ 最優先課題のみ</button>
          <div style={{ height: "10px" }}></div> 
          <button style={btnBase} onClick={() => setScreen("reviewSelect")}>ミスした単語の復習</button>
          <button style={btnBase} onClick={() => { setCurrentPage(1); setScreen("ranking"); }}>苦手ランキング</button>
          <button style={{ ...btnBase, background: "#e3f2fd", borderColor: "#2196f3", color: "#1976d2", fontWeight: "bold", marginTop: "15px" }} onClick={() => { setSearchQuery(""); setScreen("search"); }}>🔍 データ検索</button>
        </section>

        {showMainMenu && (
          <div style={modalOverlay} onClick={() => setShowMainMenu(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: "20px", marginBottom: "30px" }}>設定・管理</h3>
              <button 
                style={{ ...btnBase, width: "100%", background: "#fff9c4", borderColor: "#fbc02d" }} 
                onClick={() => {
                  setEditData({ word: "", meaning: "", sentence: "", sentence_jp: "", level: "", source: "" });
                  setDuplicateEntry(null);
                  setAddModalStep("input");
                  setShowAddModal(true);
                  setShowMainMenu(false);
                }}
              >
                ＋ 単語を追加
              </button>
              <div style={{ ...btnBase, position: "relative", backgroundColor: "#fff", width: "100%" }}>
                CSVファイルを追加
                <input type="file" accept=".csv" multiple onChange={onFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>
              <button style={{ ...btnBase, width: "100%" }} onClick={() => { setDupCurrentPage(1); setScreen("duplicateFileSelect"); setShowMainMenu(false); }}>重複レコードの編集</button>
              <button style={{ ...btnBase, width: "100%", background: "#e8f5e9", borderColor: "#4caf50" }} onClick={() => { setScreen("exportList"); setShowMainMenu(false); }}>CSVファイルを書き出す</button>
              <button style={{ ...btnBase, width: "100%", color: "#e53935", borderColor: "#e53935", marginTop: "10px" }} onClick={() => { setScreen("fileDelete"); setShowMainMenu(false); }}>データを指定して削除</button>
              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "20px" }} onClick={() => setShowMainMenu(false)}>閉じる</button>
            </div>
          </div>
        )}

        {/* --- 単語追加モーダル --- */}
        {showAddModal && (
          <div style={modalOverlay}>
            <div style={{ ...modalContent, maxWidth: "420px" }}>
              {addModalStep === "input" ? (
                <>
                  <h3 style={{ marginBottom: "20px" }}>新規単語の登録</h3>
                  <div style={{ textAlign: "left", marginBottom: "15px" }}>
                    <label style={{ fontSize: "12px", color: "#888" }}>英単語</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input 
                        style={{ ...searchInputStyle, marginBottom: 0 }} 
                        value={editData.word} 
                        onChange={(e) => handleAddWordChange(e.target.value)}
                        placeholder="example"
                      />
                      <button onClick={() => startListening("add_word", "en-US")} style={{ padding: "0 10px", background: "#f0f0f0", border: "1px solid #ccc", borderRadius: "8px" }}>🎤</button>
                    </div>
                    {duplicateEntry && (
                      <div style={{ marginTop: "10px", padding: "10px", background: "#fff3e0", borderRadius: "8px", border: "1px solid #ffe0b2", fontSize: "13px" }}>
                        <p style={{ color: "#ef6c00", fontWeight: "bold", marginBottom: "5px" }}>⚠️ 登録済みです。重複して登録しますか？</p>
                        <p><b>語義:</b> {duplicateEntry.meaning}</p>
                        <p><b>ファイル:</b> {duplicateEntry.source}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "left", marginBottom: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: "12px", color: "#888" }}>語義 / AI候補</label>
                      <button onClick={getAIRecommendation} style={{ fontSize: "11px", background: "#e3f2fd", border: "1px solid #2196f3", color: "#2196f3", borderRadius: "4px", padding: "2px 6px" }}>AI提案</button>
                    </div>
                    <textarea 
                      style={{ ...textareaStyle, minHeight: "60px" }} 
                      value={editData.meaning} 
                      onChange={(e) => setEditData({...editData, meaning: e.target.value})}
                    />
                  </div>

                  <div style={{ textAlign: "left", marginBottom: "15px" }}>
                    <label style={{ fontSize: "12px", color: "#888" }}>例文</label>
                    <textarea 
                      style={{ ...textareaStyle, minHeight: "80px" }} 
                      value={editData.sentence} 
                      onChange={(e) => setEditData({...editData, sentence: e.target.value})}
                    />
                  </div>

                  <div style={{ textAlign: "left", marginBottom: "15px" }}>
                    <label style={{ fontSize: "12px", color: "#888" }}>例文和訳</label>
                    <textarea 
                      style={{ ...textareaStyle, minHeight: "60px" }} 
                      value={editData.sentence_jp} 
                      onChange={(e) => setEditData({...editData, sentence_jp: e.target.value})}
                    />
                  </div>

                  {(() => {
                    // ① 全項目が入力されているかチェック
                    const isComplete = !!(editData?.word?.trim() && editData?.meaning?.trim());

                    return (
                      <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
                        <button 
                          style={{ ...btnBase, flex: 1, margin: 0, border: "none", background: "#eee", fontSize: "14px" }} 
                          onClick={() => (editData.word || editData.meaning) ? setShowCancelConfirm(true) : setShowAddModal(false)}
                        >
                          キャンセル
                        </button>
                        <button 
                          style={{ ...btnBase, flex: 1, margin: 0, fontSize: "14px" }} 
                          onClick={() => handleAddNext(true)}
                        >
                          下書き保存
                        </button>
                        <button 
                          style={{ 
                            ...btnBase, 
                            flex: 1, 
                            margin: 0, 
                            background: isComplete ? "#333" : "#ccc", // 入力完了で黒、未完了でグレー
                            color: "#fff", 
                            fontSize: "14px",
                            cursor: isComplete ? "pointer" : "not-allowed",
                            border: "none"
                          }} 
                          disabled={!isComplete} // 入力が終わるまでボタンを押せなくする
                          onClick={() => handleAddNext(false)}
                        >
                          次へ
                        </button>
                      </div>
                    );
                  })()}
 
                </>
              ) : (
                <>
                  <h3 style={{ marginBottom: "20px" }}>保存先の選択</h3>
                  <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>「{editData?.word || ""}」の保存先を選んでください。</p>
                  
                  <div style={{ textAlign: "left", maxHeight: "200px", overflowY: "auto", border: "1px solid #eee", padding: "10px", borderRadius: "10px", marginBottom: "20px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "bold", color: "#999", marginBottom: "10px" }}>既存のファイルに追記:</p>
                    {fileList.map(f => (
                      <button key={f} onClick={() => finalizeAdd(f)} style={{ width: "100%", padding: "10px", textAlign: "left", background: "#fff", border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}>📄 {f}</button>
                    ))}
                  </div>

                  <div style={{ textAlign: "left", borderTop: "2px solid #eee", paddingTop: "15px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "bold", color: "#999", marginBottom: "10px" }}>新規CSVとして作成:</p>
                    <input style={searchInputStyle} value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="filename.csv" />
                    <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => finalizeAdd(newFileName)}>新規作成して保存</button>
                  </div>
                  <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "10px" }} onClick={() => setAddModalStep("input")}>戻る</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* キャンセル確認ダイアログ */}
        {showCancelConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "bold" }}>入力したデータは削除されます。<br/>よろしいですか？</p>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button style={{ ...btnBase, flex: 1, background: "#d32f2f", color: "#fff", border: "none" }} onClick={() => { setShowCancelConfirm(false); setShowAddModal(false); }}>はい</button>
                <button style={{ ...btnBase, flex: 1, background: "#eee", border: "none" }} onClick={() => setShowCancelConfirm(false)}>いいえ</button>
              </div>
            </div>
          </div>
        )}

        {showImportConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ color: "#d32f2f", marginBottom: "15px" }}>重複の確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>既に読み込み済みのファイルが含まれています。<br/><b>未登録の単語（差分）のみ</b>を読み込みますか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => executeImport("diff")}>はい（差分のみ）</button>
              <button style={{ ...btnBase, width: "100%", background: "#f8f9fa" }} onClick={() => executeImport("all")}>すべて追加（重複を許可）</button>
              <button style={{ ...btnBase, width: "100%", border: "none", color: "#999" }} onClick={() => { setShowImportConfirm(false); setPendingImports([]); }}>キャンセル</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "search") {
    return (
      <div style={{ padding: "40px 24px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <button style={{ marginBottom: "20px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff", cursor: "pointer" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h2 style={{ marginBottom: "20px" }}>単語を検索</h2>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input style={{ ...searchInputStyle, paddingRight: "80px" }} placeholder="単語を2文字以上入力..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
          <div style={{ position: "absolute", right: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            {searchQuery && <span onClick={() => setSearchQuery("")} style={{ fontSize: "20px", color: "#ccc", cursor: "pointer", padding: "5px" }}>✕</span>}
            <span onClick={() => startListening("search", "en-US")} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              {isListening === "search" ? <svg width="24" height="24"><rect x="6" y="6" width="12" height="12" rx="2" fill="#f44336"/></svg> : <svg width="24" height="24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#2196f3"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#2196f3"/></svg>}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "left", marginTop: "20px" }}>
          {searchResults.map((e, idx) => (
            <div key={idx} style={{ padding: "16px", borderBottom: "1px solid #eee", cursor: "pointer", background: "#fff", borderRadius: "8px", marginBottom: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }} onClick={() => setSelectedSearchEntry(e)}>
              <div>
                <div style={{ fontWeight: "bold", fontSize: "18px" }}>{e.word} {e.level && <span style={{ fontSize: "12px", color: "#2196f3", marginLeft: "5px" }}>[{e.level}]</span>}</div>
                <div style={{ fontSize: "14px", color: "#666" }}>{e.meaning}</div>
              </div>
              {priorityWords[e.word] && <span style={{ color: "#ef6c00" }}>★</span>}
            </div>
          ))}
        </div>

        {selectedSearchEntry && (
          <div style={modalOverlay} onClick={() => setSelectedSearchEntry(null)}>
            <div style={{...modalContent, position: "relative"}} onClick={e => e.stopPropagation()}>
              <div 
                style={{ position: "absolute", top: "15px", right: "15px", padding: "12px", fontSize: "28px", cursor: "pointer", color: priorityWords[selectedSearchEntry.word] ? "#FFD700" : "#e0e0e0", textShadow: priorityWords[selectedSearchEntry.word] ? "0 0 2px rgba(0,0,0,0.2)" : "none", zIndex: 5 }} 
                onClick={(e) => togglePriority(e, selectedSearchEntry.word)}
              >
                {priorityWords[selectedSearchEntry.word] ? "★" : "☆"}
              </div>

              {priorityToast && (
                <div style={{ position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontSize: "14px", zIndex: 10, pointerEvents: "none", width: "max-content" }}>
                  {priorityToast}
                </div>
              )}

              <h2 style={{ fontSize: "32px", marginBottom: "5px" }}>{selectedSearchEntry.word}</h2>
              {selectedSearchEntry.level && <div style={{ color: "#2196f3", fontWeight: "bold", marginBottom: "10px" }}>Oxford/CEFR: {selectedSearchEntry.level}</div>}
              <div style={{ fontSize: "22px", color: "#d32f2f", fontWeight: "bold", marginBottom: "20px" }}>{selectedSearchEntry.meaning}</div>
              
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <button 
                  disabled={hasMissedInSearch}
                  style={{ 
                      ...btnBase, 
                      flex: 1, 
                      height: "40px", 
                      margin: 0, 
                      background: hasMissedInSearch ? "#eee" : "#fff5f5", 
                      color: hasMissedInSearch ? "#999" : "#d32f2f", 
                      border: hasMissedInSearch ? "1px solid #ccc" : "1px solid #d32f2f", 
                      fontSize: "13px",
                      cursor: hasMissedInSearch ? "default" : "pointer"
                  }}
                  onClick={() => handleWrong(selectedSearchEntry.word)}
                >
                  ミス+1 ({mistakes[selectedSearchEntry.word] || 0})
                </button>
              </div>

              <div style={{ textAlign: "left", background: "#f9f9f9", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
                <div style={{ fontSize: "16px", marginBottom: "10px", lineHeight: "1.5" }}>{renderWithBold(selectedSearchEntry.sentence)}</div>
                <div style={{ fontSize: "14px", color: "#666", lineHeight: "1.4" }}>{selectedSearchEntry.sentence_jp}</div>
              </div>
              <div style={{ fontSize: "12px", color: "#bbb", marginBottom: "25px" }}>Source: {selectedSearchEntry.source}</div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                    style={{ ...btnBase, flex: 1, background: "#333", color: "#fff" }} 
                    onClick={() => {
                        const entry = selectedSearchEntry;
                        setSelectedSearchEntry(null);
                        startTest(null, entry);
                    }}
                >
                    カードを開く
                </button>
                <button style={{ ...btnBase, flex: 1, background: "#fff", color: "#333" }} onClick={() => setSelectedSearchEntry(null)}>閉じる</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "duplicateFileSelect") {
    return (
      <div
        style={{
          padding: "40px 24px",
          maxWidth: "600px",
          margin: "0 auto",
          textAlign: "center"
        }}
      >
        <h3 style={{ fontSize: "20px", marginBottom: "20px" }}>
          重複チェック対象ファイル
        </h3>

        <div
          style={{
            textAlign: "left",
            borderTop: "1px solid #eee",
            maxWidth: "360px",
            margin: "0 auto"
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              padding: "15px 0",
              borderBottom: "1px solid #eee",
              cursor: "pointer"
            }}
          >
            <input
              type="checkbox"
              checked={dupCheckAllFiles}
              onChange={(e) => {
                const checked = e.target.checked;

                setDupCheckAllFiles(checked);

                if (checked) {
                  setSelectedDuplicateFiles([]);
                }
              }}
              style={{
                width: "20px",
                height: "20px",
                marginRight: "12px"
              }}
            />
            <span style={{ fontWeight: "700" }}>
              すべてのファイル
            </span>
          </label>

          {fileList.map(file => (
            <label
              key={file}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "15px 0",
                borderBottom: "1px solid #eee",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={
                  !dupCheckAllFiles &&
                  selectedDuplicateFiles.includes(file)
                }
                onChange={(e) => {
                  const checked = e.target.checked;

                  setDupCheckAllFiles(false);

                  setSelectedDuplicateFiles(prev => {
                    if (checked) {
                      return [...prev, file];
                    }

                    return prev.filter(f => f !== file);
                  });
                }}
                style={{
                  width: "20px",
                  height: "20px",
                  marginRight: "12px"
                }}
              />

              <span>{file}</span>
            </label>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            marginTop: 24
          }}
        >
          <button
            style={{
              ...btnBase,
              width: "240px",
              background: "#1976d2",
              borderColor: "#1976d2",
              color: "#fff"
            }}
            onClick={() => {
              setDupCurrentPage(1);
              setScreen("duplicates");
            }}
          >
            重複チェック開始
          </button>

          <button
            style={{
              ...btnBase,
              width: "240px"
            }}
            onClick={() => setScreen("home")}
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (screen === "duplicates") {
    const dupGroups = getDuplicateGroups();
    const itemsPerPage = 5;
    const maxPage = Math.ceil(dupGroups.length / itemsPerPage) || 1;
    const currentGroups = dupGroups.slice((dupCurrentPage - 1) * itemsPerPage, dupCurrentPage * itemsPerPage);

    return (
      <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <button style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("home")}>← 戻る</button>
            <h3 style={{ margin: 0 }}>重複レコードの編集</h3>
            <div style={{ width: "60px" }}></div>
        </div>
        
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "30px" }}>重複している単語が {dupGroups.length} 件見つかりました。</p>

        <div style={{ textAlign: "left" }}>
          {currentGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: "40px", border: "1px solid #eee", borderRadius: "16px", padding: "20px", background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "15px" }}>
                <span style={{ fontSize: "20px", fontWeight: "bold" }}>{group[0].word}</span>
                <button 
                  style={{ padding: "6px 12px", borderRadius: "6px", background: "#333", color: "#fff", fontSize: "13px", border: "none" }}
                  onClick={() => {
                    setDupMergeTarget(group);
                    setMergeSelections({ 
                        word: group[0].word,
                        meaning: group[0].meaning,
                        sentence: group[0].sentence,
                        sentence_jp: group[0].sentence_jp,
                        level: group[0].level || "",
                        source: group[0].source 
                    });
                    setScreen("mergeSelection");
                  }}
                >
                  統合・整理する
                </button>
              </div>

              {group.map((item, iIdx) => (
                <div key={item.id || iIdx} style={{ fontSize: "14px", padding: "12px", borderBottom: iIdx === group.length - 1 ? "none" : "1px dashed #ddd" }}>
                  <div style={{ color: "#d32f2f", fontWeight: "bold" }}>{item.meaning}</div>
                  <div style={{ color: "#555", marginTop: "4px" }}>{item.sentence}</div>
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>Source: {item.source} {item.level && `[Level: ${item.level}]`}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {maxPage > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "30px" }}>
            <button disabled={dupCurrentPage === 1} onClick={() => setDupCurrentPage(1)} style={{ padding: "8px" }}>&lt;&lt;</button>
            <button disabled={dupCurrentPage === 1} onClick={() => setDupCurrentPage(p => p - 1)} style={{ padding: "8px" }}>&lt;</button>
            <span style={{ margin: "0 10px", fontSize: "14px" }}>{dupCurrentPage} / {maxPage}</span>
            <button disabled={dupCurrentPage === maxPage} onClick={() => setDupCurrentPage(p => p + 1)} style={{ padding: "8px" }}>&gt;</button>
            <button disabled={dupCurrentPage === maxPage} onClick={() => setDupCurrentPage(maxPage)} style={{ padding: "8px" }}>&gt;&gt;</button>
          </div>
        )}
      </div>
    );
  }

  if (screen === "mergeSelection") {
    const uniqueSources = [...new Set(dupMergeTarget?.map(item => item.source))];

    return (
        <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
            <button style={{ marginBottom: "20px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("duplicates")}>← 戻る</button>
            <h3 style={{ marginBottom: "10px" }}>残す項目を選択してください</h3>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "30px" }}>どのファイルに紐付け、どの内容を残すか選んでください。</p>

            <div style={{ textAlign: "left", background: "#f0f7ff", padding: "15px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #cde4ff" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "10px", color: "#0056b3" }}>1. 紐付けるソースファイルを選択:</div>
                {uniqueSources.map(src => (
                    <label key={src} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", cursor: "pointer", fontSize: "14px" }}>
                        <input 
                            type="radio" name="source_select" 
                            checked={mergeSelections.source === src}
                            onChange={() => setMergeSelections({...mergeSelections, source: src})}
                        />
                        {src}
                    </label>
                ))}
            </div>

            <div style={{ textAlign: "left", fontSize: "13px", fontWeight: "bold", marginBottom: "10px" }}>2. 残す内容(語義・例文)を選択:</div>
            {dupMergeTarget?.map((item, idx) => (
                <div key={idx} style={{ textAlign: "left", border: "1px solid #ddd", borderRadius: "12px", padding: "15px", marginBottom: "20px", background: "#fdfdfd" }}>
                    <div style={{ fontSize: "12px", color: "#888", marginBottom: "10px", borderBottom: "1px solid #eee" }}>候補 {idx + 1} (Source: {item.source})</div>
                    
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px", cursor: "pointer" }}>
                        <input 
                            type="radio" name="meaning" 
                            checked={mergeSelections.meaning === item.meaning}
                            onChange={() => setMergeSelections({...mergeSelections, meaning: item.meaning, level: item.level || ""})}
                        />
                        <div style={{ fontSize: "15px" }}>
                            <strong>語義:</strong> {item.meaning} 
                            {item.level && <span style={{ color: "#2196f3" }}> [{item.level}]</span>}
                        </div>
                    </label>

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input 
                            type="radio" name="usage" 
                            checked={mergeSelections.sentence === item.sentence}
                            onChange={() => setMergeSelections({...mergeSelections, sentence: item.sentence, sentence_jp: item.sentence_jp})}
                        />
                        <div style={{ fontSize: "15px" }}>
                            <strong>例文:</strong> {item.sentence}<br/>
                            <span style={{ fontSize: "13px", color: "#666" }}>{item.sentence_jp}</span>
                        </div>
                    </label>
                </div>
            ))}

            <div style={{ marginTop: "40px", borderTop: "2px solid #eee", paddingTop: "30px" }}>
                <button 
                    style={{ ...btnBase, background: "#333", color: "#fff" }} 
                    onClick={() => {
                        setFinalMergeData({ ...mergeSelections });
                        setScreen("mergeFinal");
                    }}
                >
                    次へ進む
                </button>
            </div>
        </div>
    );
  }

  if (screen === "mergeFinal") {
    return (
        <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
            <h3>統合内容の最終確認</h3>
            <div style={{ textAlign: "left", background: "#fff", padding: "20px", borderRadius: "16px", border: "2px solid #333" }}>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>英単語</label>
                    <input style={{ ...textareaStyle, minHeight: "40px", fontWeight: "bold", fontSize: "20px" }} value={finalMergeData.word} onChange={e => setFinalMergeData({...finalMergeData, word: e.target.value})} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>語義 (日本語)</label>
                    <textarea style={textareaStyle} value={finalMergeData.meaning} onChange={e => setFinalMergeData({...finalMergeData, meaning: e.target.value})} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>単語レベル (Oxford/CEFR)</label>
                    <input style={{ ...textareaStyle, minHeight: "40px" }} value={finalMergeData.level} placeholder="B1, B2など" onChange={e => setFinalMergeData({...finalMergeData, level: e.target.value})} />
                </div>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>例文 (英語)</label>
                    <textarea style={textareaStyle} value={finalMergeData.sentence} onChange={e => setFinalMergeData({...finalMergeData, sentence: e.target.value})} />
                </div>
                <div>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>例文の訳</label>
                    <textarea style={textareaStyle} value={finalMergeData.sentence_jp} onChange={e => setFinalMergeData({...finalMergeData, sentence_jp: e.target.value})} />
                </div>
            </div>

            <p style={{ marginTop: "30px", fontWeight: "bold" }}>この形で統合しますか？</p>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
                <button 
                    style={{ ...btnBase, width: "120px", background: "#333", color: "#fff" }}
                    onClick={() => {
                        const targetWord = dupMergeTarget[0].word;
                        const filtered = entries.filter(e => e.word !== targetWord);
                        const newEntry = {
                            ...finalMergeData,
                            id: Date.now(),
                            source: finalMergeData.source 
                        };
                        setEntries([...filtered, newEntry]);
                        setScreen("duplicates");
                    }}
                >
                    はい
                </button>
                <button 
                    style={{ ...btnBase, width: "120px", background: "#fff" }}
                    onClick={() => setScreen("mergeSelection")}
                >
                    いいえ
                </button>
            </div>
        </div>
    );
  }

  if (screen === "exportList") {
      return (
          <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
              <button style={{ marginBottom: "30px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("home")}>← 戻る</button>
              <h3>CSVファイルの書き出し</h3>
              
              <div style={{ textAlign: "left", background: "#fffbe6", padding: "15px", borderRadius: "12px", border: "1px solid #ffe58f", marginBottom: "30px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 8px 0", color: "#856404" }}>💡 保存先のフォルダを選択したい場合</p>
                  <p style={{ fontSize: "12px", color: "#856404", margin: 0, lineHeight: "1.5" }}>
                      ブラウザの設定で<b>「ダウンロード前に各ファイルの保存場所を確認する」</b>をONにすると、Officeアプリのように保存ウィンドウが表示されます。
                  </p>
              </div>

              <div style={{ textAlign: "left", background: "#f9f9f9", padding: "15px", borderRadius: "12px", marginBottom: "30px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                      <input type="checkbox" checked={exportAsCopy} onChange={() => setExportAsCopy(!exportAsCopy)} />
                      ファイル名に "_updated" を付加する
                  </label>
              </div>

              <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}>書き出すファイルを選択：</p>
                  {fileList.map(file => (
                      <button 
                        key={file} 
                        style={{ ...btnBase, width: "100%", justifyContent: "space-between", padding: "0 20px", marginBottom: "12px" }}
                        onClick={() => handleExportCSV(file)}
                      >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{file}</span>
                          <span style={{ fontSize: "12px", background: "#eee", padding: "4px 8px", borderRadius: "4px", flexShrink: 0 }}>保存実行 ➔</span>
                      </button>
                  ))}
              </div>
          </div>
      );
  }

  if (screen === "test") {
    return (
      <div 
        style={{ textAlign: "center", padding: "20px", maxWidth: "500px", margin: "0 auto", minHeight: "100vh", overflowX: "hidden" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <button style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: "14px" }} onClick={() => setScreen("home")}>［ホームへ］</button>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#666" }}>{index + 1} / {pool.length}</div>
        </div>

        <div onClick={() => setStep(s => Math.min(s + 1, 2))} style={cardStyle}>
          <div style={{ position: "absolute", top: "15px", left: "15px", padding: "12px", fontSize: "24px", cursor: "pointer", opacity: 0.3 }} onClick={(e) => { e.stopPropagation(); setShowEditMenu(true); }}>⋮</div>
          
          <div 
            style={{ position: "absolute", top: "15px", right: "15px", padding: "12px", fontSize: "28px", cursor: "pointer", color: priorityWords[current?.word] ? "#FFD700" : "#e0e0e0", textShadow: priorityWords[current?.word] ? "0 0 2px rgba(0,0,0,0.2)" : "none", zIndex: 5 }} 
            onClick={(e) => togglePriority(e, current?.word)}
          >
            {priorityWords[current?.word] ? "★" : "☆"}
          </div>

          {priorityToast && (
            <div style={{ position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontSize: "14px", zIndex: 10, pointerEvents: "none", width: "max-content" }}>
              {priorityToast}
            </div>
          )}

          <div style={{ margin: "10px 0 10px 0" }}>
            <h2 style={{ fontSize: "36px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {current?.word}
              <span style={{ cursor: "pointer", marginLeft: "20px", fontSize: "30px", filter: "grayscale(1)" }} onClick={(e) => { e.stopPropagation(); speak(current.word); }}>🔊</span>
            </h2>
            {current?.level && <div style={{ color: "#2196f3", fontWeight: "bold", fontSize: "14px", marginTop: "5px" }}>{current.level}</div>}
          </div>

          <div style={{ minHeight: "60px", width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: "10px" }}>
            {step >= 1 && (
              <div style={{ fontSize: "19px", color: "#444", lineHeight: "1.5" }}>
                {renderWithBold(current.sentence)}
              </div>
            )}
          </div>

          <div style={{ width: "100%", marginTop: "10px" }}>
            {step === 2 && (
              <div style={{ borderTop: "2px solid #f0f0f0", paddingTop: "20px" }}>
                <div style={{ fontWeight: "bold", fontSize: "24px", color: "#d32f2f", marginBottom: "10px" }}>{current.meaning}</div>
                <div style={{ fontSize: "17px", color: "#777", lineHeight: "1.5" }}>{current.sentence_jp}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto", paddingTop: "20px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "12px", color: "#bbb" }}>Source: {current?.source}</div>
          </div>
        </div>

        <div style={{ marginTop: "40px" }}>
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginBottom: "15px" }}>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#f1f3f5", border: "none" }} onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={history.length === 0}>&lt; 戻る</button>
            <button style={{ ...btnBase, width: "120px", margin: 0, background: "#333", color: "#fff", border: "none" }} onClick={(e) => { e.stopPropagation(); handleNext(); }}>次へ &gt;</button>
          </div>
          <button 
            style={{ 
              ...btnBase, 
              background: hasMissedInTest ? "#ffebee" : "#fff5f5", 
              borderColor: hasMissedInTest ? "#ffcdd2" : "#ff4d4d", 
              color: hasMissedInTest ? "#ef9a9a" : "#ff4d4d", 
              fontWeight: "bold", 
              height: "60px", 
              fontSize: "18px",
              cursor: hasMissedInTest ? "default" : "pointer"
            }} 
            disabled={hasMissedInTest}
            onClick={(e) => { e.stopPropagation(); handleWrong(); }}
          >
            {hasMissedInTest ? "ミス記録済み" : "間違えた"}
          </button>
        </div>

        {showEditMenu && (
          <div style={modalOverlay} onClick={() => setShowEditMenu(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: "20px", marginBottom: "10px" }}>単語の設定</h3>
              <p style={{ fontSize: "13px", color: "#aaa", marginBottom: "30px" }}>Source: {current?.source}</p>
              
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => { setEditData({ ...current }); setIsEditing(true); }}>✎ 登録内容を編集</button>
              
              <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
                <button style={{ ...btnBase, width: "100%", background: "#fff", color: "#666", border: "1px solid #ccc", fontSize: "14px", height: "44px" }} onClick={() => { setShowEditMenu(false); setConfirmClearMistake(true); }}>この単語のミス回数をリセット</button>
                <button style={{ ...btnBase, width: "100%", background: "#fff", color: "#e53935", border: "1px solid #e53935", fontSize: "14px", height: "44px" }} onClick={() => { setShowEditMenu(false); setConfirmDeleteWord(true); }}>この単語を削除</button>
              </div>

              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "10px", background: "#f5f5f5", color: "#333" }} onClick={() => setShowEditMenu(false)}>閉じる</button>
            </div>
          </div>
        )}

        {confirmDeleteWord && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "600", color: "#e53935", marginBottom: "10px" }}>単語の削除</p>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "30px" }}>このレコードを完全に削除しますか？</p>
              <button style={{ ...btnBase, width: "100%", background: "#e53935", color: "#fff", border: "none" }} onClick={() => {
                const updated = entries.filter(e => e.id !== current.id);
                setEntries(updated);
                const newPool = pool.filter(e => e.id !== current.id);
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
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>単語レベル (Oxford等)</label>
                <input style={{ ...textareaStyle, minHeight: "40px" }} value={editData.level} placeholder="B1, B2など" onChange={e => setEditData({ ...editData, level: e.target.value })} />
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
                const updated = entries.map(e => e.id === current.id ? { ...e, ...editData } : e);
                setEntries(updated);
                setPool(pool.map(e => e.id === current.id ? { ...e, ...editData } : e));
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

  if (screen === "reviewSelect") {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: "8px" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h3 style={{ fontSize: "22px", marginBottom: "40px" }}>復習範囲を選択</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "50px" }}>
          
          <label style={{ display: "flex", alignItems: "center", padding: "20px", border: reviewRange === "srs" ? "2px solid #2196f3" : "1px solid #ddd", borderRadius: "15px", background: reviewRange === "srs" ? "#e3f2fd" : "white", cursor: "pointer" }}>
            <input type="radio" checked={reviewRange === "srs"} onChange={() => setReviewRange("srs")} style={{ width: "20px", marginRight: "15px" }} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: "bold", fontSize: "16px", color: reviewRange === "srs" ? "#1976d2" : "#333" }}>忘却曲線に基づく最適な復習</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>AIが次回復習日を自動計算します（推奨）</div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "center", padding: "20px", border: reviewRange === "today" ? "2px solid #333" : "1px solid #ddd", borderRadius: "15px", background: reviewRange === "today" ? "#f0f0f0" : "white", cursor: "pointer" }}>
            <input type="radio" checked={reviewRange === "today"} onChange={() => setReviewRange("today")} style={{ width: "20px", marginRight: "15px" }} />
            <span style={{ fontWeight: "600" }}>今日ミスした単語</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", padding: "20px", border: reviewRange === "yesterday" ? "2px solid #333" : "1px solid #ddd", borderRadius: "15px", background: reviewRange === "yesterday" ? "#f0f0f0" : "white", cursor: "pointer" }}>
            <input type="radio" checked={reviewRange === "yesterday"} onChange={() => setReviewRange("yesterday")} style={{ width: "20px", marginRight: "15px" }} />
            <span style={{ fontWeight: "600" }}>昨日ミスした単語</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", padding: "20px", border: reviewRange === "week" ? "2px solid #333" : "1px solid #ddd", borderRadius: "15px", background: reviewRange === "week" ? "#f0f0f0" : "white", cursor: "pointer" }}>
            <input type="radio" checked={reviewRange === "week"} onChange={() => setReviewRange("week")} style={{ width: "20px", marginRight: "15px" }} />
            <span style={{ fontWeight: "600" }}>1週間以内のミス</span>
          </label>

        </div>
        <button style={{ ...btnBase, background: "#333", color: "#fff" }} onClick={() => startTest("review")}>テスト開始</button>
      </div>
    );
  }

  if (screen === "ranking") {
    const aggregate = {};
    entries.forEach(e => {
        const miss = mistakes[e.word] || 0;
        if (miss > 0) {
            if (!aggregate[e.word]) {
                aggregate[e.word] = { ...e, count: miss };
            }
        }
    });

    const sorted = Object.values(aggregate).sort((a, b) => b.count - a.count);
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
              
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <div style={{ color: "#d32f2f", fontWeight: "bold" }}>{e.count} miss</div>
                <div style={{ cursor: "pointer", fontSize: "20px" }} onClick={() => setRankingMemoEntry(e)}>📝</div>
              </div>
            </div>
          ))}
        </div>
        
        {maxPage > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "20px" }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(1)} style={{ padding: "8px" }}>&lt;&lt;</button>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: "8px" }}>&lt;</button>
            <span style={{ margin: "0 10px", fontSize: "14px" }}>{currentPage} / {maxPage}</span>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "8px" }}>&gt;</button>
            <button disabled={currentPage === maxPage} onClick={() => setCurrentPage(maxPage)} style={{ padding: "8px" }}>&gt;&gt;</button>
          </div>
        )}

        {rankingMemoEntry && (
          <div style={modalOverlay} onClick={() => setRankingMemoEntry(null)}>
            <div style={{ ...modalContent, padding: "40px 24px", position: "relative" }} onClick={e => e.stopPropagation()}>
              <div 
                style={{ position: "absolute", top: "15px", right: "20px", fontSize: "28px", cursor: "pointer", color: "#999", lineHeight: "1" }}
                onClick={() => setRankingMemoEntry(null)}
              >
                ×
              </div>
              <h2 style={{ fontSize: "32px", marginBottom: "5px" }}>{rankingMemoEntry.word}</h2>
              {rankingMemoEntry.level && <div style={{ color: "#2196f3", fontWeight: "bold", marginBottom: "10px" }}>Oxford/CEFR: {rankingMemoEntry.level}</div>}
              <div style={{ fontSize: "22px", color: "#d32f2f", fontWeight: "bold", marginBottom: "20px" }}>{rankingMemoEntry.meaning}</div>
              
              <div style={{ textAlign: "left", background: "#f9f9f9", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
                <div style={{ fontSize: "16px", marginBottom: "10px", lineHeight: "1.5" }}>{renderWithBold(rankingMemoEntry.sentence)}</div>
                <div style={{ fontSize: "14px", color: "#666", lineHeight: "1.4" }}>{rankingMemoEntry.sentence_jp}</div>
              </div>
              <div style={{ fontSize: "12px", color: "#bbb" }}>Source: {rankingMemoEntry.source}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "fileDelete") {
    return (
      <div style={{ padding: "50px 24px", textAlign: "center", maxWidth: "500px", margin: "0 auto" }}>
        <button style={{ marginBottom: "30px", padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff" }} onClick={() => setScreen("home")}>← 戻る</button>
        <h3>削除するデータを選択</h3>
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
              <p style={{ fontWeight: "bold", color: "#d32f2f" }}>このファイルのデータを削除しますか？</p>
              <p style={{ fontSize: "13px", color: "#888", marginTop: "10px" }}>※実際のファイル自体は削除されません。</p>
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

export default App;
