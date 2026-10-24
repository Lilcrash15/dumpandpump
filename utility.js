// utility.js - Pump & Dump Portal (shared helpers for every page)

const EMPLOYEE_SESSION_KEY = 'isEmployeeAccessGranted_PumpDump';
const MANAGER_SESSION_KEY = 'isManagerAccessGranted_PumpDump';

// Shift note lives in one Firestore doc: pd_settings / shiftNote
const SHIFT_NOTE_COLLECTION = 'pd_settings';
const SHIFT_NOTE_DOC = 'shiftNote';
const SHIFT_NOTE_MIN_SIZE = 12;
const SHIFT_NOTE_MAX_SIZE = 36;

// ===== SESSIONS =====
function checkEmployeeSession() {
    return localStorage.getItem(EMPLOYEE_SESSION_KEY) === 'true';
}

function grantEmployeeSession() {
    localStorage.setItem(EMPLOYEE_SESSION_KEY, 'true');
}

function checkManagerSession() {
    return localStorage.getItem(MANAGER_SESSION_KEY) === 'true' && checkEmployeeSession();
}

function grantManagerSession() {
    localStorage.setItem(EMPLOYEE_SESSION_KEY, 'true');
    localStorage.setItem(MANAGER_SESSION_KEY, 'true');
}

function clearAllSessions() {
    localStorage.removeItem(EMPLOYEE_SESSION_KEY);
    localStorage.removeItem(MANAGER_SESSION_KEY);
    localStorage.removeItem('loggedInEmployeeName');
    localStorage.removeItem('loggedInEmployeeId');

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink && logoutLink.parentNode) logoutLink.parentNode.removeChild(logoutLink);

    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const loginPages = ["index.html", "commission.html", "manager.html"];
    if (loginPages.includes(currentPage)) {
        window.location.reload();
    } else {
        window.location.href = 'index.html';
    }
}

function addLogoutButton() {
    const navLinks = document.querySelector('.navbar .nav-links');
    if (navLinks && !document.getElementById('logout-link')) {
        const logoutLink = document.createElement('a');
        logoutLink.href = "#";
        logoutLink.id = 'logout-link';
        logoutLink.textContent = 'Log out';
        logoutLink.addEventListener('click', (e) => { e.preventDefault(); clearAllSessions(); });
        navLinks.appendChild(logoutLink);
    }
}

// ===== SMALL HELPERS =====
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

function money(n) {
    return '$' + (Number(n) || 0).toLocaleString();
}

function formatTimestamp(ts) {
    const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : (ts instanceof Date ? ts : null));
    if (!d) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timestampKey(ts) {
    const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds * 1000) : (ts instanceof Date ? ts : null));
    return d ? String(d.getTime()) : '';
}

// ===== SHIFT NOTE RENDERING =====
// Managers write notes with simple tags (<strong>, <em>, <u>, <span style="color/font-size">).
// Everything else is stripped before it's shown, so a bad paste can't break the page.
function sanitizeNoteHtml(raw) {
    const html = String(raw || '').replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
    const template = document.createElement('template');
    template.innerHTML = html;

    const ALLOWED = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'BR']);

    function clean(node) {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) return;
            if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); return; }

            if (!ALLOWED.has(child.tagName)) {
                clean(child);
                child.replaceWith(...Array.from(child.childNodes));
                return;
            }

            const color = child.style?.color || '';
            const sizeMatch = (child.style?.fontSize || '').match(/^(\d+(?:\.\d+)?)px$/);
            Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));

            if (child.tagName === 'SPAN') {
                if (color) child.style.color = color;
                if (sizeMatch) {
                    const size = Math.min(SHIFT_NOTE_MAX_SIZE, Math.max(SHIFT_NOTE_MIN_SIZE, parseFloat(sizeMatch[1])));
                    child.style.fontSize = size + 'px';
                }
            }
            clean(child);
        });
    }

    clean(template.content);
    return template.innerHTML;
}

// ===== NAV (active link + mobile menu) =====
document.addEventListener("DOMContentLoaded", () => {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll('.navbar .nav-links a[href]').forEach(a => {
        if (a.getAttribute('href') === currentPage) a.classList.add('active');
    });

    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.navbar .nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            const open = links.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', (e) => {
            if (!links.classList.contains('open')) return;
            if (!links.contains(e.target) && !toggle.contains(e.target)) links.classList.remove('open');
        });
    }
});
