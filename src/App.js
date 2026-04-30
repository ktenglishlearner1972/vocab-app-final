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
  margin: "6px auto",
  fontSize: "16px",
  fontFamily: "sans-serif",
  lineHeight: "1",
  boxSizing: "border-box"
};

const sectionTitle = {
  marginTop: 20,
  marginBottom: 8
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearMistake, setConfirmClearMistake] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedTestFiles, setSelectedTestFiles] = useState([]);
  const [confirmFileDelete, setConfirmFileDelete] = useState(false);

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
    localStorage.setItem(
      "priorityWords",
      JSON.stringify(priorityWords)
    );
  }, [priorityWords]);

  const current = pool[index];

 const startTest = (mode) => {
  let p = [];

  if (mode === "all") {
    p = shuffle([...entries]);
  }

  if (mode === "weak") {
    p = buildWeakPool(entries, mistakes);
  }

  if (mode === "priority") {
    p = shuffle(
      entries.filter(e => priorityWords[e.word])
    );
  }

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

    p = entries.filter(e => {
      const logs = mistakeLog[e.word] || [];
      return logs.some(t => {
        const d = new Date(t);
        return d >= start && d <= now;
      });
    });

    p = shuffle(p);
  }

  if (mode === "files") {
  p = shuffle(
    entries.filter(e => selectedTestFiles.includes(e.source))
  );
  }

    setPool(p);
    setIndex(0);
    setStep(0);
    setHistory([]);
    setScreen("test");
  };

  const next = () => {
    setHistory(h => [...h, index]);
    setIndex(i => Math.min(i + 1, pool.length - 1));
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

    setMistakes(prev => ({
      ...prev,
      [current.word]: (prev[current.word] || 0) + 1
    }));

    setMistakeLog(prev => ({
      ...prev,
      [current.word]: [...(prev[current.word] || []), now]
    }));

    next();
  };

  const clearMistakeCount = () => {
    if (!current) return;

    setMistakes(prev => ({
      ...prev,
      [current.word]: 0
    }));

    setConfirmClearMistake(false);
  };

  const togglePriority = () => {
    if (!current) return;

    const now = Date.now();

    if (priorityWords[current.word]) {
      setPriorityWords(prev => {
        const copy = { ...prev };
        delete copy[current.word];
        return copy;
      });
      return;
    }

    setMistakes(prev => ({
      ...prev,
      [current.word]: (prev[current.word] || 0) + 1
    }));

    setMistakeLog(prev => ({
      ...prev,
      [current.word]: [...(prev[current.word] || []), now]
    }));

    setPriorityWords(prev => ({
      ...prev,
      [current.word]: true
    }));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (ev) => {
      const lines = ev.target.result
        .split(/\r?\n/)
        .filter(Boolean);

      const parsed = lines.map(line => {
        const [word, meaning, sentence, sentence_jp] =
          parseCSVLine(line);

        return {
          word,
          meaning,
          sentence,
          sentence_jp,
          source: file.name
        };
      });

      setEntries(prev => {
        const map = new Map();
        [...prev, ...parsed].forEach(e =>
          map.set(e.word, e)
        );
        return [...map.values()];
      });
    };

    reader.readAsText(file);
  };

  const fileList = [...new Set(entries.map(e => e.source).filter(Boolean))];

  const blank = <div style={{ height: 24 }} />;

  const renderCard = () => {
    if (!current) return null;

    if (step === 0) {
      return (
        <>
          <h2>{current.word}</h2>
          {blank}{blank}{blank}
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <h2>{current.word}</h2>
          {blank}
          <div>{renderWithBold(current.sentence)}</div>
          {blank}
        </>
      );
    }

    return (
      <>
        <h2>{current.word}</h2>
        <div>{current.meaning}</div>
        <div>{renderWithBold(current.sentence)}</div>
        <div>{current.sentence_jp}</div>
      </>
    );
  }

  if (screen === "home") {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <h2>英単語アプリ</h2>
        <p>単語数: {entries.length}</p>

        <h3 style={sectionTitle}>－ 単語テスト －</h3>
        <button style={btn} onClick={() => startTest("all")}>すべて</button>
        <button style={btn} onClick={() => setScreen("fileTestSelect")}>ファイル別</button>
        <button style={btn} onClick={() => startTest("weak")}>苦手優先</button>
        <button style={btn} onClick={() => startTest("priority")}>最優先課題</button>
        <button style={btn} onClick={() => setScreen("reviewSelect")}>復習</button>

        <h3 style={sectionTitle}>－ 苦手ランキング －</h3>
        <button style={btn} onClick={() => setScreen("ranking")}>苦手単語</button>

        <h3 style={sectionTitle}>－ 単語ファイル管理 －</h3>
        <div style={{ ...btn, position: "relative" }}>
          追加ファイル選択
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0
            }}
          />
        </div>
        <button style={btn} onClick={() => setScreen("fileDelete")}>
          ファイル削除
        </button>
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
    const ranking = entries
      .map(e => ({
        ...e,
        count: mistakes[e.word] || 0
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);

    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <button onClick={() => setScreen("home")}>← ホーム</button>
        <h3>苦手単語ランキング</h3>
        {ranking.map((e, i) => (
          <div key={e.word}>
            {i + 1}. {e.word} ({e.count}回)
            <div style={{ fontSize: "14px", opacity: 0.8 }}>
             {e.meaning}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (screen === "fileTestSelect") {
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <button onClick={() => setScreen("home")}>← ホーム</button>

      <h3>テストするファイルを選択</h3>

      {fileList.map(file => (
        <div key={file} style={{ marginBottom: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={selectedTestFiles.includes(file)}
              onChange={() =>
                setSelectedTestFiles(prev =>
                  prev.includes(file)
                    ? prev.filter(f => f !== file)
                    : [...prev, file]
                )
              }
            />
            {file}
          </label>
        </div>
      ))}

      <button style={btn} onClick={() => startTest("files")}>
        テスト開始
      </button>
    </div>
  );
  }

if (screen === "fileDelete") {
  return (
    <>
      <div style={{ padding: 20, textAlign: "center" }}>
        <button onClick={() => setScreen("home")}>← ホーム</button>
        <h3>削除するファイルを選択</h3>

        {fileList.map(file => (
          <div
            key={file}
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 8
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={selectedFiles.includes(file)}
                onChange={() =>
                  setSelectedFiles(prev =>
                    prev.includes(file)
                      ? prev.filter(f => f !== file)
                      : [...prev, file]
                  )
                }
              />
              {file}
            </label>
          </div>
        ))}

        <button
          style={btn}
          onClick={() => setConfirmFileDelete(true)}
        >
          削除する
        </button>
      </div>

      {confirmFileDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <div style={{ textAlign: "center", background: "white", padding: 20, borderRadius: 12 }}>
            <p>以下のファイルを削除しますか？</p>

            <div style={{ margin: "12px 0" }}>
              {selectedFiles.map(f => (
                <div key={f}>{f}</div>
              ))}
            </div>

            <button
              style={btn}
              onClick={() => {
                setEntries(prev =>
                  prev.filter(e => !selectedFiles.includes(e.source))
                );
                setSelectedFiles([]);
                setConfirmFileDelete(false);
                setScreen("home");
              }}
            >
              はい
            </button>

            <button
              style={btn}
              onClick={() => setConfirmFileDelete(false)}
            >
              いいえ
            </button>
          </div>
        </div>
      )}
    </>
  );
}

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <button onClick={() => setScreen("home")}>← ホーム</button>

      <div
        onClick={() => setStep(s => Math.min(s + 1, 2))}
        style={{
          border: "1px solid #333",
          borderRadius: 16,
          padding: 20,
          minHeight: 240,
          marginTop: 20,
          cursor: "pointer",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          outline: "none"
        }}
      >
        {renderCard()}
      </div>

      <button style={btn} onClick={back}>戻る</button>
      <button style={btn} onClick={next}>次へ</button>
      <button style={btn} onClick={wrong}>間違えた</button>
      <button style={btn} onClick={togglePriority}>
        {priorityWords[current?.word]
          ? "最優先指定解除"
          : "最優先指定"}
      </button>
      <button style={btn} onClick={() => setConfirmClearMistake(true)}>失敗カウントクリア</button>
      <button style={btn} onClick={() => setConfirmDelete(true)}>削除</button>

      {confirmClearMistake && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: "320px",
              background: "white",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
            }}
          >
            <p style={{ marginBottom: 20 }}>
              「{current?.word}」の失敗カウントをクリアしますか？
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16
              }}
            >
              <button
                style={{
                  width: "100px",
                  height: "40px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "16px"
                }}
                onClick={clearMistakeCount}
              >
                はい
              </button>

              <button
                style={{
                  width: "100px",
                  height: "40px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "16px"
                }}
                onClick={() => setConfirmClearMistake(false)}
              >
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: "320px",
              background: "white",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
            }}
          >
            <p style={{ marginBottom: 20 }}>
              「{current?.word}」を削除しますか？
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16
              }}
            >
              <button
                style={{
                  width: "100px",
                  height: "40px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "16px"
                }}
                onClick={() => {
                  setEntries(prev =>
                    prev.filter(e => e.word !== current.word)
                  );
                  setConfirmDelete(false);
                  next();
                }}
              >
                はい
              </button>

              <button
                style={{
                  width: "100px",
                  height: "40px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "16px"
                }}
                onClick={() => setConfirmDelete(false)}
              >
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
