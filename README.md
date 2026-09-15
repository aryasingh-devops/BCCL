# BCCL Employees Welfare and Township Management

A web-based academic project for demonstrating employee welfare, township-service, and grievance-management workflows for Bharat Coking Coal Limited (BCCL), Dhanbad.

The portal gives employees a single place to explore welfare and township services, submit grievances, and view contact information. A protected admin dashboard lets an administrator review recorded grievances, filter them by status, and move them through the resolution workflow.

> **Project notice:** This repository is a student/academic project and is not an official BCCL website or production service. It contains demo data and development-only credentials. Do not submit personal, confidential, or real employee information.

## Features

- Responsive multi-page portal for employee welfare and township services
- Service information covering housing, utilities, sanitation, healthcare, education, recreation, and welfare support
- Grievance form with validation for employee, township, contact, category, and issue details
- SQLite-backed grievance records with `Pending`, `In Progress`, and `Resolved` statuses
- Admin login, status filtering, refresh, and logout
- Browser-local fallback records when the backend is unavailable
- Mobile navigation and a contact page

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- Python standard-library HTTP server
- SQLite

## Run locally

### Prerequisites

- Python 3.8 or newer
- A modern web browser

### Windows

Double-click `start_app.bat`, or run the following from the project folder:

```bat
run_backend.bat --open
```

The application starts at [http://localhost:8000](http://localhost:8000). The batch file first looks for the included embedded Python runtime, then for an installed Python interpreter.

### Any platform with Python

```bash
python server.py
```

Then open [http://localhost:8000](http://localhost:8000).

The server creates and initializes `bccl_welfare.db` from `schema.sql` if needed.

## Admin access for local development

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `bccl123` |

These credentials are hard-coded for demonstration only. Change them before deploying or sharing the application.

## Project structure

```text
.
|-- index.html          # Landing page
|-- about.html          # Project purpose and service scope
|-- services.html       # Welfare and township service overview
|-- grievance.html      # Employee grievance submission form
|-- admin.html          # Grievance administration dashboard
|-- contact.html        # Contact information and contact form
|-- style.css           # Shared visual styles and responsive layout
|-- script.js           # Client-side interactions and API calls
|-- server.py           # HTTP server and grievance API
|-- schema.sql          # SQLite schema and sample grievance
|-- bccl_welfare.db     # Local SQLite database
|-- run_backend.bat     # Windows backend launcher
`-- start_app.bat       # Windows launcher that opens the dashboard
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/login` | Authenticate the local admin user |
| `POST` | `/api/admin/logout` | End the admin session |
| `GET` | `/api/grievances` | List grievances; requires admin authentication |
| `POST` | `/api/grievances` | Create a grievance |
| `POST` or `PUT` | `/api/grievances/:id/status` | Update a grievance status; requires admin authentication |

## Screenshots

Sample interface captures are available in the [`screenshots`](screenshots) folder.

## Current limitations

- The server is intended for local development, not public deployment.
- Admin credentials and sessions are stored in application memory; sessions disappear when the server restarts.
- The application has no user accounts, role management, password hashing, CSRF protection, rate limiting, audit logs, or production-grade input and security controls.
- The contact form currently displays a confirmation message only; it does not send email.
- Local browser fallback records are separate from the SQLite database and can be cleared with browser storage.

## Suggested next improvements

- Move secrets into environment variables and use hashed passwords.
- Add an employee authentication flow and role-based access control.
- Use a production web framework, persistent session store, HTTPS, CSRF protection, validation, and logging.
- Add attachment support, acknowledgements, notifications, and a grievance tracking view.
- Add automated tests and a deployment configuration.

## Background

The repository accompanies the *Employees Welfare and Township Management* academic project report. The portal focuses on digitalizing common welfare and township-support workflows, especially grievance reporting and administrative tracking.
