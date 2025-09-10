import os
import sys
import time
import requests
from threading import Timer
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='public')

# A secret key is required for Flask session management
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-please-change')

PIHOLE_URL = os.getenv("PIHOLE_URL")
PIHOLE_PASSWORD = os.getenv("PIHOLE_PASSWORD")

if not PIHOLE_URL or not PIHOLE_PASSWORD:
    print("Error: Pi-hole URL or password not set in .env file.", file=sys.stderr)
    sys.exit(1)

# --- Authentication Decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Session ID (SID) Caching ---
session_id = None
sid_expires = 0

def get_session_id():
    global session_id, sid_expires
    if time.time() < sid_expires and session_id:
        return session_id
    try:
        auth_url = f"{PIHOLE_URL}/api/auth"
        response = requests.post(auth_url, json={"password": PIHOLE_PASSWORD})
        response.raise_for_status()
        data = response.json()
        sid = data.get('session', {}).get('sid')
        if not sid: raise ValueError("SID not found")
        validity = data.get('session', {}).get('validity', 1800)
        sid_expires = time.time() + validity - 10
        session_id = sid
        return session_id
    except Exception as e:
        print(f"Error getting session ID: {e}", file=sys.stderr)
        raise ConnectionError("Could not authenticate with Pi-hole.")

def make_authenticated_request(method, url, **kwargs):
    sid = get_session_id()
    headers = kwargs.get("headers", {})
    headers["X-FTL-SID"] = sid
    kwargs["headers"] = headers
    return requests.request(method, url, **kwargs)

# --- Domain Re-enabling Logic ---
def re_enable_domain(domain_id):
    try:
        url = f"{PIHOLE_URL}/api/domains/{domain_id}"
        response = make_authenticated_request("PATCH", url, json={"enabled": True})
        response.raise_for_status()
        print(f"Domain {domain_id} has been re-enabled.")
    except Exception as e:
        print(f"Error re-enabling domain {domain_id}: {e}", file=sys.stderr)

# --- API Routes ---
@app.route('/api/login', methods=['POST'])
def login():
    password = request.json.get('password')
    if password == PIHOLE_PASSWORD:
        session['logged_in'] = True
        return jsonify({"message": "Login successful."})
    else:
        return jsonify({"error": "Invalid password."}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    """
    Clears the session to log the user out.
    """
    session.clear()
    return jsonify({"message": "Logout successful."})

@app.route('/api/check-auth')
@login_required
def check_auth():
    return jsonify({"message": "Authenticated."})

@app.route('/api/domains')
@login_required
def get_domains():
    try:
        url = f"{PIHOLE_URL}/api/domains"
        response = make_authenticated_request("GET", url)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/disable-domain', methods=['POST'])
@login_required
def disable_domain():
    data = request.get_json()
    domain_id = data.get('domainId')
    duration_minutes = data.get('duration')
    if not domain_id or not duration_minutes:
        return jsonify({"error": "Domain ID and duration are required."}), 400
    try:
        duration_minutes = int(duration_minutes)
        url = f"{PIHOLE_URL}/api/domains/{domain_id}"
        response = make_authenticated_request("PATCH", url, json={"enabled": False})
        response.raise_for_status()
        print(f"Domain {domain_id} disabled for {duration_minutes} minutes.")
        timer = Timer(duration_minutes * 60, re_enable_domain, args=[domain_id])
        timer.start()
        return jsonify({"message": f"Domain {domain_id} disabled for {duration_minutes} minutes."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Frontend Serving ---
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=3000, debug=True)
