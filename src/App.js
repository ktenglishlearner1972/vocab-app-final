import React, { useState, useEffect, useRef } from "react";

/* =========================================================
   1. Logic & Helpers
   ========================================================= */

function MemoIcon({ hasMemo, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
        fill={hasMemo ? "#4caf50" : "#b0bec5"}
      />
    </svg>
  );
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 【追加】英単語＋ファイル名から「最大10桁の符号なし32ビット整数」を生成するハッシュ関数
function generateHashId(word, source) {
  const str = `${word}||${source}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return hash >>> 0; 
}

// 【修正】ミス回数の判定キーを e.word から e.id に変更
function buildWeakPool(entries, mistakes) {
  const pool = [];
  for (const e of entries) {
    const count = mistakes[e.id] || 0;
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
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
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
  minHeight: "360px",
  height: "auto",
  marginTop: "20px",
  cursor: "pointer",
  userSelect: "text",
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
    meaning: "",
    sentence: "",
    sentence_jp: "",
    level: "" 
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
  const [searchMeaningQuery, setSearchMeaningQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchEntry, setSelectedSearchEntry] = useState(null);
  const [rankingMemoEntry, setRankingMemoEntry] = useState(null);
  const [priorityToast, setPriorityToast] = useState("");
  const priorityToastTimer = useRef(null);

  const [pendingImports, setPendingImports] = useState([]);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  
  const [testResultsFile, setTestResultsFile] = useState(null);
  const [showTestResultsImportConfirm, setShowTestResultsImportConfirm] = useState(false);

  const [hasMissedInTest, setHasMissedInTest] = useState(false);
  const [hasMissedInSearch, setHasMissedInSearch] = useState(false);

  const [wordRecordFile, setWordRecordFile] = useState(null);
  const [showWordRecordImportConfirm, setShowWordRecordImportConfirm] = useState(false);

  const [pendingTestMode, setPendingTestMode] = useState(null);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showFreshSessionConfirm, setShowFreshSessionConfirm] = useState(false);
  const [formatWarningData, setFormatWarningData] = useState(null);

  const [currentTestMode, setCurrentTestMode] = useState(null);
  const [activeSessions, setActiveSessions] = useState({});
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [sessionMissedWords, setSessionMissedWords] = useState([]); 

  const [touchStartObj, setTouchStartObj] = useState(null);
  const [touchEndObj, setTouchEndObj] = useState(null);

  const [memoModalEntry, setMemoModalEntry] = useState(null);
  const [isMemoEditing, setIsMemoEditing] = useState(false);
  const [editMemoText, setEditMemoText] = useState("");

  // 【追加】肥大化した古いセッションデータ（pool全体）を軽量なID配列（poolIds）に変換・クリーンアップする処理
  useEffect(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("testSession_")) {
        try {
          const session = JSON.parse(localStorage.getItem(key));
          // pool（完全なオブジェクト配列）が存在していれば、IDだけの軽量配列(poolIds)に変換してクリーンアップ
          if (session && session.pool && !session.poolIds) {
            session.poolIds = session.pool.map(item => item.id || item);
            delete session.pool; 
            localStorage.setItem(key, JSON.stringify(session));
          }
        } catch(e) {}
      }
    }
  }, []);

  // 【修正】セッション保存時、単語オブジェクト全体(pool)ではなく、IDの配列(poolIds)だけを保存してサイズを極小化する
  useEffect(() => {
    if (screen === "test" && pool.length > 0 && currentTestMode && currentTestMode !== "single") {
      const session = {
        date: new Date().toDateString(),
        poolIds: pool.map(e => e.id),
        index, step, history, hasMissedInTest, 
        sessionMissedWords: sessionMissedWords || []
      };
      localStorage.setItem(`testSession_${currentTestMode}`, JSON.stringify(session));
    }
  }, [screen, pool, index, step, history, hasMissedInTest, currentTestMode, sessionMissedWords]);

  // 【修正】引数を word から entryId に変更
  const togglePriority = (e, entryId) => {
    e.stopPropagation();
    setPriorityWords(prev => {
      const next = { ...prev };
      const isPriority = !!next[entryId];
      if (isPriority) {
        delete next[entryId];
        showPriorityToast("最優先指定を解除しました。");
      } else {
        next[entryId] = true;
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
    if (screen === "test" && pool.length > 0 && currentTestMode && currentTestMode !== "single") {
      const session = {
        date: new Date().toDateString(),
        pool, index, step, history, hasMissedInTest, sessionMissedWords
      };
      localStorage.setItem(`testSession_${currentTestMode}`, JSON.stringify(session));
    }
  }, [screen, pool, index, step, history, hasMissedInTest, currentTestMode]);

  // 【追加】テスト中、現在のインデックスが幽霊ID（削除済）であれば自動的に次にスキップする
  useEffect(() => {
    if (screen === "test" && pool.length > 0 && index < pool.length) {
      const currentWord = pool[index];
      const exists = entries.some(e => e.id === currentWord.id);
      
      if (!exists) {
        if (index >= pool.length - 1) {
          setShowFinishConfirm(true);
        } else {
          setIndex(index + 1);
          setStep(0);
        }
      }
    }
  }, [screen, pool, index, entries]);

  useEffect(() => {
    const qWord = searchQuery.toLowerCase();
    const qMeaning = searchMeaningQuery;
    
    if (qWord.length >= 2 || qMeaning.length >= 1) {
      const startsWithGroup = []; 
      const includesGroup = [];   
      const meaningOnlyGroup = []; 

      entries.forEach(e => {
        let matchMeaning = true;
        if (qMeaning.length >= 1) {
          matchMeaning = e.meaning && e.meaning.includes(qMeaning);
        }
        if (!matchMeaning) return;
        
        if (qWord.length >= 2) {
          const wLower = e.word.toLowerCase();
          if (wLower.startsWith(qWord)) {
            startsWithGroup.push(e);
          } else if (qWord.length >= 3 && wLower.includes(qWord)) {
            includesGroup.push(e);
          }
        } else {
          meaningOnlyGroup.push(e);
        }
      });
      
      if (qWord.length >= 2) {
        setSearchResults([...startsWithGroup, ...includesGroup]);
      } else {
        setSearchResults(meaningOnlyGroup);
      }
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchMeaningQuery, entries]);

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
        } else if (target === "searchMeaning") {
          setSearchMeaningQuery(transcript);
        } else if (target === "memo") {
          setEditMemoText(prev => (prev || "") + transcript);
        } else {
          setEditData(prev => ({ ...prev, [target]: (prev[target] || "") + transcript }));
        }
      }
    };
    recognition.onend = () => setIsListening(null);
  };

  const handleStartTest = (mode, singleEntry = null) => {
    if (singleEntry) {
      setCurrentTestMode("single");
      startTest(mode, singleEntry);
      return;
    }
    if (activeSessions[mode]) {
      resumeSession(mode); 
      return;
    }
    try {
      const savedSession = localStorage.getItem(`testSession_${mode}`);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.pool && parsed.pool.length > 0 && parsed.index < parsed.pool.length) {
          setPendingTestMode(mode);
          setShowResumeConfirm(true);
          return;
        }
      }
    } catch (e) {
      localStorage.removeItem(`testSession_${mode}`);
    }
    startTest(mode);
  };

  // 【修正】すべてのフィルター・ソート基準を e.word から e.id に変更
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
      let sorted = [...base].sort((a, b) => {
        const statA = testStats[a.id] || { presented: 0, lastTested: 0 };
        const statB = testStats[b.id] || { presented: 0, lastTested: 0 };
        if (statA.presented !== statB.presented) return statA.presented - statB.presented;
        return statA.lastTested - statB.lastTested;
      });

      const chunked = {};
      sorted.forEach(e => {
        const pres = testStats[e.id]?.presented || 0;
        if (!chunked[pres]) chunked[pres] = [];
        chunked[pres].push(e);
      });
      let finalPool = [];
      Object.keys(chunked).sort((a,b) => Number(a)-Number(b)).forEach(key => {
        finalPool = finalPool.concat(shuffle(chunked[key]));
      });

      const difficultWords = [...base].filter(e => (mistakes[e.id] || 0) > 0)
        .sort((a, b) => {
          const rateA = (mistakes[a.id]||0) / ((testStats[a.id]?.presented)||1);
          const rateB = (mistakes[b.id]||0) / ((testStats[b.id]?.presented)||1);
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
        finalPool = [...new Map(finalPool.map(item => [item.id, item])).values()];
      }
      p = finalPool;

    } else if (mode === "weak") {
      p = buildWeakPool(base, mistakes);
    } else if (mode === "priority") {
      p = shuffle(base.filter(e => priorityWords[e.id]));
    } else if (mode && mode.startsWith("review")) {
      const actualRange = mode === "review" ? reviewRange : mode.replace("review_", "");
      const now = Date.now();

      // 【②の解決】選択された瞬間に localStorage から最新のログを直接取得してタイムラグを無くす
      const latestSrsStr = localStorage.getItem("word_trainer_srs") || "{}";
      const latestMistakeStr = localStorage.getItem("word_trainer_mistakes") || "{}";
      const currentSrsData = JSON.parse(latestSrsStr);
      const currentMistakeLog = JSON.parse(latestMistakeStr);
      
      if (actualRange === "srs") {
        // ① 忘却曲線（SRS）ベースのフィルタリング
        p = shuffle(base.filter(e => {
          // 現在のハッシュID生成仕様に合わせてログを参照
          const hashId = generateHashId(e.word, e.source);
          const srs = currentSrsData[hashId];
          
          // 【①の解決】一度もミスしたことがない（ログがない、または次回復習時刻がない）単語は確実に除外
          if (!srs || !srs.nextReview) return false;
          
          return srs.nextReview <= now;
        }));
        if (p.length === 0) {
          alert("現在、忘却曲線に基づき復習が必要な単語はありません。素晴らしいペースです！");
          return;
        }
      } else {
        const start = new Date(now);
        let end = new Date(now);
        
        if (actualRange === "today") {
          start.setHours(0, 0, 0, 0);
        } else if (actualRange === "yesterday") {
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
        } else if (actualRange === "week") {
          start.setDate(start.getDate() - 6);
          start.setHours(0, 0, 0, 0);
        }
        
        // ②・③ 今日・昨日・1週間以内のミスログベースのフィルタリング
        p = shuffle(base.filter(e => {
          // 現在のハッシュID生成仕様に合わせてログを参照
          const hashId = generateHashId(e.word, e.source);
          const logs = currentMistakeLog[hashId] || [];
          
          // 【③の解決】ミス記録（配列）が空のものは除外
          if (logs.length === 0) return false;
          
          return logs.some(timestamp => {
            const d = new Date(timestamp); 
            return d >= start && d <= end;
          });
        }));
        
        if (p.length === 0) {
          alert("該当する期間にミスした単語はありません。");
          return;
        }
      }
    }

    setPool(p);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setHasMissedInTest(false);
    setSessionMissedWords([]);
    setCurrentTestMode(mode);
    setActiveSessions(prev => ({ ...prev, [mode]: true }));
    setScreen("test");
  };

  const resumeSession = (modeToResume = pendingTestMode) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(`testSession_${modeToResume}`));
      
      let restoredPool = [];
      if (parsed.poolIds) {
        restoredPool = parsed.poolIds.map(id => entries.find(e => e.id === id) || { id, isGhost: true });
      } else if (parsed.pool) {
        restoredPool = parsed.pool.map(obj => entries.find(e => e.id === obj.id) || { id: obj.id, isGhost: true });
      }

      if (restoredPool.length === 0) throw new Error("Empty pool");

      setPool(restoredPool);
      setIndex(parsed.index || 0);
      setStep(parsed.step || 0);
      setHistory(parsed.history || []);
      setHasMissedInTest(parsed.hasMissedInTest || false);
      setSessionMissedWords(parsed.sessionMissedWords || []);
      
      setCurrentTestMode(modeToResume);
      setActiveSessions(prev => ({ ...prev, [modeToResume]: true }));
      setScreen("test");
    } catch (e) {
      startTest(modeToResume); 
    }
    setShowResumeConfirm(false);
    setPendingTestMode(null);
  };

  const startFreshSession = () => {
    localStorage.removeItem(`testSession_${pendingTestMode}`);
    startTest(pendingTestMode); 
    setShowResumeConfirm(false);
    setPendingTestMode(null);
  };

  const handleFinishClear = () => {
    localStorage.removeItem(`testSession_${currentTestMode}`);
    setActiveSessions(prev => {
      const next = { ...prev };
      delete next[currentTestMode];
      return next;
    });
    setCurrentTestMode(null);
    setShowFinishConfirm(false);
    setScreen("home");
  };

  const handleFinishKeep = () => {
    setShowFinishConfirm(false);
    setShowRetryConfirm(true); // リトライの選択ポップアップを開く
  };

  const handleRetrySame = () => {
    setIndex(0);
    setStep(0);
    setHistory([]);
    setHasMissedInTest(false);
    setSessionMissedWords([]); // 次の周回のためにミス記録をリセット
    setShowRetryConfirm(false);
  };

  const handleRetryMissed = () => {
    // セッション内のミス記録にあるIDだけで現在のpoolを絞り込む
    const newPool = pool.filter(e => sessionMissedWords.includes(e.id));
    if (newPool.length === 0) return;
    
    setPool(newPool);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setHasMissedInTest(false);
    setSessionMissedWords([]); // 次の周回のためにミス記録をリセット
    setShowRetryConfirm(false);
  };

  // 【修正】戻り先が幽霊IDなら自動的にさらに前へスキップする
  const handlePrev = () => {
    if(history.length > 0){
      const n = [...history]; 
      let p = n.pop(); 
      
      while (p !== undefined) {
        const prevWord = pool[p];
        if (entries.some(e => e.id === prevWord.id)) {
          setHistory(n); 
          setIndex(p); 
          setStep(0); 
          setHasMissedInTest(false);
          return;
        }
        p = n.pop();
      }
    }
  };

  // 【修正】キーを current.id に変更
  const handleNext = () => {
    if (!current) return;
    const id = current.id;
    const now = Date.now();
    
    setTestStats(prev => ({
        ...prev,
        [id]: { 
          presented: ((prev[id]?.presented) || 0) + 1, 
          lastTested: now 
        }
    }));

    setSrsData(prev => {
        const d = prev[id] || { interval: 0, rep: 0 };
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
        return { 
          ...prev, 
          [id]: { interval: newInterval, rep: newRep, nextReview } 
        };
    });

    setHasMissedInTest(false);
    
    if (typeof setIsErrorLogging === 'function') {
      setIsErrorLogging(false);
    }

    if (index >= pool.length - 1) {
      setShowFinishConfirm(true);
    } else {
      setHistory(prev => [...prev, index]);
      setIndex(index + 1);
      setStep(0); 
    }
  };

  // 【修正】キーを targetId / current.id に変更し、数値を直近5回に制限
  const handleWrong = (targetId) => {
    const id = targetId || current.id;
    const nowTime = Date.now();
    setMistakes(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setMistakeLog(prev => ({ ...prev, [id]: [...(prev[id] || []), nowTime].slice(-5) }));
    
    if (targetId) {
      setHasMissedInSearch(true);
    } else {
      setHasMissedInTest(true);
      setSessionMissedWords(prev => prev.includes(id) ? prev : [...prev, id]);
    }
  };

  // 【修正】一意のIDになったため isTarget が非常にシンプルに
  const handleSaveMemo = () => {
    if (!memoModalEntry) return;
    const wordId = memoModalEntry.id;
    
    const isTarget = (e) => e.id === wordId;

    const updatedEntries = entries.map(e => isTarget(e) ? { ...e, memo: editMemoText } : e);
    setEntries(updatedEntries);
    setPool(pool.map(e => isTarget(e) ? { ...e, memo: editMemoText } : e));
    
    if (selectedSearchEntry && isTarget(selectedSearchEntry)) {
      setSelectedSearchEntry(prev => ({ ...prev, memo: editMemoText }));
    }
    if (rankingMemoEntry && isTarget(rankingMemoEntry)) {
      setRankingMemoEntry(prev => ({ ...prev, memo: editMemoText }));
    }

    setMemoModalEntry(prev => ({ ...prev, memo: editMemoText }));
    setIsMemoEditing(false);
  };

  const renderMemoModal = () => {
    if (!memoModalEntry) return null;
    return (
      <div style={modalOverlay} onClick={() => { if (!isMemoEditing) setMemoModalEntry(null); }}>
        <div style={modalContent} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: "15px", marginBottom: "12px", fontWeight: "bold" }}>
            【{memoModalEntry.word}】のメモ
          </h3>
          
          {!isMemoEditing ? (
            <>
              <div style={{ 
                fontSize: "16px", 
                textAlign: "left", 
                minHeight: "160px", 
                whiteSpace: "pre-wrap", 
                background: "#f9f9f9", 
                padding: "15px", 
                borderRadius: "10px", 
                marginBottom: "20px",
                lineHeight: "1.5",
                color: "#333"
              }}>
                {memoModalEntry.memo || <span style={{ color: "#aaa" }}>メモは登録されていません。</span>}
              </div>
              <button style={{ ...btnBase, width: "100%", height: "42px", fontSize: "14px", background: "#333", color: "#fff" }} onClick={() => { setIsMemoEditing(true); setEditMemoText(memoModalEntry.memo || ""); }}>編集</button>
              <button style={{ ...btnBase, width: "100%", height: "42px", fontSize: "14px", background: "#fff", color: "#333", border: "1px solid #ccc", marginTop: "8px" }} onClick={() => setMemoModalEntry(null)}>閉じる</button>
            </>
          ) : (
            <>
              <div style={{ textAlign: "left", marginBottom: "15px", position: "relative" }}>
                <textarea 
                  style={{ 
                    ...textareaStyle, 
                    minHeight: "220px", 
                    fontSize: "16px",
                    paddingRight: "42px" 
                  }} 
                  value={editMemoText} 
                  onChange={e => setEditMemoText(e.target.value)} 
                  placeholder="メモを入力してください（関連語彙、例文など）..."
                />
                <span 
                  onClick={() => startListening("memo", "ja-JP")}
                  style={{ 
                    position: "absolute", 
                    right: "12px", 
                    top: "12px", 
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center",
                    zIndex: 10
                  }}
                  title="音声入力"
                >
                  {isListening === "memo" ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="6" width="12" height="12" rx="2" fill="#f44336" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#2196f3"/>
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#2196f3"/>
                    </svg>
                  )}
                </span>
              </div>
              <button style={{ ...btnBase, width: "100%", height: "42px", fontSize: "14px", background: "#4caf50", color: "#fff", border: "none" }} onClick={handleSaveMemo}>保存</button>
              <button style={{ ...btnBase, width: "100%", height: "42px", fontSize: "14px", border: "none", marginTop: "8px", background: "#f5f5f5" }} onClick={() => setIsMemoEditing(false)}>キャンセル</button>
            </>
          )}
        </div>
      </div>
    );
  };

  const onTouchStart = (e) => {
    setTouchEndObj(null);
    setTouchStartObj({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchMove = (e) => {
    setTouchEndObj({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };
  const onTouchEnd = () => {
    if (!touchStartObj || !touchEndObj) return;
    const distanceX = touchStartObj.x - touchEndObj.x;
    const distanceY = touchStartObj.y - touchEndObj.y;
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > 50) {
       if (distanceX > 0) {
         handleNext();
       } else {
         handlePrev();
       }
    }
  };

  const onFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let allNewEntries = [];
    let duplicateFileNames = [];

    const readFile = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target.result;
          let lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
          
          if (lines.length > 0 && lines[0].toLowerCase().includes("word")) {
            lines.shift();
          }

          const fileEntries = lines.map((line) => {
            const [word, meaning, sentence, sentence_jp, level] = parseCSVLine(line);
            // 【修正】ランダムではなく不変の10桁ハッシュIDを生成して付与
            const id = generateHashId(word, file.name);
            return { 
                id, word, meaning, sentence, sentence_jp, level: level || "", source: file.name 
            };
          });
          resolve({ name: file.name, data: fileEntries });
        };
        reader.readAsText(file);
      });
    };

    for (let file of files) {
      const result = await readFile(file);
      allNewEntries.push(result);
      if (fileList.includes(result.name)) {
        duplicateFileNames.push(result.name);
      }
    }

    if (duplicateFileNames.length > 0) {
      setPendingImports(allNewEntries);
      setShowImportConfirm(true);
    } else {
      const flatEntries = allNewEntries.flatMap(f => f.data);
      setEntries(prev => [...prev, ...flatEntries]);
      setShowMainMenu(false);
    }
    e.target.value = "";
  };

  const executeImport = (mode) => {
    let finalData = [];
    pendingImports.forEach(fileObj => {
      if (mode === "diff" && fileList.includes(fileObj.name)) {
        const existingWords = entries.filter(e => e.source === fileObj.name).map(e => e.word);
        const diff = fileObj.data.filter(e => !existingWords.includes(e.word));
        finalData.push(...diff);
      } else {
        finalData.push(...fileObj.data);
      }
    });

    setEntries(prev => [...prev, ...finalData]);
    setPendingImports([]);
    setShowImportConfirm(false);
    setShowMainMenu(false);
  };

  const getDuplicateGroups = () => {
    const targetEntries = dupCheckAllFiles
      ? entries
      : entries.filter(e => selectedDuplicateFiles.includes(e.source));

    const groups = {};

    targetEntries.forEach(e => {
      if (e.word === "word") return;
      if (!groups[e.word]) {
        groups[e.word] = [];
      }
      groups[e.word].push(e);
    });

    return Object.values(groups).filter(g => g.length > 1);
  };

  const handleExportCSV = (fileName) => {
      const fileEntries = entries.filter(e => e.source === fileName);
      let csvContent = '"word","meaning","sentence","sentence_jp","level"\n';
      fileEntries.forEach(e => {
          const row = [e.word, e.meaning, e.sentence, e.sentence_jp, e.level]
              .map(v => `"${(v || "").replace(/"/g, '""')}"`)
              .join(",");
          csvContent += row + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const downloadName = exportAsCopy ? fileName.replace(".csv", "_updated.csv") : fileName;
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", downloadName);
      link.click();
      setScreen("home");
  };

  const handleExportTestResults = () => {
    if (entries.length === 0) {
      alert("書き出す履歴データがありません。");
      return;
    }
    // 後方互換性を保つためカラムの並びは変更せず、出力する値を e.id ベースに変更
    let csvContent = '"word","source","mCount","mLog","isPri","presented","lastTested","srsInterval","srsRep","srsNextReview"\n';
    entries.forEach(e => {
      const w = e.word;
      const hid = e.id;
      const mCount = mistakes[hid] || 0;
      const mLog = (mistakeLog[hid] || []).join(";");
      const isPri = priorityWords[hid] ? "true" : "false";
      const presented = testStats[hid]?.presented || 0;
      const lastTested = testStats[hid]?.lastTested || 0;
      const srsInterval = srsData[hid]?.interval || 0;
      const srsRep = srsData[hid]?.rep || 0;
      const srsNextReview = srsData[hid]?.nextReview || 0;

      const row = [w, e.source || "", mCount, mLog, isPri, presented, lastTested, srsInterval, srsRep, srsNextReview]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
      csvContent += row + "\n";
    });

    // テストの継続用セッションデータを特別行として追加
    const sessionData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("testSession_")) {
        const mode = key.replace("testSession_", "");
        try {
          sessionData[mode] = JSON.parse(localStorage.getItem(key));
        } catch(err) {}
      }
    }
    if (Object.keys(sessionData).length > 0) {
      const sessionStr = JSON.stringify(sessionData);
      const sessionRow = ["#SESSION_DATA#", "", "", "", "", "", "", "", "", sessionStr]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvContent += sessionRow + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `wordtest_history_${dateStr}.csv`);
    link.click();
  };

  const handleTestResultsFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      let lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      if (lines.length > 0) {
        const header = lines[0].toLowerCase();
        if (!header.includes("mcount") || !header.includes("srsinterval")) {
           setFormatWarningData({ file, type: "history" });
           e.target.value = "";
           return;
        }
      }
      setTestResultsFile(file);
      setShowTestResultsImportConfirm(true);
      e.target.value = "";
    };
    reader.readAsText(file);
  };
  
  const executeTestResultsImport = () => {
    if (!testResultsFile) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      let lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      
      if (lines.length > 0 && lines[0].toLowerCase().includes("word")) {
        lines.shift();
      }

      const newMistakes = {};
      const newMistakeLog = {};
      const newPriorityWords = {};
      const newTestStats = {};
      const newSrsData = {};

      lines.forEach(line => {
        const [word, source, mCount, mLog, isPri, presented, lastTested, srsInterval, srsRep, srsNextReview] = parseCSVLine(line);
        if (!word) return;

        if (word === "#SESSION_DATA#") {
          try {
            const parsedSessions = JSON.parse(srsNextReview);
            Object.keys(parsedSessions).forEach(mode => {
              localStorage.setItem(`testSession_${mode}`, JSON.stringify(parsedSessions[mode]));
            });
          } catch(e) {
            console.error("Session data import failed", e);
          }
          return;
        }

        // 【修正】インポート時もハッシュIDを再計算してキーとする
        const hid = generateHashId(word, source || "");
        newMistakes[hid] = parseInt(mCount) || 0;
        // 文字列でも数値でもパースできるように Number を噛ませる
        newMistakeLog[hid] = mLog ? mLog.split(";").map(val => Number(val) || new Date(val).getTime()) : [];
        if (isPri === "true") {
          newPriorityWords[hid] = true;
        }
        newTestStats[hid] = {
          presented: parseInt(presented) || 0,
          lastTested: parseInt(lastTested) || 0
        };
        newSrsData[hid] = {
          interval: parseInt(srsInterval) || 0,
          rep: parseInt(srsRep) || 0,
          nextReview: parseInt(srsNextReview) || 0
        };
      });

      setMistakes(newMistakes);
      setMistakeLog(newMistakeLog);
      setPriorityWords(newPriorityWords);
      setTestStats(newTestStats);
      setSrsData(newSrsData);
      
      alert("同期が完了しました。すべての学習履歴が選択したファイルのデータに置き換わりました。");
      
      setShowTestResultsImportConfirm(false);
      setTestResultsFile(null);
      setShowMainMenu(false);
    };
    reader.readAsText(testResultsFile);
  };  

  const handleExportWordRecord = () => {
    if (entries.length === 0) {
      alert("書き出す単語レコードがありません。");
      return;
    }
    let csvContent = '"word","meaning","sentence","sentence_jp","level","memo","source"\n';
    entries.forEach(e => {
      const cleanMemo = (e.memo || "").replace(/\r?\n/g, "\\n");

      const row = [e.word, e.meaning, e.sentence, e.sentence_jp, e.level, cleanMemo, e.source]
        .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`; 
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `word_data_${dateStr}.csv`);
    link.click();
    setShowMainMenu(false);
  };

  const handleWordRecordFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      let lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      if (lines.length > 0) {
        const header = lines[0].toLowerCase();
        if (!header.includes("meaning") || header.includes("srsinterval")) {
           setFormatWarningData({ file, type: "record" });
           e.target.value = "";
           return;
        }
      }
      setWordRecordFile(file);
      setShowWordRecordImportConfirm(true); 
      e.target.value = ""; 
    };
    reader.readAsText(file);
  };

  const executeWordRecordImport = () => {
    if (!wordRecordFile) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      let lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
      
      if (lines.length > 0 && lines[0].toLowerCase().includes("word")) {
        lines.shift();
      }

      const newEntries = lines.map((line, idx) => {
        const [word, meaning, sentence, sentence_jp, level, memo, source] = parseCSVLine(line);
        // 【修正】レコードインポート時もハッシュIDを生成
        const id = generateHashId(word || "", source || "");
        return {
          id,
          word: word || "",
          meaning: meaning || "",
          sentence: sentence || "",
          sentence_jp: sentence_jp || "",
          level: level || "",
          memo: (memo || "").replace(/\\n/g, "\n"),
          source: source || ""
        };
      }).filter(e => e.word);

      setEntries(newEntries); 
      alert("同期が完了しました。すべての単語レコードが選択したファイルのデータに置き換わりました。");
      setShowWordRecordImportConfirm(false);
      setWordRecordFile(null);
      setShowMainMenu(false);
    };
    reader.readAsText(wordRecordFile);
  };

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
          <button style={{ ...btnBase, background: "#f8f9fa" }} onClick={() => handleStartTest("all")}>ランダムにテスト</button>
          <button style={btnBase} onClick={() => handleStartTest("weak")}>苦手な単語を重点学習</button>
          <button style={btnBase} onClick={() => handleStartTest("priority")}>★ 最優先課題のみ</button>
          
          <div style={{ height: "10px" }}></div> 
          
          <button style={btnBase} onClick={() => setScreen("reviewSelect")}>ミスした単語の復習</button>
          <button style={btnBase} onClick={() => { setCurrentPage(1); setScreen("ranking"); }}>苦手ランキング</button>
          
          <button style={{ ...btnBase, background: "#e3f2fd", borderColor: "#2196f3", color: "#1976d2", fontWeight: "bold", marginTop: "15px" }} onClick={() => { setSearchQuery(""); setSearchMeaningQuery(""); setScreen("search"); }}>🔍 データ検索</button>
        </section>

        {showMainMenu && (
          <div style={modalOverlay} onClick={() => setShowMainMenu(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: "20px", marginBottom: "30px" }}>設定・管理</h3>
              
              <div style={{ ...btnBase, position: "relative", backgroundColor: "#fff", width: "100%" }}>
                CSVファイルを追加
                <input type="file" accept=".csv,text/csv,application/csv,text/plain" multiple onChange={onFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>

              <div style={{ borderTop: "1px solid #eee", margin: "15px 0" }}></div>
              <button 
                style={{ ...btnBase, backgroundColor: "#e8f5e9", borderColor: "#4caf50", color: "#2e7d32", width: "100%" }} 
                onClick={handleExportTestResults}
              >
                このデバイスの履歴を書き出す
              </button>
              
              <div style={{ ...btnBase, position: "relative", backgroundColor: "#e3f2fd", borderColor: "#2196f3", color: "#1976d2", width: "100%", marginBottom: "15px" }}>
                他デバイスの履歴を取り込む
                <input type="file" accept=".csv,text/csv,application/csv,text/plain" onChange={handleTestResultsFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>
              <div style={{ borderTop: "1px solid #eee", margin: "15px 0" }}></div>

              <button
                style={{ ...btnBase, width: "100%" }}
                onClick={() => {
                  setDupCurrentPage(1);
                  setScreen("duplicateFileSelect");
                  setShowMainMenu(false);
                }}
              >
                重複レコードの編集
              </button>

              <button style={{ ...btnBase, width: "100%", background: "#e8f5e9", borderColor: "#4caf50" }} onClick={handleExportWordRecord}>単語レコードを書き出す</button>
              <div style={{ ...btnBase, position: "relative", backgroundColor: "#e3f2fd", borderColor: "#2196f3", color: "#1976d2", width: "100%" }}>
                単語レコードを取り込む
                <input type="file" accept=".csv,text/csv,application/csv,text/plain" onChange={handleWordRecordFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              </div>

              <button style={{ ...btnBase, width: "100%", color: "#e53935", borderColor: "#e53935", marginTop: "10px" }} onClick={() => { setScreen("fileDelete"); setShowMainMenu(false); }}>データを指定して削除</button>
              
              <button style={{ ...btnBase, width: "100%", border: "none", marginTop: "20px" }} onClick={() => setShowMainMenu(false)}>閉じる</button>
            </div>
          </div>
        )}

        {showImportConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ color: "#d32f2f", marginBottom: "15px" }}>重複の確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>
                既に読み込み済みのファイルが含まれています。<br/>
                <b>未登録の単語（差分）のみ</b>を読み込みますか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#333", color: "#fff" }} onClick={() => executeImport("diff")}>はい（差分のみ）</button>
              <button style={{ ...btnBase, width: "100%", background: "#f8f9fa" }} onClick={() => executeImport("all")}>すべて追加（重複を許可）</button>
              <button style={{ ...btnBase, width: "100%", border: "none", color: "#999" }} onClick={() => { setShowImportConfirm(false); setPendingImports([]); }}>キャンセル</button>
            </div>
          </div>
        )}

        {showTestResultsImportConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ color: "#d32f2f", marginBottom: "15px", fontWeight: "bold" }}>インポートの確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>
                既存のデータをこのファイルのデータで上書きします。<br/>よろしいですか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#4caf50", color: "#fff", border: "none" }} onClick={executeTestResultsImport}>はい</button>
              <button style={{ ...btnBase, width: "100%", border: "none", background: "#f5f5f5", marginTop: "10px" }} onClick={() => { setShowTestResultsImportConfirm(false); setTestResultsFile(null); }}>いいえ</button>
            </div>
          </div>
        )}

        {showWordRecordImportConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ color: "#d32f2f", marginBottom: "15px", fontWeight: "bold" }}>インポートの確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>
                既存のデータをこのファイルのデータで上書きします。<br/>よろしいですか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#4caf50", color: "#fff", border: "none" }} onClick={executeWordRecordImport}>はい</button>
              <button style={{ ...btnBase, width: "100%", border: "none", background: "#f5f5f5", marginTop: "10px" }} onClick={() => { setShowWordRecordImportConfirm(false); setWordRecordFile(null); }}>いいえ</button>
            </div>
          </div>
        )}

        {showResumeConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ marginBottom: "15px" }}>続きから始めますか？</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px", color: "#666" }}>
                テストの途中データが残っています。<br/>前回の続きから再開しますか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#2196f3", color: "white", border: "none" }} onClick={() => resumeSession()}>はい（続きから）</button>
              <button style={{ ...btnBase, width: "100%", background: "#f5f5f5", border: "1px solid #ccc", marginTop: "10px" }} onClick={() => setShowFreshSessionConfirm(true)}>いいえ（新しく開始）</button>
              <button style={{ ...btnBase, width: "100%", border: "none", color: "#999", marginTop: "10px" }} onClick={() => { setShowResumeConfirm(false); setPendingTestMode(null); }}>キャンセル</button>
            </div>
          </div>
        )}

        {showFreshSessionConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ marginBottom: "15px", color: "#d32f2f" }}>確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px", color: "#333" }}>
                前回のテストのメモリをクリアします。<br/>よろしいですか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#d32f2f", color: "white", border: "none" }} onClick={() => {
                setShowFreshSessionConfirm(false);
                startFreshSession();
              }}>はい（クリアして開始）</button>
              <button style={{ ...btnBase, width: "100%", background: "#f5f5f5", border: "1px solid #ccc", marginTop: "10px" }} onClick={() => setShowFreshSessionConfirm(false)}>キャンセル</button>
            </div>
          </div>
        )}

        {formatWarningData && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <h3 style={{ color: "#d32f2f", marginBottom: "15px", fontWeight: "bold" }}>データ構造の確認</h3>
              <p style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "25px" }}>
                選択したファイルのデータ構造が、想定される仕様と異なるようです。<br/>（別の種類のデータを選択している可能性があります）<br/><br/>
                このまま強制的に読み込みますか？
              </p>
              <button style={{ ...btnBase, width: "100%", background: "#d32f2f", color: "#fff", border: "none" }} onClick={() => {
                  if (formatWarningData.type === "history") {
                     setTestResultsFile(formatWarningData.file);
                     setShowTestResultsImportConfirm(true);
                  } else {
                     setWordRecordFile(formatWarningData.file);
                     setShowWordRecordImportConfirm(true);
                  }
                  setFormatWarningData(null);
              }}>はい（このまま読み込む）</button>
              <button style={{ ...btnBase, width: "100%", border: "none", background: "#f5f5f5", marginTop: "10px" }} onClick={() => setFormatWarningData(null)}>いいえ（キャンセル）</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "search") {
    return (
      <div style={{ padding: "20px 24px 40px", maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ textAlign: "left", marginBottom: "5px" }}>
          <button style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff", cursor: "pointer" }} onClick={() => setScreen("home")}>← 戻る</button>
        </div>
        <h2 style={{ marginTop: "0", marginBottom: "10px" }}>単語を検索</h2>
        
        <div style={{ textAlign: "left", fontSize: "12px", color: "#888", marginBottom: "2px" }}>English Word:</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "5px" }}>
          <input 
            style={{ ...searchInputStyle, paddingRight: "80px", marginBottom: "0" }}
            placeholder="英単語を2文字以上入力..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            inputMode="latin" 
            autoFocus
          />
          <div style={{ position: "absolute", right: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            {searchQuery && (
              <span onClick={() => setSearchQuery("")} style={{ fontSize: "20px", color: "#ccc", cursor: "pointer", padding: "5px" }}>✕</span>
            )}
            <span onClick={() => startListening("search", "en-US")} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              {isListening === "search" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="#f44336" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#2196f3"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#2196f3"/></svg>
              )}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "left", fontSize: "12px", color: "#888", marginBottom: "2px" }}>語義:</div>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input 
            style={{ ...searchInputStyle, paddingRight: "80px" }}
            placeholder="語義を入力..."
            value={searchMeaningQuery}
            onChange={(e) => setSearchMeaningQuery(e.target.value)}
            inputMode="text" 
          />
          <div style={{ position: "absolute", right: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            {searchMeaningQuery && (
              <span onClick={() => setSearchMeaningQuery("")} style={{ fontSize: "20px", color: "#ccc", cursor: "pointer", padding: "5px" }}>✕</span>
            )}
            <span onClick={() => startListening("searchMeaning", "ja-JP")} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
              {isListening === "searchMeaning" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="#f44336" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="#2196f3"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="#2196f3"/></svg>
              )}
            </span>
          </div>
        </div>

        <div style={{ textAlign: "left", marginTop: "20px" }}>
          {searchQuery.length > 0 && searchQuery.length < 2 && searchMeaningQuery.length === 0 && (
            <p style={{ fontSize: "13px", color: "#999" }}>※英単語は2文字以上入力してください</p>
          )}
          {searchResults.map((e, idx) => (
            <div 
              key={idx} 
              style={{ 
                padding: "16px", borderBottom: "1px solid #eee", cursor: "pointer",
                background: "#fff", borderRadius: "8px", marginBottom: "5px",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}
              onClick={() => setSelectedSearchEntry(e)}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                    {e.word} {e.level && <span style={{ fontSize: "12px", color: "#2196f3", marginLeft: "5px" }}>[{e.level}]</span>}
                </div>
                <div style={{ fontSize: "14px", color: "#666" }}>{e.meaning}</div>
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#bbb", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Source: {e.source}</span>
                    {e.memo && e.memo.trim() !== "" && (
                        <span title="メモあり"><MemoIcon hasMemo={true} size={14} /></span>
                    )}
                </div>
              </div>
              {/* 【修正】 e.id をキーに変更 */}
              {priorityWords[e.id] && <span style={{ color: "#ef6c00" }}>★</span>}
            </div>
          ))}
        </div>

        {selectedSearchEntry && (
          <div style={modalOverlay} onClick={() => setSelectedSearchEntry(null)}>
            <div style={{...modalContent, position: "relative"}} onClick={e => e.stopPropagation()}>
              <div 
                style={{ position: "absolute", top: "15px", right: "15px", padding: "12px", fontSize: "28px", cursor: "pointer", color: priorityWords[selectedSearchEntry.id] ? "#FFD700" : "#e0e0e0", textShadow: priorityWords[selectedSearchEntry.id] ? "0 0 2px rgba(0,0,0,0.2)" : "none", zIndex: 5 }} 
                onClick={(e) => togglePriority(e, selectedSearchEntry.id)}
              >
                {priorityWords[selectedSearchEntry.id] ? "★" : "☆"}
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
                  // 【修正】 selectedSearchEntry.id を渡す
                  onClick={() => handleWrong(selectedSearchEntry.id)}
                >
                  ミス+1 ({mistakes[selectedSearchEntry.id] || 0})
                </button>
              </div>

              <div style={{ textAlign: "left", background: "#f9f9f9", padding: "15px", borderRadius: "10px", marginBottom: "20px" }}>
                <div style={{ fontSize: "16px", marginBottom: "10px", lineHeight: "1.5" }}>{renderWithBold(selectedSearchEntry.sentence)}</div>
                <div style={{ fontSize: "14px", color: "#666", lineHeight: "1.4" }}>{selectedSearchEntry.sentence_jp}</div>
              </div>
              
              <div style={{ fontSize: "12px", color: "#bbb", marginBottom: "25px", position: "relative" }}>
                Source: {selectedSearchEntry.source}
                {(() => {
                  const hasMemo = !!(selectedSearchEntry.memo && selectedSearchEntry.memo.trim() !== "");
                  return (
                    <div 
                      style={{ 
                        position: "absolute", 
                        right: "0px", 
                        bottom: "-2px", 
                        cursor: "pointer", 
                        padding: "5px", 
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center"
                      }} 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setMemoModalEntry(selectedSearchEntry); 
                        setEditMemoText(selectedSearchEntry.memo || ""); 
                        setIsMemoEditing(false); 
                      }} 
                      title={hasMemo ? "メモあり（編集）" : "メモなし（追加）"}
                    > 
                      <MemoIcon hasMemo={hasMemo} size={26} />
                    </div>
                  );
                })()}
              </div>
              
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                    style={{ ...btnBase, flex: 1, background: "#333", color: "#fff" }} 
                    onClick={() => {
                        const entry = selectedSearchEntry;
                        setSelectedSearchEntry(null);
                        handleStartTest(null, entry);
                    }}
                >
                    カードを開く
                </button>
                <button style={{ ...btnBase, flex: 1, background: "#fff", color: "#333" }} onClick={() => setSelectedSearchEntry(null)}>閉じる</button>
              </div>
            </div>
          </div>
        )}
        {renderMemoModal()}
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
              style={{ width: "20px", height: "20px", marginRight: "12px" }}
            />
            <span style={{ fontWeight: "700" }}>すべてのファイル</span>
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
                checked={!dupCheckAllFiles && selectedDuplicateFiles.includes(file)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDupCheckAllFiles(false);
                  setSelectedDuplicateFiles(prev => {
                    if (checked) return [...prev, file];
                    return prev.filter(f => f !== file);
                  });
                }}
                style={{ width: "20px", height: "20px", marginRight: "12px" }}
              />
              <span>{file}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button
            style={{ ...btnBase, width: "240px", background: "#1976d2", borderColor: "#1976d2", color: "#fff" }}
            onClick={() => {
              setDupCurrentPage(1);
              setScreen("duplicates");
            }}
          >
            重複チェック開始
          </button>
          <button style={{ ...btnBase, width: "240px" }} onClick={() => setScreen("home")}>戻る</button>
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
                        source: group[0].source,
                        memo: group[0].memo || ""
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
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Source: {item.source} {item.level && `[Level: ${item.level}]`}</span>
                      {item.memo && item.memo.trim() !== "" && (
                          <span title="メモあり"><MemoIcon hasMemo={true} size={14} /></span>
                      )}
                  </div>
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

            <div style={{ textAlign: "left", fontSize: "13px", fontWeight: "bold", marginBottom: "10px" }}>2. 残す内容(語義・例文・メモ)を選択:</div>
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

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px", cursor: "pointer" }}>
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

                    <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                        <input 
                            type="radio" name="merge-memo" 
                            checked={mergeSelections.memo === (item.memo || "") && (mergeSelections.selectedMemoIdx === undefined ? idx === 0 : mergeSelections.selectedMemoIdx === idx)}
                            onChange={() => setMergeSelections({...mergeSelections, memo: item.memo || "", selectedMemoIdx: idx})}
                        />
                        <div style={{ fontSize: "15px", width: "100%" }}>
                            <strong>メモ:</strong>
                            {item.memo && item.memo.trim() !== "" && (
                                <div style={{ whiteSpace: "pre-wrap", marginTop: "4px", color: "#333" }}>
                                    {item.memo}
                                </div>
                            )}
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
                <div style={{ marginTop: "20px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "bold" }}>メモ</label>
                    <textarea style={{ ...textareaStyle, minHeight: "80px" }} value={finalMergeData.memo || ""} onChange={e => setFinalMergeData({...finalMergeData, memo: e.target.value})} />
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
                            // 【修正】統合後も不変のハッシュIDを発行
                            id: generateHashId(finalMergeData.word, finalMergeData.source),
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <button 
            style={btnBase} 
            onClick={() => {
              // 復習モードから入っている場合は、1つ前の「復習範囲を選択」画面に戻す
              if (mode && mode.startsWith("review")) {
                setScreen("review-menu");
              } else {
                setScreen("home");
              }
            }}
          >
            {mode && mode.startsWith("review") ? "復習範囲選択へ" : "ホームへ"}
          </button>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "#666" }}>{index + 1} / {pool.length}</div>
        </div>

        <div onClick={() => setStep(s => Math.min(s + 1, 2))} style={cardStyle}>
          <div style={{ position: "absolute", top: "15px", left: "15px", padding: "12px", fontSize: "24px", cursor: "pointer", opacity: 0.3 }} onClick={(e) => { e.stopPropagation(); setShowEditMenu(true); }}>⋮</div>
          
          <div 
            style={{ position: "absolute", top: "15px", right: "15px", padding: "12px", fontSize: "28px", cursor: "pointer", color: priorityWords[current?.id] ? "#FFD700" : "#e0e0e0", textShadow: priorityWords[current?.id] ? "0 0 2px rgba(0,0,0,0.2)" : "none", zIndex: 5 }} 
            // 【修正】 current?.id を渡す
            onClick={(e) => togglePriority(e, current?.id)}
          >
            {priorityWords[current?.id] ? "★" : "☆"}
          </div>

          {priorityToast && (
            <div style={{ position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "8px 16px", borderRadius: "20px", fontSize: "14px", zIndex: 10, pointerEvents: "none", width: "max-content" }}>
              {priorityToast}
            </div>
          )}

          <div style={{ margin: "10px 0 10px 0" }}>
            <h2 style={{ fontSize: "36px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {current?.word}
              <span style={{ cursor: "pointer", marginLeft: "20px", fontSize: "30px", filter: "grayscale(1)" }} onClick={(e) => { e.stopPropagation(); speak(current?.word); }}>🔊</span>
            </h2>
            {current?.level && <div style={{ color: "#2196f3", fontWeight: "bold", fontSize: "14px", marginTop: "5px" }}>{current.level}</div>}
          </div>

          <div style={{ minHeight: "60px", width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: "10px" }}>
            {step >= 1 && (
              <div style={{ fontSize: "19px", color: "#444", lineHeight: "1.5" }}>
                {renderWithBold(current?.sentence)}
              </div>
            )}
          </div>

          <div style={{ width: "100%", marginTop: "10px" }}>
            {step === 2 && (
              <div style={{ borderTop: "2px solid #f0f0f0", paddingTop: "20px" }}>
                <div style={{ fontWeight: "bold", fontSize: "24px", color: "#d32f2f", marginBottom: "10px" }}>{current?.meaning}</div>
                <div style={{ fontSize: "17px", color: "#777", lineHeight: "1.5" }}>{current?.sentence_jp}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "auto", paddingTop: "20px", width: "100%", textAlign: "center", position: "relative" }}>
            <div style={{ fontSize: "12px", color: "#bbb" }}>Source: {current?.source}</div>
            <div
              style={{
                position: "absolute",
                right: "0px",
                bottom: "-5px",
                cursor: "pointer",
                padding: "5px",
                zIndex: 10,
                display: "flex",
                alignItems: "center"
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMemoModalEntry(current);
                setEditMemoText(current?.memo || "");
                setIsMemoEditing(false);
              }}
              title={
                current?.memo && current.memo.trim() !== ""
                  ? "メモあり（編集）"
                  : "メモなし（追加）"
              }
            >
              <MemoIcon
                hasMemo={
                  !!(
                    current?.memo &&
                    current.memo.trim() !== ""
                  )
                }
                size={26}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: "40px" }}>
          {currentTestMode === "single" ? (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "15px" }}>
              <button 
                style={{ ...btnBase, margin: 0, background: "#333", color: "#fff", border: "none", fontWeight: "bold", height: "60px", fontSize: "18px" }} 
                onClick={(e) => { e.stopPropagation(); setScreen("search"); }}
              >
                検索結果に戻る
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginBottom: "15px" }}>
              <button style={{ ...btnBase, width: "120px", margin: 0, background: "#f1f3f5", border: "none" }} onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={history.length === 0}>&lt; 戻る</button>
              <button style={{ ...btnBase, width: "120px", margin: 0, background: "#333", color: "#fff", border: "none" }} onClick={(e) => { e.stopPropagation(); handleNext(); }}>次へ &gt;</button>
            </div>
          )}
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
                const isTarget = (e) => e.id === current.id;
                const updated = entries.map(e => isTarget(e) ? { ...e, ...editData } : e);
                setEntries(updated);
                setPool(pool.map(e => isTarget(e) ? { ...e, ...editData } : e));
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
              {/* 【修正】 キーを current.id に変更 */}
              <button style={{ ...btnBase, width: "100%", background: "#e53935", color: "#fff", border: "none" }} onClick={() => { setMistakes(prev => ({ ...prev, [current.id]: 0 })); setConfirmClearMistake(false); }}>リセット</button>
              <button style={{ ...btnBase, width: "100%", border: "none" }} onClick={() => setConfirmClearMistake(false)}>キャンセル</button>
            </div>
          </div>
        )}

        {showFinishConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "bold", whiteSpace: "pre-wrap", lineHeight: "1.5", marginBottom: "15px" }}>
                テストを完走しました。{"\n"}出題順などのセッションデータをクリアしますか？
              </p>
              <p style={{ fontSize: "13px", color: "#666", marginTop: "10px", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                クリアする場合は［はい］を、今回間違った問題のみを再チャレンジするなど、保持したまま勉強を続ける場合は［いいえ］を選択してください。
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                <button style={{ ...btnBase, flex: 1, background: "#d32f2f", color: "white", border: "none", fontSize: "14px" }} onClick={handleFinishClear}>
                  はい (クリアする)
                </button>
                <button style={{ ...btnBase, flex: 1, background: "#f5f5f5", color: "#333", border: "1px solid #ccc", fontSize: "14px" }} onClick={handleFinishKeep}>
                  いいえ (保持する)
                </button>
              </div>
            </div>
          </div>
        )}

        {showRetryConfirm && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <p style={{ fontWeight: "bold", whiteSpace: "pre-wrap", lineHeight: "1.5", marginBottom: "25px", fontSize: "15px" }}>
                今回と全く同じ内容でリトライしますか？{"\n"}今回［間違えた］を選択した単語に絞ってリトライしますか？
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <button style={{ ...btnBase, width: "100%", background: "#2196f3", color: "white", border: "none" }} onClick={handleRetrySame}>
                  同一内容でリトライ
                </button>
                {/* ミスした単語が0個の場合はボタンを押せないようにする安全設計 */}
                <button 
                  style={{ ...btnBase, width: "100%", background: sessionMissedWords.length > 0 ? "#fff" : "#f5f5f5", color: sessionMissedWords.length > 0 ? "#d32f2f" : "#aaa", border: sessionMissedWords.length > 0 ? "1px solid #d32f2f" : "1px solid #ccc" }} 
                  disabled={sessionMissedWords.length === 0}
                  onClick={handleRetryMissed}
                >
                  間違えた単語のみ ({sessionMissedWords.length}語)
                </button>
                <button style={{ ...btnBase, width: "100%", border: "none", color: "#999", marginTop: "5px" }} onClick={() => setShowRetryConfirm(false)}>
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {renderMemoModal()}
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
        <button style={{ ...btnBase, background: "#333", color: "#fff" }} onClick={() => handleStartTest(`review_${reviewRange}`)}>テスト開始</button>
      </div>
    );
  }

  if (screen === "ranking") {
    const aggregate = {};
    entries.forEach(e => {
        // 【修正】 ランキング抽出キーを e.id に変更
        const miss = mistakes[e.id] || 0;
        if (miss > 0) {
            if (!aggregate[e.id]) {
                aggregate[e.id] = { ...e, count: miss };
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
            <div key={e.id} style={{ padding: "15px 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
              
              <div style={{ fontSize: "12px", color: "#bbb", position: "relative" }}>
                Source: {rankingMemoEntry.source}
                {(() => {
                  const hasMemo = !!(
                    rankingMemoEntry.memo &&
                    rankingMemoEntry.memo.trim() !== ""
                  );

                  return (
                    <div
                      style={{
                        position: "absolute",
                        right: "0px",
                        bottom: "-2px",
                        cursor: "pointer",
                        padding: "5px",
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center"
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoModalEntry(rankingMemoEntry);
                        setEditMemoText(rankingMemoEntry.memo || "");
                        setIsMemoEditing(false);
                      }}
                      title={hasMemo ? "メモあり（編集）" : "メモなし（追加）"}
                    >
                      <MemoIcon hasMemo={hasMemo} size={26} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        {renderMemoModal()}
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