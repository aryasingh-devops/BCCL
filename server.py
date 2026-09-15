from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import sqlite3
import secrets
from pathlib import Path
from urllib.parse import parse_qs, urlparse


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "bccl_welfare.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
ALLOWED_STATUSES = {"Pending", "In Progress", "Resolved"}
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "bccl123"
ADMIN_SESSIONS = set()


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    with get_connection() as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


class BCCLRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Credentials", "true")
        super().end_headers()

    def get_cookie_value(self, name):
        cookies = self.headers.get("Cookie", "")
        for cookie in cookies.split(";"):
            if "=" in cookie:
                key, value = cookie.strip().split("=", 1)
                if key == name:
                    return value
        return None

    def is_admin_authenticated(self):
        session_token = self.get_cookie_value("admin_session")
        return session_token in ADMIN_SESSIONS

    def send_json(self, payload, status=200, cookies=None):
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        if cookies:
            for cookie in cookies:
                self.send_header("Set-Cookie", cookie)
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()
        self.close_connection = True

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/grievances":
            self.handle_list_grievances(parsed.query)
            return
        if parsed.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/admin/login":
            self.handle_admin_login()
            return
        if parsed.path == "/api/admin/logout":
            self.handle_admin_logout()
            return
        if parsed.path == "/api/grievances":
            self.handle_create_grievance()
            return
        if parsed.path.startswith("/api/grievances/") and parsed.path.endswith("/status"):
            grievance_id = parsed.path.split("/")[3]
            self.handle_update_status(grievance_id)
            return
        self.send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/grievances/") and parsed.path.endswith("/status"):
            grievance_id = parsed.path.split("/")[3]
            self.handle_update_status(grievance_id)
            return
        self.send_json({"error": "Endpoint not found"}, 404)

    def read_request_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        if not body:
            return {}
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            return json.loads(body)
        parsed = parse_qs(body)
        return {key: values[0] for key, values in parsed.items()}

    def handle_list_grievances(self, query_string):
        if not self.is_admin_authenticated():
            self.send_json({"error": "Unauthorized"}, 401)
            return

        status = parse_qs(query_string).get("status", [""])[0]
        sql = "SELECT * FROM grievances"
        params = []
        if status:
            sql += " WHERE status = ?"
            params.append(status)
        sql += " ORDER BY id DESC"

        with get_connection() as connection:
            rows = connection.execute(sql, params).fetchall()
        self.send_json({"records": [row_to_dict(row) for row in rows]})

    def handle_create_grievance(self):
        try:
            data = self.read_request_body()
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, 400)
            return

        required_fields = [
            "employee_name",
            "employee_id",
            "department",
            "township",
            "phone",
            "category",
            "subject",
            "description",
        ]
        missing = [field for field in required_fields if not data.get(field)]
        if missing:
            self.send_json({"error": "Missing required fields", "fields": missing}, 400)
            return

        values = {
            "employee_name": data["employee_name"].strip(),
            "employee_id": data["employee_id"].strip(),
            "department": data["department"].strip(),
            "township": data["township"].strip(),
            "quarter_no": data.get("quarter_no", "").strip(),
            "phone": data["phone"].strip(),
            "email": data.get("email", "").strip(),
            "category": data["category"].strip(),
            "subject": data["subject"].strip(),
            "description": data["description"].strip(),
        }

        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO grievances (
                    employee_name, employee_id, department, township, quarter_no,
                    phone, email, category, subject, description
                )
                VALUES (
                    :employee_name, :employee_id, :department, :township, :quarter_no,
                    :phone, :email, :category, :subject, :description
                )
                """,
                values,
            )
            record = connection.execute(
                "SELECT * FROM grievances WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()

        self.send_json({"message": "Grievance submitted successfully", "record": row_to_dict(record)}, 201)

    def handle_admin_login(self):
        try:
            data = self.read_request_body()
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, 400)
            return

        username = (data.get("username") or "").strip()
        password = data.get("password") or ""
        if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
            self.send_json({"error": "Invalid credentials"}, 401)
            return

        session_token = secrets.token_hex(16)
        ADMIN_SESSIONS.add(session_token)
        cookie = f"admin_session={session_token}; Path=/; HttpOnly; SameSite=Lax"
        self.send_json({"message": "Login successful"}, 200, cookies=[cookie])

    def handle_admin_logout(self):
        session_token = self.get_cookie_value("admin_session")
        if session_token in ADMIN_SESSIONS:
            ADMIN_SESSIONS.remove(session_token)
        cookie = "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
        self.send_json({"message": "Logout successful"}, 200, cookies=[cookie])

    def handle_update_status(self, grievance_id):
        if not self.is_admin_authenticated():
            self.send_json({"error": "Unauthorized"}, 401)
            return

        try:
            record_id = int(grievance_id)
            data = self.read_request_body()
        except (ValueError, json.JSONDecodeError):
            self.send_json({"error": "Invalid request"}, 400)
            return

        status = data.get("status")
        if status not in ALLOWED_STATUSES:
            self.send_json({"error": "Invalid status"}, 400)
            return

        with get_connection() as connection:
            cursor = connection.execute(
                "UPDATE grievances SET status = ? WHERE id = ?",
                (status, record_id),
            )
            if cursor.rowcount == 0:
                self.send_json({"error": "Record not found"}, 404)
                return
            record = connection.execute(
                "SELECT * FROM grievances WHERE id = ?", (record_id,)
            ).fetchone()

        self.send_json({"message": "Status updated", "record": row_to_dict(record)})


def run():
    init_database()
    server_address = ("", 8000)
    httpd = ThreadingHTTPServer(server_address, BCCLRequestHandler)
    print("BCCL Welfare website running at http://localhost:8000")
    print(f"Database ready at {DB_PATH}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()
