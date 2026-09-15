const BACKEND_ORIGIN = "http://localhost:8000";
const API_BASE = BACKEND_ORIGIN;

const LOCAL_STORAGE_KEY = "bccl_grievance_fallback_records";

function showMessage(element, message, type = "success") {
    if (!element) return;
    element.hidden = false;
    element.textContent = message;
    element.className = `form-message ${type}`;
}

function showAdminPanel(show) {
    const panel = document.getElementById("adminPanel");
    const loginSection = document.getElementById("adminLoginSection");
    if (panel) panel.hidden = !show;
    if (loginSection) loginSection.hidden = show;
    if (show) {
        const adminMessage = document.getElementById("adminMessage");
        if (adminMessage) {
            adminMessage.hidden = true;
            adminMessage.textContent = "";
        }
        loadGrievances();
    }
}

async function handleAdminLogin(event) {
    event.preventDefault();
    const username = document.getElementById("adminUsername")?.value.trim();
    const password = document.getElementById("adminPassword")?.value;
    const loginMessage = document.getElementById("adminLoginMessage");

    if (!username || !password) {
        showMessage(loginMessage, "Enter both username and password.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: new URLSearchParams({ username, password }),
        });
        const result = await readJsonResponse(response);
        if (!response.ok) {
            throw new Error(result.error || "Unable to login.");
        }

        showAdminPanel(true);
        const adminMessage = document.getElementById("adminMessage");
        if (adminMessage) {
            showMessage(adminMessage, "Login successful. Grievance records are now visible.", "success");
        }
        if (loginMessage) {
            loginMessage.hidden = true;
        }
    } catch (error) {
        showMessage(loginMessage, error.message || "Unable to login.", "error");
    }
}

async function handleAdminLogout() {
    const loginMessage = document.getElementById("adminLoginMessage");
    try {
        const response = await fetch(`${API_BASE}/api/admin/logout`, {
            method: "POST",
        });
        await readJsonResponse(response);
    } catch {
        // ignore error and still return to login view
    }
    showAdminPanel(false);
    showMessage(loginMessage, "Logged out. Enter admin credentials to view records.", "success");
}

function getFormData(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function isLocalFileAccess() {
    return window.location.protocol === "file:";
}

function disablePageActions(messageText) {
    const noticeElement =
        document.getElementById("adminMessage") ||
        document.getElementById("adminLoginMessage") ||
        document.getElementById("grievanceMessage");
    if (noticeElement) {
        showMessage(noticeElement, messageText, "warning");
    }
    const controls = document.querySelectorAll("input,textarea,select,button");
    controls.forEach((control) => {
        if (!control.closest(".nav-links")) {
            control.disabled = true;
        }
    });
}

function getFallbackRecords() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveFallbackRecords(records) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
}

function getNextFallbackId() {
    const records = getFallbackRecords();
    if (!records.length) {
        return 1000;
    }
    return Math.max(...records.map((record) => Number(record.id) || 0)) + 1;
}

function formatLocalCreatedAt() {
    return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function createLocalFallbackGrievance(data) {
    const record = {
        id: getNextFallbackId(),
        employee_name: data.employee_name || "",
        employee_id: data.employee_id || "",
        department: data.department || "",
        township: data.township || "",
        quarter_no: data.quarter_no || "",
        phone: data.phone || "",
        email: data.email || "",
        category: data.category || "",
        subject: data.subject || "",
        description: data.description || "",
        status: "Pending",
        created_at: formatLocalCreatedAt(),
    };
    const records = [record, ...getFallbackRecords()];
    saveFallbackRecords(records);
    return record;
}

function updateLocalFallbackStatus(recordId, status) {
    const records = getFallbackRecords();
    let updated = false;
    const next = records.map((record) => {
        if (Number(record.id) === Number(recordId)) {
            updated = true;
            return { ...record, status };
        }
        return record;
    });
    if (updated) {
        saveFallbackRecords(next);
    }
    return updated;
}

function isBackendNetworkError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
        message.includes("fetch") ||
        message.includes("networkerror") ||
        message.includes("failed to fetch") ||
        message.includes("backend returned an empty response") ||
        message.includes("unexpected token") ||
        message.includes("invalid json") ||
        message.includes("no json")
    );
}

async function submitGrievance(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const messageBox = document.getElementById("grievanceMessage");
    const payload = getFormData(form);

    try {
        const response = await fetch(`${API_BASE}/api/grievances`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: new URLSearchParams(payload),
        });
        const result = await readJsonResponse(response);

        if (!response.ok) {
            throw new Error(result.error || "Unable to submit grievance.");
        }

        showMessage(messageBox, `Grievance saved successfully. Record ID: ${result.record.id}`, "success");
        form.reset();
    } catch (error) {
        if (isBackendNetworkError(error)) {
            const record = createLocalFallbackGrievance(payload);
            showMessage(
                messageBox,
                `Grievance saved locally (ID: ${record.id}) because the backend is unavailable.`,
                "warning"
            );
            form.reset();
            return;
        }
        showMessage(messageBox, error.message || "Unable to submit grievance.", "error");
    }
}

async function loadGrievances() {
    const tableBody = document.getElementById("recordsTable");
    const statusFilter = document.getElementById("statusFilter");
    const adminMessage = document.getElementById("adminMessage");
    if (!tableBody) return;
    if (adminMessage) {
        adminMessage.hidden = true;
    }

    const params = new URLSearchParams();
    if (statusFilter && statusFilter.value) {
        params.set("status", statusFilter.value);
    }

    tableBody.innerHTML = `<tr><td colspan="9">Loading records...</td></tr>`;

    let records = [];
    try {
        const response = await fetch(`${API_BASE}/api/grievances?${params}`);
        const result = await readJsonResponse(response);

        if (!response.ok) {
            throw new Error(result.error || "Unable to load records.");
        }

        records = result.records;
    } catch (error) {
        const message = String(error.message || error || "").toLowerCase();
        if (message.includes("unauthorized")) {
            showAdminPanel(false);
            const loginMessage = document.getElementById("adminLoginMessage");
            showMessage(loginMessage, "Please login as admin to view grievance records.", "warning");
            tableBody.innerHTML = `<tr><td colspan="9">Please login to view records.</td></tr>`;
            return;
        }

        const fallbackRecords = getFallbackRecords().filter((record) => {
            if (!statusFilter || !statusFilter.value) return true;
            return record.status === statusFilter.value;
        });
        if (fallbackRecords.length) {
            const adminMessage = document.getElementById("adminMessage");
            showMessage(
                adminMessage,
                "Backend unavailable. Showing records stored locally in your browser.",
                "warning"
            );
            records = fallbackRecords;
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        ${escapeHtml(getFriendlyApiError(error))}
                    </td>
                </tr>
            `;
            return;
        }
    }

    if (!records.length) {
        tableBody.innerHTML = `<tr><td colspan="9">No grievance records found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = records.map((record) => `
            <tr>
                <td>${record.id}</td>
                <td>${formatDate(record.created_at)}</td>
                <td>
                    <strong>${escapeHtml(record.employee_name)}</strong><br>
                    <small>${escapeHtml(record.employee_id)} | ${escapeHtml(record.phone)}</small>
                </td>
                <td>${escapeHtml(record.department)}</td>
                <td>${escapeHtml(record.township)}<br><small>${escapeHtml(record.quarter_no || "No quarter")}</small></td>
                <td>${escapeHtml(record.category)}</td>
                <td>
                    <strong>${escapeHtml(record.subject)}</strong><br>
                    <small>${escapeHtml(record.description)}</small>
                </td>
                <td><span class="status-pill ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
                <td>
                    <select class="status-select" data-id="${record.id}">
                        ${["Pending", "In Progress", "Resolved"].map((status) => `
                            <option value="${status}" ${status === record.status ? "selected" : ""}>${status}</option>
                        `).join("")}
                    </select>
                </td>
            </tr>
        `).join("");
}

function getFriendlyApiError(error) {
    const message = String(error.message || error || "").toLowerCase();

    if (window.location.protocol === "file:") {
        return "Please open this page through the local server at http://localhost:8000/admin.html after running run_backend.bat.";
    }

    if (
        message.includes("fetch") ||
        message.includes("networkerror") ||
        message.includes("failed to fetch") ||
        message.includes("backend returned an empty response") ||
        message.includes("unexpected token") ||
        message.includes("invalid json") ||
        message.includes("no json")
    ) {
        return "Backend is not reachable. Start run_backend.bat, then open http://localhost:8000/admin.html";
    }
    return error.message || String(error);
}

async function readJsonResponse(response) {
    const text = await response.text();
    const contentType = response.headers.get("Content-Type") || "";

    if (!text.trim()) {
        if (!response.ok) {
            throw new Error(`Backend error ${response.status} ${response.statusText}.`);
        }
        throw new Error("Backend returned an empty response. Restart run_backend.bat and try again.");
    }

    if (!contentType.toLowerCase().includes("application/json")) {
        if (!response.ok) {
            throw new Error(`Backend error ${response.status} ${response.statusText}.`);
        }
        if (text.trim().startsWith("<")) {
            throw new Error("Invalid JSON response from backend. Backend may be returning an error page.");
        }
    }

    try {
        return JSON.parse(text);
    } catch (parseError) {
        if (!response.ok) {
            throw new Error(`Backend error ${response.status} ${response.statusText}.`);
        }
        throw new Error("Invalid JSON response from backend. Backend may be unavailable or returning an error page.");
    }
}

async function updateStatus(event) {
    const select = event.target.closest(".status-select");
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE}/api/grievances/${select.dataset.id}/status`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: new URLSearchParams({ status: select.value }),
        });
        const result = await readJsonResponse(response);
        if (!response.ok) {
            throw new Error(result.error || "Unable to update status.");
        }
        await loadGrievances();
    } catch (error) {
        const message = String(error.message || error || "").toLowerCase();
        if (message.includes("unauthorized")) {
            showAdminPanel(false);
            const loginMessage = document.getElementById("adminLoginMessage");
            showMessage(loginMessage, "Please login as admin to update grievance status.", "warning");
            return;
        }

        if (isBackendNetworkError(error)) {
            const updated = updateLocalFallbackStatus(select.dataset.id, select.value);
            if (updated) {
                const adminMessage = document.getElementById("adminMessage");
                showMessage(
                    adminMessage,
                    "Status updated locally because the backend is unavailable.",
                    "warning"
                );
                await loadGrievances();
                return;
            }
        }
        alert(error.message || "Unable to update status.");
    }
}

function formatDate(value) {
    if (!value) return "";
    return new Date(value.replace(" ", "T")).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function statusClass(status) {
    return status.toLowerCase().replace(/\s+/g, "-");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setupContactForm() {
    const contactForm = document.getElementById("contactForm");
    if (!contactForm) return;

    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        showMessage(
            document.getElementById("contactMessageBox"),
            "Message prepared successfully. Please use the welfare office email for official correspondence.",
            "success"
        );
        contactForm.reset();
    });
}

function setupMenu() {
    const menuButton = document.querySelector(".menu-button");
    const navLinks = document.querySelector(".nav-links");
    if (!menuButton || !navLinks) return;

    menuButton.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("show");
        menuButton.setAttribute("aria-expanded", String(isOpen));
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (isLocalFileAccess()) {
        disablePageActions(
            "This page must be opened through the local server. Run run_backend.bat or start_app.bat, then open http://localhost:8000/admin.html."
        );
        return;
    }

    setupMenu();
    setupContactForm();

    const grievanceForm = document.getElementById("grievanceForm");
    if (grievanceForm) {
        grievanceForm.addEventListener("submit", submitGrievance);
    }

    const adminLoginForm = document.getElementById("adminLoginForm");
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", handleAdminLogin);
    }

    const adminLogoutButton = document.getElementById("adminLogout");
    if (adminLogoutButton) {
        adminLogoutButton.addEventListener("click", handleAdminLogout);
    }

    const recordsTable = document.getElementById("recordsTable");
    if (recordsTable) {
        recordsTable.addEventListener("change", updateStatus);
    }

    const refreshButton = document.getElementById("refreshRecords");
    if (refreshButton) {
        refreshButton.addEventListener("click", () => loadGrievances());
    }

    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) {
        statusFilter.addEventListener("change", () => loadGrievances());
    }

    if (document.getElementById("adminPanel") || document.getElementById("adminLoginSection")) {
        showAdminPanel(false);
    }
});
