// ==========================================
// 設定エリア (Google Formsの情報をここに設定)
// ==========================================
// Google Formsの「送信」ボタンのリンクではなく、回答画面のソースコードから取得したaction URL
// 例: https://docs.google.com/forms/u/0/d/e/xxxxx/formResponse
const GOOGLE_FORM_URL = 'YOUR_GOOGLE_FORM_ACTION_URL'; 

// 各質問項目のname属性 (entry.xxxxxx)
const ENTRY_ID_SONG = 'entry.625876421';   // 曲名のID
const ENTRY_ID_ARTIST = 'entry.385476764'; // アーティスト名のID
// ==========================================

const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');
const resultSection = document.getElementById('result-section');
const loadingDiv = document.getElementById('loading');
const outputContent = document.getElementById('output-content');

// 分析実行
analyzeBtn.addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key').value;
    const modelVersion = document.getElementById('model-select').value;
    const songTitle = document.getElementById('song-title').value;
    const artistName = document.getElementById('artist-name').value;

    if (!apiKey || !songTitle || !artistName) {
        alert('APIキー、曲名、アーティスト名は必須です。');
        return;
    }

    // UI切り替え
    analyzeBtn.disabled = true;
    resultSection.classList.remove('hidden');
    loadingDiv.classList.remove('hidden');
    outputContent.innerHTML = '';

    // Google Formsへ送信 (バックグラウンドで実行)
    sendToGoogleForm(songTitle, artistName);

    try {
        // Gemini APIへのリクエスト
        const report = await callGeminiAPI(apiKey, modelVersion, songTitle, artistName);
        
        // 結果表示 (MarkdownをHTMLに変換)
        loadingDiv.classList.add('hidden');
        outputContent.innerHTML = marked.parse(report);
        
        // 生データを保存（エクスポート用）
        outputContent.dataset.rawMarkdown = report;

    } catch (error) {
        loadingDiv.classList.add('hidden');
        outputContent.innerHTML = `<p style="color:red;">エラーが発生しました: ${error.message}</p>`;
        analyzeBtn.disabled = false;
    }
});

// リセット機能
resetBtn.addEventListener('click', () => {
    document.getElementById('song-title').value = '';
    document.getElementById('artist-name').value = '';
    resultSection.classList.add('hidden');
    outputContent.innerHTML = '';
    analyzeBtn.disabled = false;
});

// Gemini API呼び出し関数
async function callGeminiAPI(apiKey, model, song, artist) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // プロンプトの構築
    const promptText = `
あなたはプロの音楽評論家であり、言語学者です。
以下の楽曲の歌詞を検索し、内容を正確に把握した上で分析してください。

【対象楽曲】
曲名: ${song}
アーティスト: ${artist}

【重要事項】
1. 必ずWeb検索機能(Grounding)または自身の知識を用いて、**正しい歌詞**を確認してください。幻覚による架空の歌詞分析は禁止です。
2. 歌詞の引用元URLが明確な場合は、そのリンクが現在も有効か確認し、レポートの末尾に記載してください。

【分析フォーマット】
以下の4つの視点で分析し、それぞれの「対象年齢」を判定してください。
最後に「総合的な対象年齢」と総評をまとめてください。

1. **【語彙・漢字レベル】（読む力）**
   - 使われている漢字の難易度（学年別配当など）、言葉の選び方。
2. **【精神性・情緒レベル】（感じる力）**
   - 描かれている感情の複雑さ。子供の純粋さか、大人の諦念か、思春期の葛藤か。
3. **【生活感・リアリティ】（暮らす力）**
   - 描かれている生活背景。学校、仕事、家庭、貧困、孤独など。
4. **【文脈・哲学レベル】（問いの重さ）**
   - 歌詞の裏にあるメッセージや、読み解くのに必要な人生経験。

出力はMarkdown形式で行ってください。
`;

    const requestBody = {
        contents: [{
            parts: [{ text: promptText }]
        }]
        // 2026年のGemini 2.5 Flashは検索機能が統合されている前提ですが、
        // 必要に応じて tools: [{ google_search: {} }] などを追加する想定
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'API Request Failed');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Google Forms送信関数 (no-corsモード)
function sendToGoogleForm(song, artist) {
    if (GOOGLE_FORM_URL === 'YOUR_GOOGLE_FORM_ACTION_URL') return; // 設定されていない場合はスキップ

    const formData = new FormData();
    formData.append(ENTRY_ID_SONG, song);
    formData.append(ENTRY_ID_ARTIST, artist);

    fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
    }).catch(err => console.log('Form submission failed (expected in no-cors):', err));
}

// エクスポート機能
function exportReport(type) {
    const rawText = outputContent.dataset.rawMarkdown;
    if (!rawText) return;

    let content = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (type === 'md') {
        content = rawText;
        extension = 'md';
    } else if (type === 'html') {
        content = `<!DOCTYPE html><html><body>${marked.parse(rawText)}</body></html>`;
        mimeType = 'text/html';
        extension = 'html';
    } else {
        content = rawText;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyrics_analysis_${new Date().getTime()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}