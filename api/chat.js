export default async function handler(req, res) {
  // 1. 設定 CORS 標頭，允許跨域請求
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'thailamei.vercel.app'); // 部署到正式環境後，請將 * 替換為您的 Vercel 域名
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理 OPTIONS 預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 2. 檢查 API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("錯誤：Vercel 環境變數中找不到 GEMINI_API_KEY");
    return res.status(500).json({ error: 'Server Configuration Error: API Key missing.' });
  }

  const { messages, systemPrompt, modelName, useSearch } = req.body;

  try {
    // 3. 轉換對話歷史格式 (前端: user/assistant -> Gemini API: user/model)
    // 這裡我們將整個歷史記錄陣列轉換為 contents 結構
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user', // Gemini API 使用 'model'
      parts: [{ text: msg.text }]
    }));

    // 4. 呼叫 Google Gemini API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents, // <-- 傳遞轉換後的整個對話歷史
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: useSearch ? [{ "google_search": {} }] : undefined
      })
    });

    // 5. 處理 Google API 錯誤
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
