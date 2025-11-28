// 移除 Edge Runtime 設定，使用預設 Node.js，穩定性較高
export default async function handler(req, res) {
  // 1. 設定 CORS 標頭，允許跨域請求 (解決本地測試或網域問題)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理 OPTIONS 預檢請求 (瀏覽器安全機制)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允許 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 檢查 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("錯誤：Vercel 環境變數中找不到 GEMINI_API_KEY");
    return res.status(500).json({ error: 'Server Configuration Error: API Key missing.' });
  }

  const { userQuery, systemPrompt, modelName, useSearch } = req.body;

  try {
    // 3. 呼叫 Google Gemini API
    console.log(`正在呼叫模型: ${modelName}`);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // 只有在需要搜尋時才加入 tools
        tools: useSearch ? [{ "google_search": {} }] : undefined
      })
    });

    // 4. 處理 Google API 錯誤
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API 回傳錯誤:", errorText);
      return res.status(response.status).json({ 
        error: 'Gemini API Error', 
        status: response.status,
        details: errorText 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("伺服器內部錯誤:", error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
