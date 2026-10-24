document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    function hideLoadingScreen() {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    let appLogicHasRun = false;
    let managerContentStarted = false;
    let db, firestore;

    // ===== FIREBASE BYPASS MODE =====
    // Set to true to skip Firebase and use the app without a database.
    const FIREBASE_BYPASS = false;

    function buildBypassFirebase() {
        const noopPromise = () => Promise.resolve({ docs: [], empty: true, forEach: () => {} });
        return {
            db: {},
            functions: {
                collection: () => ({}),
                query: () => ({}),
                where: () => ({}),
                orderBy: () => ({}),
                getDocs: noopPromise,
                addDoc: () => Promise.resolve({ id: 'bypass-' + Date.now() }),
                updateDoc: () => Promise.resolve(),
                deleteDoc: () => Promise.resolve(),
                doc: () => ({}),
                getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
                setDoc: () => Promise.resolve(),
                serverTimestamp: () => new Date(),
                Timestamp: { now: () => new Date() },
            }
        };
    }

    function setStatus(el, text, kind) {
        if (!el) return;
        el.textContent = text;
        el.classList.remove('ok', 'err');
        if (kind) el.classList.add(kind);
    }

    // ===== TABS =====
    const TAB_KEY = 'pd_managerTab';
    const tabButtons = document.querySelectorAll('.tab-bar button[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel[data-panel]');
    function showTab(name) {
        let found = false;
        tabButtons.forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('active', on); if (on) found = true; });
        if (!found) return showTab('employees');
        tabPanels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
        try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* ignore */ }
    }
    tabButtons.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    try { const saved = localStorage.getItem(TAB_KEY); if (saved) showTab(saved); } catch (e) { /* ignore */ }

    const managerLoginWrapper = document.getElementById('manager-login-wrapper');
    const managerLoginForm = document.getElementById('manager-page-login-form');
    const managerLoginSelect = document.getElementById('manager-login-select');
    const managerPasswordGroup = document.getElementById('manager-password-group');
    const managerPasswordInput = document.getElementById('manager-page-password');
    const managerLoginSubmitBtn = document.getElementById('manager-login-submit-btn');
    const managerLoginError = document.getElementById('manager-page-login-error');
    const managerContent = document.getElementById('manager-content');
    const welcomeName = document.getElementById('manager-welcome-name');

    const BACKDOOR_PASSWORD = "PumpAdmin2025"; // Must match script.js

    // ===== BACKDOOR =====
    const backdoorTrigger = document.getElementById('backdoor-trigger');
    const backdoorModal = document.getElementById('backdoor-modal');
    const backdoorPasswordInput = document.getElementById('backdoor-password-input');
    const backdoorLoginBtn = document.getElementById('backdoor-login-btn');
    const backdoorCancelBtn = document.getElementById('backdoor-cancel-btn');
    const backdoorError = document.getElementById('backdoor-error');

    if (backdoorTrigger) {
        backdoorTrigger.addEventListener('click', () => {
            backdoorModal.classList.add('show');
            backdoorPasswordInput.value = '';
            backdoorError.textContent = '';
            backdoorPasswordInput.focus();
        });
    }
    if (backdoorCancelBtn) backdoorCancelBtn.addEventListener('click', () => backdoorModal.classList.remove('show'));
    if (backdoorLoginBtn) {
        backdoorLoginBtn.addEventListener('click', () => {
            if (backdoorPasswordInput.value === BACKDOOR_PASSWORD) {
                if (typeof grantManagerSession === 'function') grantManagerSession();
                localStorage.setItem('loggedInEmployeeName', 'Admin (Backdoor)');
                backdoorModal.classList.remove('show');
                updateManagerView(true);
                initManagerContent();
            } else {
                backdoorError.textContent = 'Incorrect admin password.';
                backdoorPasswordInput.value = '';
            }
        });
    }
    if (backdoorPasswordInput) {
        backdoorPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') backdoorLoginBtn.click(); });
    }

    function updateManagerView(isLoggedIn) {
        if (isLoggedIn) {
            if (managerLoginWrapper) managerLoginWrapper.style.display = 'none';
            if (managerContent) managerContent.style.display = 'block';
            if (welcomeName) welcomeName.textContent = (localStorage.getItem('loggedInEmployeeName') || 'Manager').split(' ')[0];
            if (typeof addLogoutButton === 'function') addLogoutButton();
        } else {
            if (managerLoginWrapper) managerLoginWrapper.style.display = 'block';
            if (managerContent) managerContent.style.display = 'none';
        }
    }

    async function executeManagerAppLogic(firebaseDetail) {
        if (appLogicHasRun) return;
        appLogicHasRun = true;
        db = firebaseDetail.db;
        firestore = firebaseDetail.functions;

        let allEmployees = [];
        async function loadAllEmployees() {
            try {
                const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
                const snap = await firestore.getDocs(q);
                allEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error("Error loading employees:", e); allEmployees = []; }
        }

        await loadAllEmployees();

        if (managerLoginSelect) {
            managerLoginSelect.innerHTML = '<option value="">— Select Your Name —</option>';
            allEmployees.filter(e => e.isManager).forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.fullName;
                managerLoginSelect.appendChild(opt);
            });

            managerLoginSelect.addEventListener('change', () => {
                if (managerLoginSelect.value) {
                    managerPasswordGroup.style.display = 'flex';
                    managerLoginSubmitBtn.style.display = 'flex';
                    managerPasswordInput.value = '';
                    managerPasswordInput.focus();
                    managerLoginError.style.display = 'none';
                } else {
                    managerPasswordGroup.style.display = 'none';
                    managerLoginSubmitBtn.style.display = 'none';
                }
            });
        }

        managerLoginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedId = managerLoginSelect.value;
            const enteredPw = managerPasswordInput.value;
            if (!selectedId) return;
            const emp = allEmployees.find(em => em.id === selectedId);
            if (emp && emp.isManager && emp.loginPassword && emp.loginPassword === enteredPw) {
                if (typeof grantManagerSession === 'function') grantManagerSession();
                localStorage.setItem('loggedInEmployeeName', emp.fullName);
                localStorage.setItem('loggedInEmployeeId', emp.id);
                updateManagerView(true);
                initManagerContent();
            } else {
                managerLoginError.style.display = 'block';
                managerPasswordInput.value = '';
            }
        });

        if (typeof checkManagerSession === 'function' && checkManagerSession()) {
            updateManagerView(true);
            initManagerContent();
        }

        hideLoadingScreen();
    }

    function initManagerContent() {
        if (managerContentStarted) return;
        managerContentStarted = true;

        // ===== EMPLOYEE MANAGEMENT =====
        const empFormTitle = document.getElementById('employee-form-title');
        const editEmpIdInput = document.getElementById('edit-employee-id');
        const empFullNameInput = document.getElementById('employee-full-name');
        const empPlayerIdInput = document.getElementById('employee-player-id');
        const empRankSelect = document.getElementById('employee-rank-select');
        const empIsManagerCheckbox = document.getElementById('employee-is-manager');
        const empPasswordInput = document.getElementById('new-employee-password');
        const saveEmpBtn = document.getElementById('save-employee-button');
        const cancelEmpBtn = document.getElementById('cancel-edit-button');
        const empStatusMsg = document.getElementById('employee-status-message');
        const empListDisplay = document.getElementById('employee-list-display');
        const empCountLabel = document.getElementById('employee-count-label');

        let editingEmpId = null;

        async function loadAndRenderEmployees() {
            if (!empListDisplay) return;
            empListDisplay.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
                const snap = await firestore.getDocs(q);
                if (empCountLabel) {
                    const total = snap.docs.length;
                    const mgrs = snap.docs.filter(d => d.data().isManager).length;
                    empCountLabel.textContent = `${total} employee${total === 1 ? '' : 's'} · ${mgrs} with manager access`;
                }
                if (snap.empty) { empListDisplay.innerHTML = '<p class="loading-message">No employees yet. Add one with the form.</p>'; return; }
                empListDisplay.innerHTML = '';
                snap.forEach(docSnap => {
                    const emp = { id: docSnap.id, ...docSnap.data() };
                    const rank = emp.rank || 'Employee';
                    const div = document.createElement('div');
                    div.className = 'employee-list-item';
                    div.innerHTML = `
                        <div class="emp-left">
                            <span class="avatar">${esc(initials(emp.fullName))}</span>
                            <div>
                                <div class="emp-name">${esc(emp.fullName)}
                                    ${rank === 'Owner' ? '<span class="emp-badge is-owner">Owner</span>' : ''}
                                    ${emp.isManager ? '<span class="emp-badge is-manager">Manager access</span>' : ''}
                                </div>
                                <div class="emp-meta">${esc(rank)} · Player ID: ${esc(emp.playerId || emp.playerID || '—')}</div>
                            </div>
                        </div>
                        <div class="emp-actions">
                            <button class="action-button btn-sm edit-btn">✏️ Edit</button>
                            <button class="action-button btn-sm delete-btn">🗑️</button>
                        </div>
                    `;
                    div.querySelector('.edit-btn').addEventListener('click', () => startEditEmployee(emp));
                    div.querySelector('.delete-btn').addEventListener('click', () => deleteEmployee(emp.id, emp.fullName));
                    empListDisplay.appendChild(div);
                });
            } catch (err) {
                console.error("Error loading employees:", err);
                empListDisplay.innerHTML = '<p class="text-err">Error loading employees.</p>';
            }
        }

        function startEditEmployee(emp) {
            editingEmpId = emp.id;
            empFormTitle.textContent = `Edit: ${emp.fullName}`;
            editEmpIdInput.value = emp.id;
            empFullNameInput.value = emp.fullName || '';
            empPlayerIdInput.value = emp.playerId || emp.playerID || '';
            empRankSelect.value = emp.rank || 'Employee';
            empIsManagerCheckbox.checked = emp.isManager || false;
            empPasswordInput.value = '';
            empPasswordInput.placeholder = 'Leave blank to keep current password';
            cancelEmpBtn.style.display = 'inline-flex';
            setStatus(empStatusMsg, '');
            empFullNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function resetForm() {
            editingEmpId = null;
            empFormTitle.textContent = 'Add New Employee';
            editEmpIdInput.value = '';
            empFullNameInput.value = '';
            empPlayerIdInput.value = '';
            empRankSelect.value = 'Employee';
            empIsManagerCheckbox.checked = false;
            empPasswordInput.value = '';
            empPasswordInput.placeholder = 'Set employee\'s login password';
            cancelEmpBtn.style.display = 'none';
        }

        cancelEmpBtn?.addEventListener('click', () => { resetForm(); setStatus(empStatusMsg, ''); });

        saveEmpBtn?.addEventListener('click', async () => {
            const fullName = empFullNameInput.value.trim();
            const playerId = empPlayerIdInput.value.trim();
            const rank = empRankSelect.value;
            const isManager = empIsManagerCheckbox.checked;
            const password = empPasswordInput.value.trim();

            if (!fullName) { setStatus(empStatusMsg, 'Full name is required.', 'err'); return; }
            if (!editingEmpId && !password) { setStatus(empStatusMsg, 'Password is required for new employees.', 'err'); return; }

            saveEmpBtn.disabled = true;
            setStatus(empStatusMsg, 'Saving...');

            try {
                const data = { fullName, playerId, rank, isManager, updatedAt: firestore.serverTimestamp() };
                if (password) data.loginPassword = password;

                let msg;
                if (editingEmpId) {
                    await firestore.updateDoc(firestore.doc(db, "pd_employees", editingEmpId), data);
                    msg = `✅ ${fullName} updated!`;
                } else {
                    data.createdAt = firestore.serverTimestamp();
                    await firestore.addDoc(firestore.collection(db, "pd_employees"), data);
                    msg = `✅ ${fullName} added!`;
                }
                resetForm();
                setStatus(empStatusMsg, msg, 'ok');
                await loadAndRenderEmployees();
            } catch (err) {
                console.error("Error saving employee:", err);
                setStatus(empStatusMsg, 'Error saving. Please try again.', 'err');
            } finally {
                saveEmpBtn.disabled = false;
            }
        });

        async function deleteEmployee(id, name) {
            if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
            try {
                await firestore.deleteDoc(firestore.doc(db, "pd_employees", id));
                await loadAndRenderEmployees();
            } catch (err) { console.error("Error deleting:", err); alert("Error deleting employee."); }
        }

        // ===== COMMISSION SUMMARY (manager can mark as paid) =====
        const commissionSummaryList = document.getElementById('commission-summary-list');
        const commissionRefreshBtn = document.getElementById('commission-summary-refresh-btn');
        const commissionLastUpdated = document.getElementById('commission-summary-last-updated');
        const statOutstanding = document.getElementById('stat-outstanding');
        const statOutstandingHint = document.getElementById('stat-outstanding-hint');

        async function loadCommissionSummary() {
            if (!commissionSummaryList) return;
            commissionSummaryList.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                const empSnap = await firestore.getDocs(firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName")));
                const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const txQuery = firestore.query(
                    firestore.collection(db, "pd_transactions"),
                    firestore.where("commissionCleared", "==", false)
                );
                const txSnap = await firestore.getDocs(txQuery);

                const commByEmp = {};
                txSnap.forEach(d => {
                    const tx = d.data();
                    if (!commByEmp[tx.employeeName]) commByEmp[tx.employeeName] = { total: 0, txIds: [], employeeName: tx.employeeName };
                    commByEmp[tx.employeeName].total += tx.totalEmpCommission || 0;
                    commByEmp[tx.employeeName].txIds.push(d.id);
                });

                const grandTotal = Object.values(commByEmp).reduce((s, x) => s + x.total, 0);
                const owedCount = Object.values(commByEmp).filter(x => x.total > 0).length;
                if (statOutstanding) statOutstanding.textContent = money(grandTotal);
                if (statOutstandingHint) statOutstandingHint.textContent = owedCount ? `${owedCount} employee${owedCount === 1 ? '' : 's'} waiting` : 'everyone is paid up';
                if (commissionLastUpdated) commissionLastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                if (Object.keys(commByEmp).length === 0) {
                    commissionSummaryList.innerHTML = '<div class="all-paid">✅ All commissions are paid up!</div>';
                    return;
                }

                commissionSummaryList.innerHTML = '';
                const sorted = Object.entries(commByEmp).sort((a, b) => b[1].total - a[1].total);
                for (const [empName, data] of sorted) {
                    const empData = employees.find(e => e.fullName === empName);
                    const row = document.createElement('div');
                    row.className = 'commission-summary-row';
                    row.innerHTML = `
                        <div class="commission-summary-name">
                            <span class="avatar">${esc(initials(empName))}</span>
                            <div>
                                <div style="font-weight:700;">${esc(empName)}</div>
                                <div class="emp-meta">${esc(empData?.rank || 'Employee')} · ${data.txIds.length} transaction${data.txIds.length === 1 ? '' : 's'} · Player ID: ${esc(empData?.playerId || '—')}</div>
                            </div>
                        </div>
                        <div class="commission-summary-amount">
                            <span class="commission-amount-value">${money(data.total)}</span>
                            <button class="action-button checkout-button btn-sm mark-paid-btn">✅ Mark Paid</button>
                        </div>
                    `;
                    const btn = row.querySelector('.mark-paid-btn');
                    btn.addEventListener('click', async () => {
                        const txIds = data.txIds;
                        const total = data.total;
                        if (!confirm(`Mark ${money(total)} commission as paid for ${empName}?`)) return;
                        btn.disabled = true;
                        btn.textContent = 'Processing...';
                        try {
                            const updates = txIds.map(id => firestore.updateDoc(firestore.doc(db, "pd_transactions", id), { commissionCleared: true }));
                            await Promise.all(updates);
                            await firestore.addDoc(firestore.collection(db, "pd_commission_logs"), {
                                employeeName: empName,
                                totalPaid: total,
                                transactionIds: txIds,
                                paidBy: localStorage.getItem('loggedInEmployeeName') || 'Manager',
                                paidAt: firestore.serverTimestamp()
                            });
                            await loadCommissionSummary();
                            await renderCommissionLogs();
                            await loadTransactions();
                        } catch (err) {
                            console.error("Error marking paid:", err);
                            alert("Error marking as paid.");
                            btn.disabled = false;
                            btn.textContent = '✅ Mark Paid';
                        }
                    });
                    commissionSummaryList.appendChild(row);
                }
            } catch (err) {
                console.error("Error loading commission summary:", err);
                commissionSummaryList.innerHTML = '<p class="text-err">Error loading data. Check console (F12) — a Firestore index may be required.</p>';
            }
        }

        commissionRefreshBtn?.addEventListener('click', loadCommissionSummary);

        // ===== SHIFT NOTE =====
        const noteInput = document.getElementById('shift-note-input');
        const notePreviewWrap = document.getElementById('shift-note-preview-wrap');
        const notePreview = document.getElementById('shift-note-live-preview');
        const noteCurrent = document.getElementById('current-shift-note-display');
        const noteStatus = document.getElementById('shift-note-status');
        const postNoteBtn = document.getElementById('post-shift-note-btn');
        const clearNoteBtn = document.getElementById('clear-shift-note-btn');
        const noteRef = () => firestore.doc(db, SHIFT_NOTE_COLLECTION, SHIFT_NOTE_DOC);

        function updateNotePreview() {
            if (!noteInput) return;
            if (noteInput.value.trim()) {
                notePreviewWrap.style.display = 'block';
                notePreview.innerHTML = sanitizeNoteHtml(noteInput.value);
            } else {
                notePreviewWrap.style.display = 'none';
            }
        }

        function wrapSelection(openTag, closeTag) {
            const start = noteInput.selectionStart;
            const end = noteInput.selectionEnd;
            const selected = noteInput.value.substring(start, end);
            noteInput.setRangeText(openTag + (selected || 'text') + closeTag, start, end, 'end');
            noteInput.focus();
            updateNotePreview();
        }

        noteInput?.addEventListener('input', updateNotePreview);

        document.querySelectorAll('.note-fmt-btn[data-tag]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;
                wrapSelection(`<${tag}>`, `</${tag}>`);
            });
        });

        const sizeInput = document.getElementById('note-font-size');
        document.getElementById('note-apply-size')?.addEventListener('click', () => {
            let size = parseInt(sizeInput.value);
            if (isNaN(size)) size = 16;
            size = Math.min(SHIFT_NOTE_MAX_SIZE, Math.max(SHIFT_NOTE_MIN_SIZE, size));
            sizeInput.value = size;
            wrapSelection(`<span style="font-size:${size}px;">`, `</span>`);
        });

        const colorPicker = document.getElementById('note-color-picker');
        document.getElementById('note-apply-color')?.addEventListener('click', () => {
            wrapSelection(`<span style="color:${colorPicker.value};">`, `</span>`);
        });

        async function loadCurrentShiftNote() {
            if (!noteCurrent) return;
            try {
                const snap = await firestore.getDoc(noteRef());
                const d = snap.exists() ? snap.data() : null;
                if (d && (d.text || '').trim()) {
                    const ts = formatTimestamp(d.postedAt);
                    noteCurrent.classList.remove('empty');
                    noteCurrent.innerHTML = `
                        <div class="shift-note-render">${sanitizeNoteHtml(d.text)}</div>
                        <span class="note-current-meta">Posted by <strong>${esc(d.postedBy || 'Unknown')}</strong>${ts ? ' · ' + esc(ts) : ''}</span>`;
                } else {
                    noteCurrent.classList.add('empty');
                    noteCurrent.textContent = 'No active shift note.';
                }
            } catch (e) {
                console.error('Error loading shift note:', e);
                noteCurrent.classList.add('empty');
                noteCurrent.innerHTML = '<span class="text-err">Error loading note. Check the Firestore rules allow the pd_settings collection.</span>';
            }
        }

        postNoteBtn?.addEventListener('click', async () => {
            const text = noteInput ? noteInput.value.trim() : '';
            if (!text) { setStatus(noteStatus, 'Please enter a note.', 'err'); return; }
            const postedBy = localStorage.getItem('loggedInEmployeeName') || 'Manager';
            postNoteBtn.disabled = true;
            try {
                await firestore.setDoc(noteRef(), { text, postedBy, postedAt: firestore.serverTimestamp() });
                noteInput.value = '';
                updateNotePreview();
                setStatus(noteStatus, '✓ Note posted!', 'ok');
                setTimeout(() => setStatus(noteStatus, ''), 3000);
                await loadCurrentShiftNote();
            } catch (e) {
                console.error('Error posting shift note:', e);
                setStatus(noteStatus, 'Error posting note.', 'err');
            } finally {
                postNoteBtn.disabled = false;
            }
        });

        clearNoteBtn?.addEventListener('click', async () => {
            if (!confirm('Clear the current shift note? Employees will no longer see it.')) return;
            try {
                await firestore.setDoc(noteRef(), { text: '', postedBy: '', postedAt: firestore.serverTimestamp() });
                setStatus(noteStatus, '✓ Note cleared.', 'ok');
                setTimeout(() => setStatus(noteStatus, ''), 3000);
                await loadCurrentShiftNote();
            } catch (e) {
                console.error('Error clearing shift note:', e);
                setStatus(noteStatus, 'Error clearing note.', 'err');
            }
        });

        // ===== TRANSACTION LOG =====
        const transactionsDisplay = document.getElementById('transactions-display');
        const exportTransactionsBtn = document.getElementById('export-transactions-btn');
        const statRevenue = document.getElementById('stat-revenue');
        const statRevenueHint = document.getElementById('stat-revenue-hint');
        const statBizCut = document.getElementById('stat-bizcut');

        async function loadTransactions() {
            if (!transactionsDisplay) return;
            transactionsDisplay.innerHTML = '<p class="loading-message" style="padding:14px;">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_transactions"), firestore.orderBy("createdAt", "desc"));
                const snap = await firestore.getDocs(q);

                let revenue = 0, bizCut = 0, saleCount = 0;
                snap.forEach(d => {
                    const tx = d.data();
                    if (tx.type === 'sale') { revenue += tx.totalRevenue || 0; bizCut += tx.totalBizCut || 0; saleCount++; }
                });
                if (statRevenue) statRevenue.textContent = money(revenue);
                if (statRevenueHint) statRevenueHint.textContent = `${saleCount} sale${saleCount === 1 ? '' : 's'} all time`;
                if (statBizCut) statBizCut.textContent = money(bizCut);

                if (snap.empty) { transactionsDisplay.innerHTML = '<p class="loading-message" style="padding:14px;">No transactions yet.</p>'; return; }

                const table = document.createElement('table');
                table.innerHTML = `<thead><tr>
                    <th>Date</th><th>Employee</th><th>Type</th><th>Items</th>
                    <th>Revenue</th><th>Commission</th><th>Status</th>
                </tr></thead>`;
                const tbody = document.createElement('tbody');
                snap.forEach(d => {
                    const tx = d.data();
                    const date = tx.createdAt?.toDate?.()?.toLocaleString() || '—';
                    const items = (tx.items || []).map(i => `${i.productName || i.itemName} ×${i.qty}`).join(', ');
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="td-num muted">${esc(date)}</td>
                        <td>${esc(tx.employeeName || '—')}</td>
                        <td>${tx.type === 'sale' ? '<span class="pill pill-sale">🛒 Sale</span>' : '<span class="pill pill-buy">🗑️ Purchase</span>'}</td>
                        <td class="td-items">${esc(items || '—')}</td>
                        <td class="td-num">${tx.type === 'sale' ? money(tx.totalRevenue) : `<span class="muted">Paid out ${money(tx.totalPayout)}</span>`}</td>
                        <td class="td-num text-warn">${money(tx.totalEmpCommission)}</td>
                        <td>${tx.commissionCleared ? '<span class="pill pill-ok">Paid</span>' : '<span class="pill pill-warn">Owed</span>'}</td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                transactionsDisplay.innerHTML = '';
                transactionsDisplay.appendChild(table);
            } catch (err) {
                console.error("Error loading transactions:", err);
                transactionsDisplay.innerHTML = '<p class="text-err" style="padding:14px;">Error loading transactions.</p>';
            }
        }

        function downloadCsv(rows, filename) {
            const csv = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }
        const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

        exportTransactionsBtn?.addEventListener('click', async () => {
            try {
                const q = firestore.query(firestore.collection(db, "pd_transactions"), firestore.orderBy("createdAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { alert("No transactions to export."); return; }
                const rows = [["Date", "Employee", "Type", "Items", "Total Revenue", "Customer Payout", "Emp Commission", "Business Cut", "Commission Paid"]];
                snap.forEach(d => {
                    const tx = d.data();
                    const date = tx.createdAt?.toDate?.()?.toLocaleString() || '';
                    const items = (tx.items || []).map(i => `${i.productName || i.itemName}(x${i.qty})`).join('; ');
                    rows.push([csvCell(date), csvCell(tx.employeeName), tx.type, csvCell(items), tx.totalRevenue || 0, tx.totalPayout || 0, tx.totalEmpCommission || 0, tx.totalBizCut || 0, tx.commissionCleared ? 'Yes' : 'No']);
                });
                downloadCsv(rows, 'pump_dump_transactions.csv');
            } catch (err) { alert("Export error."); }
        });

        // ===== COMMISSION PAYMENT LOGS =====
        const commissionLogsDisplay = document.getElementById('commission-payment-logs-display');
        const exportCommissionLogBtn = document.getElementById('export-commission-log-btn');

        async function renderCommissionLogs() {
            if (!commissionLogsDisplay) return;
            commissionLogsDisplay.innerHTML = '<p class="loading-message" style="padding:14px;">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_commission_logs"), firestore.orderBy("paidAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { commissionLogsDisplay.innerHTML = '<p class="loading-message" style="padding:14px;">No payment logs yet.</p>'; return; }
                const table = document.createElement('table');
                table.innerHTML = `<thead><tr><th>Date Paid</th><th>Employee</th><th>Amount</th><th>Paid By</th><th>Transactions</th></tr></thead>`;
                const tbody = document.createElement('tbody');
                snap.forEach(d => {
                    const log = d.data();
                    const date = log.paidAt?.toDate?.()?.toLocaleString() || '—';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="td-num muted">${esc(date)}</td>
                        <td>${esc(log.employeeName || '—')}</td>
                        <td class="td-num text-ok" style="font-weight:700;">${money(log.totalPaid)}</td>
                        <td>${esc(log.paidBy || '—')}</td>
                        <td class="td-num">${(log.transactionIds || []).length}</td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                commissionLogsDisplay.innerHTML = '';
                commissionLogsDisplay.appendChild(table);
            } catch (err) {
                commissionLogsDisplay.innerHTML = '<p class="text-err" style="padding:14px;">Error loading logs.</p>';
            }
        }

        exportCommissionLogBtn?.addEventListener('click', async () => {
            try {
                const q = firestore.query(firestore.collection(db, "pd_commission_logs"), firestore.orderBy("paidAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { alert("No logs to export."); return; }
                const rows = [["Date Paid", "Employee", "Amount Paid", "Paid By", "Transaction Count"]];
                snap.forEach(d => {
                    const log = d.data();
                    rows.push([csvCell(log.paidAt?.toDate?.()?.toLocaleString()), csvCell(log.employeeName), log.totalPaid || 0, csvCell(log.paidBy), (log.transactionIds || []).length]);
                });
                downloadCsv(rows, 'pump_dump_commission_log.csv');
            } catch (err) { alert("Export error."); }
        });

        // ===== COMPOST INVENTORY =====
        const compostDisplay = document.getElementById('compost-stock-display');
        const compostInput = document.getElementById('compost-stock-input');
        const compostSaveBtn = document.getElementById('compost-stock-save-btn');
        const compostStatus = document.getElementById('compost-stock-status');
        const statCompost = document.getElementById('stat-compost');

        function showCompost(n) {
            if (compostDisplay) { compostDisplay.textContent = n; compostDisplay.className = n > 0 ? 'text-ok' : 'text-err'; }
            if (statCompost) { statCompost.textContent = n; statCompost.className = 'stat-value ' + (n > 0 ? '' : 'text-err'); }
        }

        async function loadCompostInventory() {
            try {
                const snap = await firestore.getDoc(firestore.doc(db, "pd_inventory", "bag_of_compost"));
                const current = snap.exists() ? (snap.data().stock ?? 0) : 0;
                showCompost(current);
                if (compostInput) compostInput.value = current;
            } catch (e) {
                console.warn("Could not load compost stock:", e);
                if (compostDisplay) compostDisplay.textContent = '—';
            }
        }

        compostSaveBtn?.addEventListener('click', async () => {
            const newStock = parseInt(compostInput?.value);
            if (isNaN(newStock) || newStock < 0) { setStatus(compostStatus, 'Enter a valid number.', 'err'); return; }
            compostSaveBtn.disabled = true;
            setStatus(compostStatus, 'Saving...');
            try {
                await firestore.setDoc(firestore.doc(db, "pd_inventory", "bag_of_compost"), { stock: newStock, updatedAt: firestore.serverTimestamp() });
                showCompost(newStock);
                setStatus(compostStatus, `✅ Stock updated to ${newStock}.`, 'ok');
            } catch (err) {
                console.error("Error saving stock:", err);
                setStatus(compostStatus, 'Error saving. Try again.', 'err');
            } finally {
                compostSaveBtn.disabled = false;
            }
        });

        // Auto-load everything
        loadAndRenderEmployees();
        loadCommissionSummary();
        loadCurrentShiftNote();
        loadTransactions();
        renderCommissionLogs();
        loadCompostInventory();
    }

    let processed = false;

    if (FIREBASE_BYPASS) {
        executeManagerAppLogic(buildBypassFirebase());
    } else if (window.isFirebaseReady && window.db && window.firestoreFunctions) {
        // Firebase usually finishes before this script runs — start right away instead of waiting on the timeout
        processed = true;
        executeManagerAppLogic({ db: window.db, functions: window.firestoreFunctions });
    } else {
        document.addEventListener('firebaseReady', (e) => {
            if (!processed) { processed = true; executeManagerAppLogic(e.detail); }
        });
        document.addEventListener('firebaseError', () => {
            if (!processed) { processed = true; hideLoadingScreen(); alert("Firebase failed to initialize."); }
        });
        setTimeout(() => {
            if (!processed) {
                processed = true;
                if (window.isFirebaseReady && window.db) executeManagerAppLogic({ db: window.db, functions: window.firestoreFunctions });
                else hideLoadingScreen();
            }
        }, 3500);
    }
});
