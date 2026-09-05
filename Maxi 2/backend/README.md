# Maxi backend

This small API keeps the Gemini key on the server instead of in the browser.

## Run on Windows PowerShell

```powershell
$env:GEMINI_API_KEY = "your-key"
python .\backend\server.py
```

The health check is available at `http://127.0.0.1:8787/api/health`.

The chat endpoint accepts:

```json
{
  "systemInstruction": {"parts": [{"text": "You are Maxi."}]},
  "contents": [
    {"role": "user", "parts": [{"text": "Hello"}]}
  ]
}
```

Do not expose this development server directly to the public internet. Production needs HTTPS, authentication, rate limiting, and a real database for users, memories, and conversations.
