import React, { useMemo, useState, useEffect } from "react";

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
    const m = mistakes[e.word] || 0;
    const weight = Math.min(5, m + 1);
    for (let i = 0; i < weight; i++) pool.push(e);
  }
  return shuffle(pool);
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim().replace(/^"|"$/g, ""));
}

function renderWithBold(text) {
  if (!text) return "";
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// 共通ボタン（ホームと統一）
const largeBtnStyle = {
  width: "220px",
  height: "48px",
  margin: "6px auto",
  border: "1px solid #333",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "white",
  cursor: "pointer",
  fontSize: 16
};

const containerCenter = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};

export default function VocabTestApp() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("all");

  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem("entries");
    return saved
      ? JSON.parse(saved)
      : [
          {
            word: "abandon",
            meaning: "捨てる、放棄する",
            sentence: "He **abandoned** the old plan and started over.",
            sentence_jp: "彼は古い計画を捨ててやり直した。",
          }
        ];
  });

  const [mistakes, setMistakes] = useState(() => {
    const saved = localStorage.getItem("mistakes");
    return saved ? JSON.parse(saved) : {};
  });

  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    localStorage.setItem("entries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem("mistakes", JSON.stringify(mistakes));
  }, [mistakes]);

  const currentPool = useMemo(() => {
    let pool = [...entries];
    if (mode === "weak") pool = buildWeakPool(entries, mistakes);
    else pool = shuffle(pool);
    return pool;
  }, [entries, mistakes, mode]);

  const current = currentPool[index] || null;

  const startTest = () => {
    setIndex(0);
    setStep(0);
    setScreen("test");
  };

  const handleNext = () => {
    setStep(0);
    setIndex((p) => (p + 1) % Math.max(currentPool.length, 1));
  };

  const handleWrong = () => {
    if (!current) return;

    setMistakes((p) => ({
      ...p,
      [current.word]: (p[current.word] || 0) + 1
    }));

    setStep(0);
    setIndex((p) => (p + 1) % Math.max(currentPool.length, 1));
  };

  const handleSpeak = () => {
    if (!current?.word || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(current.word);
    u.lang = "en-US";
    speechSynthesis.speak(u);
  };

  const handleCardTap = () => {
    setStep((p) => Math.min(p + 1, 2));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;

      const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      const parsed = lines.map(line => {
        const [word, meaning, sentence, sentence_jp] = parseCSVLine(line);
        return { word, meaning, sentence, sentence_jp };
      }).filter(e => e.word);

      setEntries(prev => {
        const map = new Map();
        [...prev, ...parsed].forEach(e => map.set(e.word, e));
        return Array.from(map.values());
      });
    };

    reader.readAsText(file);
  };

  const rankingList = useMemo(() => {
    return entries
      .map(e => ({ ...e, count: mistakes[e.word] || 0 }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [entries, mistakes]);

  // ===== HOME =====
  if (screen === "home") {
    return (
      <div style={{ ...containerCenter, minHeight: "100vh", background: "#f5f5f5", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, background: "white", padding: 20, borderRadius: 16, textAlign: "center" }}>

          <h1>英単語テストアプリ</h1>

          <p>インポート済み: {entries.length}語</p>

          <p>－ 単語テスト －</p>
          <div style={containerCenter}>
            <button style={largeBtnStyle} onClick={() => { setMode("all"); startTest(); }}>すべて</button>
            <button style={largeBtnStyle} onClick={() => { setMode("weak"); startTest(); }}>苦手優先</button>
            <button style={largeBtnStyle} onClick={() => { setMode("all"); startTest(); }}>テスト</button>
          </div>

          <p>－ 苦手ランキング －</p>
          <button style={largeBtnStyle} onClick={() => setScreen("ranking")}>苦手単語</button>

          <p>－ 単語インポート －</p>
          <div style={{ position: "relative", width: 220, margin: "0 auto" }}>
            <div style={largeBtnStyle}>ファイルを選択</div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0 }}
            />
          </div>

        </div>
      </div>
    );
  }

  // ===== RANKING =====
  if (screen === "ranking") {
    return (
      <div style={{ ...containerCenter, minHeight: "100vh", background: "#f5f5f5", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, background: "white", padding: 20, borderRadius: 16 }}>

          <button onClick={() => setScreen("home")}>← ホーム</button>
          <h2>苦手単語</h2>

          {rankingList.length === 0 ? (
            <p>まだデータなし</p>
          ) : (
            rankingList.map(e => (
              <div key={e.word} style={{ borderBottom: "1px solid #ddd", padding: 10 }}>
                <b>{e.word}</b>
                <div>{e.meaning}</div>
                <div>間違えた回数: {e.count}</div>
              </div>
            ))
          )}

        </div>
      </div>
    );
  }

  // ===== TEST =====
  return (
    <div style={{ ...containerCenter, minHeight: "100vh", background: "#f5f5f5", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "white", padding: 20, borderRadius: 16 }}>

        <button onClick={() => setScreen("home")}>← ホーム</button>

        <div onClick={handleCardTap} style={{ border: "1px solid #333", borderRadius: 16, padding: 20, textAlign: "center", marginTop: 20 }}>
          {current && (
            <>
              <div style={{ fontSize: 24, fontWeight: "bold" }}>{current.word}</div>
              <div style={{ opacity: step >= 2 ? 1 : 0 }}>{current.meaning || " "}</div>
              <div style={{ opacity: step >= 1 ? 1 : 0 }}>{renderWithBold(current.sentence) || " "}</div>
              <div style={{ opacity: step >= 2 ? 1 : 0 }}>{current.sentence_jp || " "}</div>
            </>
          )}
        </div>

        <div style={containerCenter}>
          <button style={largeBtnStyle} onClick={handleNext}>次へ</button>
          <button style={largeBtnStyle} onClick={handleWrong}>間違えた</button>
          <button style={largeBtnStyle} onClick={handleSpeak}>🔊 発音</button>
        </div>

      </div>
    </div>
  );
}