import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

HOST = os.getenv("MAXI_HOST", "127.0.0.1")
PORT = int(os.getenv("MAXI_PORT", "8787"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MAX_BODY_BYTES = 64 * 1024


class MaxiHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(204, {})

    def do_GET(self):
        if self.path == "/api/health":
            self._send_json(200, {
                "ok": True,
                "service": "maxi-backend",
                "geminiConfigured": bool(GEMINI_API_KEY),
                "model": GEMINI_MODEL,
            })
            return
        self._send_json(404, {"error": "Route not found"})

    def do_POST(self):
        if self.path != "/api/chat":
            self._send_json(404, {"error": "Route not found"})
            return
        if not GEMINI_API_KEY:
            self._send_json(503, {"error": "GEMINI_API_KEY is not configured on the server"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                raise ValueError("Request body must be between 1 byte and 64 KB")
            request_data = json.loads(self.rfile.read(content_length))
            contents = request_data.get("contents")
            system_instruction = request_data.get("systemInstruction")
            if not isinstance(contents, list) or not contents:
                raise ValueError("contents must be a non-empty array")
            answer = ask_gemini(contents, system_instruction)
            self._send_json(200, {"text": answer, "model": GEMINI_MODEL})
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
        except Exception as error:
            self._send_json(502, {"error": str(error)})

    def log_message(self, format_string, *args):
        print(f"{self.address_string()} - {format_string % args}")


def ask_gemini(contents, system_instruction):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": contents, "generationConfig": {"temperature": 0.7}}
    if system_instruction:
        payload["systemInstruction"] = system_instruction
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(details).get("error", {}).get("message", details)
        except json.JSONDecodeError:
            message = details
        raise RuntimeError(f"Gemini request failed ({error.code}): {message}") from error
    except URLError as error:
        raise RuntimeError(f"Gemini network request failed: {error.reason}") from error
    answer = "".join(part.get("text", "") for part in result.get("candidates", [{}])[0].get("content", {}).get("parts", []))
    if not answer.strip():
        raise RuntimeError("Gemini returned an empty response")
    return answer.strip()


if __name__ == "__main__":
    print(f"Maxi backend listening at http://{HOST}:{PORT}")
    print(f"Gemini configured: {bool(GEMINI_API_KEY)}")
    ThreadingHTTPServer((HOST, PORT), MaxiHandler).serve_forever()
