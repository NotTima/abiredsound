#!/usr/bin/env python3
"""Локальный статический сервер для ABI RedSound (без Node.js)."""
import http.server
import mimetypes
import os
import socketserver
import sys

PORT = int(os.environ.get("PORT", 8080))
ROOT = os.path.dirname(os.path.abspath(__file__))

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("audio/ogg", ".ogg")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/manifest+json", ".webmanifest")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def guess_type(self, path):
        if path.endswith("api/catalog"):
            return "application/json; charset=utf-8"
        return super().guess_type(path)


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"ABI RedSound запущен: http://localhost:{PORT}/site/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            sys.exit(0)
