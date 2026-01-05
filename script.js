// ==========================================
// 設定エリア (Google Forms連携)
// ==========================================
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1DvjfHWDnxe9LJXZXAOY47dAN80rSCgWQEaU-aNMpc3c/formResponse';
const ENTRY_ID_SONG = 'entry.625876421';
const ENTRY_ID_ARTIST = 'entry.385476764';
// ==========================================

const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');
const resultSection = document.getElementById('result-section');
const loadingDiv = document.getElementById('loading');
const outputContent = document.getElementById('output-content');

analyzeBtn.addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key').value;
    const modelVersion = document.getElementById('model-select').value;
    const songTitle = document.getElementById('song-title').value;
    const artistName = document.getElementById('artist-name').value;
    const rawLyrics = document.getElementById('lyrics-input').value; // 歌詞入力

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
        // 歌詞がある場合とない場合で処理を分ける
        const report = await callGeminiAPI(apiKey, modelVersion, songTitle, artistName, rawLyrics);
        
        loadingDiv.classList.add('hidden');
        outputContent.innerHTML = marked.parse(report);
        
        // 歌詞を入力していない場合のみ、確認用リンクを表示
        if (!rawLyrics.trim()) {
            addSearchLinkButton(songTitle, artistName);
        }
        
        outputContent.dataset.rawMarkdown = report;

    } catch (error) {
        loadingDiv.classList.add('hidden');
        outputContent.innerHTML = `<p style="color:red;">エラーが発生しました: ${error.message}</p><p>※APIキーの設定やモデルのバージョンを確認してください。</p>`;
        analyzeBtn.disabled = false;
    }
});

resetBtn.addEventListener('click', () => {
    document.getElementById('song-title').value = '';
    document.getElementById('artist-name').value = '';
    document.getElementById('lyrics-input').value = '';
    resultSection.classList.add('hidden');
    outputContent.innerHTML = '';
    analyzeBtn.disabled = false;
});

async function callGeminiAPI(apiKey, model, song, artist, lyrics) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    let promptText = "";
    let toolsConfig = [];

    // 【分岐】歌詞が直接入力されている場合
    if (lyrics.trim()) {
        promptText = `
あなたはプロの音楽評論家です。
以下の**提供された歌詞**を読み込み、分析してください。
Web検索は不要です。提供されたテキストのみを正として扱ってください。

【楽曲情報】
曲名: ${song}
アーティスト: ${artist}

【歌詞テキスト】
${lyrics}

【分析フォーマット】
以下の4つの視点で分析し、それぞれの「想定対象年齢」を判定してください。
1. **【語彙・漢字レベル】（読む力）**
2. **【精神性・情緒レベル】（感じる力）**
3. **【生活感・リアリティ】（暮らす力）**
4. **【文脈・哲学レベル】（問いの重さ）**
最後に「総合的な想定対象年齢」と総評をまとめてください。
出力はMarkdown形式で行ってください。
`;
    } 
    // 【分岐】歌詞が空欄の場合（Web検索機能を使う）
    else {
        promptText = `
あなたはプロの音楽評論家です。
以下の楽曲の**正確な歌詞**をGoogle検索機能を使って探し出し、その内容に基づいて分析してください。

【検索対象】
曲名: ${song}
アーティスト: ${artist}

【重要】
- 必ずGoogle検索ツールを使用して、実際の歌詞を確認してください。
- 歌詞が見つからない、または不確かな場合は、正直に「歌詞が見つかりませんでした」と報告してください。
- 幻覚（存在しない歌詞の捏造）は絶対にしないでください。

【分析フォーマット】
（歌詞が見つかった場合のみ以下を出力）
以下の4つの視点で分析し、それぞれの「想定対象年齢」を判定してください。
1. **【語彙・漢字レベル】（読む力）**
2. **【精神性・情緒レベル】（感じる力）**
3. **【生活感・リアリティ】（暮らす力）**
4. **【文脈・哲学レベル】（問いの重さ）**
最後に「総合的な想定対象年齢」と総評をまとめてください。
出力はMarkdown形式で行ってください。
`;
        
        // 【修正箇所】検索ツールの定義を修正
        // google_search_retrieval ではなく google_search を使用
        toolsConfig = [{
            google_search: {}
        }];
    }

    const requestBody = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    // 検索が必要な場合のみtoolsを追加
    if (toolsConfig.length > 0) {
        requestBody.tools = toolsConfig;
    }

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
    
    // 検索結果が含まれているかチェック（デバッグ用）
    if (data.candidates[0].groundingMetadata) {
        console.log("Grounding used:", data.candidates[0].groundingMetadata);
    }

    return data.candidates[0].content.parts[0].text;
}

function sendToGoogleForm(song, artist) {
    if (!GOOGLE_FORM_URL || GOOGLE_FORM_URL.includes('YOUR_FORM_ID_HERE')) {
        console.warn('Google Form URL is not configured correctly.');
        return;
    }

    const formData = new FormData();
    formData.append(ENTRY_ID_SONG, song);
    formData.append(ENTRY_ID_ARTIST, artist);

    fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
    })
    .then(() => console.log('Form submission request sent.'))
    .catch(e => console.error('Form submission failed:', e));
}

function addSearchLinkButton(song, artist) {
    const query = encodeURIComponent(`${artist} ${song} 歌詞`);
    const googleSearchUrl = `https://www.google.com/search?q=${query}`;
    const buttonHtml = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ccc;">
            <p style="font-size: 0.9em; color: #666;">※AIによる自動検索で分析しました。念のためご自身でも確認できます：</p>
            <a href="${googleSearchUrl}" target="_blank" style="display:inline-block; background:#4285f4; color:white; padding:8px 15px; text-decoration:none; border-radius:5px;">Googleで歌詞検索</a>
        </div>
    `;
    outputContent.insertAdjacentHTML('beforeend', buttonHtml);
}

function exportReport(type) {
    const rawText = outputContent.dataset.rawMarkdown;
    if (!rawText) return;
    let content = rawText;
    let mimeType = 'text/plain';
    let extension = 'txt';
    if (type === 'md') { extension = 'md'; }
    else if (type === 'html') {
        content = `<!DOCTYPE html><html><body>${marked.parse(rawText)}</body></html>`;
        mimeType = 'text/html';
        extension = 'html';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyrics_analysis.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}