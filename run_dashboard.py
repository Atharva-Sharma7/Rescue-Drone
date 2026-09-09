"""
AI-Powered Drone Search & Rescue System - Local Mission Control Runner
Smart India Hackathon (SIH) Project
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Clean tactical logger
        sys.stdout.write(f"[MISSION CONTROL SERVER] {self.address_string()} - {format % args}\n")

def open_browser():
    time.sleep(1.2)
    url = f"http://localhost:{PORT}"
    print(f"\n[+] Launching Tactical Mission Control in browser: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    print("=" * 70)
    print(" AI-POWERED QUADCOPTER DRONE SEARCH & RESCUE SYSTEM - SIH EDITION")
    print(" Edge Mission Control Dashboard & Sensor Fusion Simulator")
    print("=" * 70)
    print(f"[*] Serving files from: {DIRECTORY}")
    print(f"[*] Server initialized at: http://localhost:{PORT}")
    print("[*] Press Ctrl+C to safely shut down.")
    print("=" * 70)

    threading.Thread(target=open_browser, daemon=True).start()

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[!] Mission Control Server stopped cleanly.")
