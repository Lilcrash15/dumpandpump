document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    function hideLoadingScreen() {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    let appLogicHasRun = false;
    let db, firestore;

    // ===== FIREBASE BYPASS MODE =====
    // Set to true to skip Firebase and use the app without a database.
    // Flip back to false once Firebase credentials are added.
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

    const managerLoginWrapper = document.getElementById('manager-login-wrapper');
    const managerLoginForm = document.getElementById('manager-page-login-form');
    const managerLoginSelect = document.getElementById('manager-login-select');
    const managerPasswordGroup = document.getElementById('manager-password-group');
    const managerPasswordInput = document.getElementById('manager-page-password');
    const managerLoginSubmitBtn = document.getElementById('manager-login-submit-btn');
    const managerLoginError = document.getElementById('manager-page-login-error');
    const managerContent = document.getElementById('manager-content');

    const BACKDOOR_PASSWORD = "PumpAdmin2025"; // Must match script.js

    // Backdoor
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

        // Load employees for login
        let allEmployees = [];
        async function loadAllEmployees() {
            try {
                const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
                const snap = await firestore.getDocs(q);
                allEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.error("Error loading employees:", e); allEmployees = []; }
        }

        await loadAllEmployees();

        // Populate manager login select
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
                    managerPasswordGroup.style.display = 'block';
                    managerLoginSubmitBtn.style.display = 'block';
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

        // Check existing session
        if (typeof checkManagerSession === 'function' && checkManagerSession()) {
            updateManagerView(true);
            initManagerContent();
        }

        hideLoadingScreen();
    }

    function initManagerContent() {
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

        let editingEmpId = null;

        async function loadAndRenderEmployees() {
            if (!empListDisplay) return;
            empListDisplay.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { empListDisplay.innerHTML = '<p class="loading-message">No employees yet. Add one above.</p>'; return; }
                empListDisplay.innerHTML = '';
                snap.forEach(docSnap => {
                    const emp = { id: docSnap.id, ...docSnap.data() };
                    const div = document.createElement('div');
                    div.className = 'employee-list-item';
                    div.innerHTML = `
                        <div>
                            <div class="emp-name">${emp.fullName} ${emp.isManager ? '<span class="emp-badge is-manager">🔑 Manager</span>' : '<span class="emp-badge">👷 Employee</span>'}</div>
                            <div class="emp-meta">
                                Rank: ${emp.rank || 'Employee'} &nbsp;|&nbsp; Player ID: ${emp.playerId || emp.playerID || '—'}
                            </div>
                        </div>
                        <div class="emp-actions">
                            <button class="action-button edit-btn" data-id="${emp.id}">✏️ Edit</button>
                            <button class="action-button delete-btn" data-id="${emp.id}">🗑️ Delete</button>
                        </div>
                    `;
                    div.querySelector('.edit-btn').addEventListener('click', () => startEditEmployee(emp));
                    div.querySelector('.delete-btn').addEventListener('click', () => deleteEmployee(emp.id, emp.fullName));
                    empListDisplay.appendChild(div);
                });
            } catch (err) {
                console.error("Error loading employees:", err);
                empListDisplay.innerHTML = '<p style="color:#fc8181;">Error loading employees.</p>';
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
            empPasswordInput.value = ''; // Don't show existing password
            empPasswordInput.placeholder = 'Leave blank to keep current password';
            cancelEmpBtn.style.display = 'inline-block';
            empStatusMsg.textContent = '';
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
            empStatusMsg.textContent = '';
        }

        cancelEmpBtn?.addEventListener('click', resetForm);

        saveEmpBtn?.addEventListener('click', async () => {
            const fullName = empFullNameInput.value.trim();
            const playerId = empPlayerIdInput.value.trim();
            const rank = empRankSelect.value;
            const isManager = empIsManagerCheckbox.checked;
            const password = empPasswordInput.value.trim();

            if (!fullName) { empStatusMsg.textContent = 'Full name is required.'; empStatusMsg.style.color = '#fc8181'; return; }
            if (!editingEmpId && !password) { empStatusMsg.textContent = 'Password is required for new employees.'; empStatusMsg.style.color = '#fc8181'; return; }

            saveEmpBtn.disabled = true;
            empStatusMsg.textContent = 'Saving...';

            try {
                const data = { fullName, playerId, rank, isManager, updatedAt: firestore.serverTimestamp() };
                if (password) data.loginPassword = password;

                if (editingEmpId) {
                    await firestore.updateDoc(firestore.doc(db, "pd_employees", editingEmpId), data);
                    empStatusMsg.textContent = `✅ ${fullName} updated!`;
                } else {
                    data.createdAt = firestore.serverTimestamp();
                    await firestore.addDoc(firestore.collection(db, "pd_employees"), data);
                    empStatusMsg.textContent = `✅ ${fullName} added!`;
                }
                empStatusMsg.style.color = '#48bb78';
                resetForm();
                await loadAndRenderEmployees();
            } catch (err) {
                console.error("Error saving employee:", err);
                empStatusMsg.textContent = 'Error saving. Please try again.';
                empStatusMsg.style.color = '#fc8181';
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

        async function loadCommissionSummary() {
            if (!commissionSummaryList) return;
            commissionSummaryList.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                // Get all employees
                const empSnap = await firestore.getDocs(firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName")));
                const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Get all uncleared sale transactions
                const txQuery = firestore.query(
                    firestore.collection(db, "pd_transactions"),
                    firestore.where("commissionCleared", "==", false)
                );
                const txSnap = await firestore.getDocs(txQuery);

                // Aggregate per employee
                const commByEmp = {};
                txSnap.forEach(d => {
                    const tx = d.data();
                    if (!commByEmp[tx.employeeName]) commByEmp[tx.employeeName] = { total: 0, txIds: [], employeeName: tx.employeeName };
                    commByEmp[tx.employeeName].total += tx.totalEmpCommission || 0;
                    commByEmp[tx.employeeName].txIds.push(d.id);
                });

                if (Object.keys(commByEmp).length === 0) {
                    commissionSummaryList.innerHTML = '<p style="color:#48bb78;">✅ All commissions are paid up!</p>';
                    if (commissionLastUpdated) commissionLastUpdated.textContent = 'Updated: ' + new Date().toLocaleTimeString();
                    return;
                }

                commissionSummaryList.innerHTML = '';
                for (const [empName, data] of Object.entries(commByEmp)) {
                    const empData = employees.find(e => e.fullName === empName);
                    const row = document.createElement('div');
                    row.className = 'commission-summary-row';
                    row.innerHTML = `
                        <div class="commission-summary-name">
                            <div class="commission-summary-dot"></div>
                            <div>
                                <div style="font-weight:700; color:#f0e8d0;">${empName}</div>
                                <div style="font-size:0.78rem; color:#8a7040;">${empData?.rank || 'Employee'} · ${data.txIds.length} sale(s) · Player ID: ${empData?.playerId || '—'}</div>
                            </div>
                        </div>
                        <div class="commission-summary-amount">
                            <span>$${data.total.toLocaleString()}</span>
                            <span class="commission-summary-count">${data.txIds.length} transactions</span>
                            <button class="action-button checkout-button mark-paid-btn" data-name="${empName}" data-ids='${JSON.stringify(data.txIds)}' data-total="${data.total}" style="padding:6px 14px; font-size:0.82rem; margin-top:6px;">
                                ✅ Mark Paid
                            </button>
                        </div>
                    `;
                    row.querySelector('.mark-paid-btn').addEventListener('click', async function() {
                        const empN = this.dataset.name;
                        const txIds = JSON.parse(this.dataset.ids);
                        const total = parseFloat(this.dataset.total);
                        if (!confirm(`Mark $${total.toLocaleString()} commission as paid for ${empN}?`)) return;
                        this.disabled = true;
                        this.textContent = 'Processing...';
                        try {
                            const updates = txIds.map(id => firestore.updateDoc(firestore.doc(db, "pd_transactions", id), { commissionCleared: true }));
                            await Promise.all(updates);
                            // Log the payment
                            await firestore.addDoc(firestore.collection(db, "pd_commission_logs"), {
                                employeeName: empN,
                                totalPaid: total,
                                transactionIds: txIds,
                                paidBy: localStorage.getItem('loggedInEmployeeName') || 'Manager',
                                paidAt: firestore.serverTimestamp()
                            });
                            await loadCommissionSummary();
                            await renderCommissionLogs();
                        } catch (err) {
                            console.error("Error marking paid:", err);
                            alert("Error marking as paid.");
                            this.disabled = false;
                            this.textContent = '✅ Mark Paid';
                        }
                    });
                    commissionSummaryList.appendChild(row);
                }
                if (commissionLastUpdated) commissionLastUpdated.textContent = 'Updated: ' + new Date().toLocaleTimeString();
            } catch (err) {
                console.error("Error loading commission summary:", err);
                commissionSummaryList.innerHTML = '<p style="color:#fc8181;">Error loading data. Check console (F12) — Firestore index may be required.</p>';
            }
        }

        commissionRefreshBtn?.addEventListener('click', loadCommissionSummary);

        // ===== TRANSACTION LOG =====
        const transactionsDisplay = document.getElementById('transactions-display');
        const exportTransactionsBtn = document.getElementById('export-transactions-btn');

        async function loadTransactions() {
            if (!transactionsDisplay) return;
            transactionsDisplay.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_transactions"), firestore.orderBy("createdAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { transactionsDisplay.innerHTML = '<p class="loading-message">No transactions yet.</p>'; return; }

                const table = document.createElement('table');
                table.innerHTML = `<thead><tr>
                    <th>Date</th><th>Employee</th><th>Type</th><th>Items</th>
                    <th>Total Revenue</th><th>Emp Commission</th><th>Commission Paid?</th>
                </tr></thead>`;
                const tbody = document.createElement('tbody');
                snap.forEach(d => {
                    const tx = d.data();
                    const date = tx.createdAt?.toDate?.()?.toLocaleString() || '—';
                    const items = (tx.items || []).map(i => `${i.productName || i.itemName}(x${i.qty})`).join(', ');
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${date}</td>
                        <td>${tx.employeeName || '—'}</td>
                        <td>${tx.type === 'sale' ? '🛒 Sale' : '🗑️ Purchase'}</td>
                        <td style="font-size:0.8rem;">${items || '—'}</td>
                        <td>$${(tx.totalRevenue || 0).toLocaleString()}</td>
                        <td style="color:#d4a847;">$${(tx.totalEmpCommission || 0).toLocaleString()}</td>
                        <td>${tx.commissionCleared ? '<span style="color:#48bb78;">✅ Paid</span>' : '<span style="color:#fc8181;">⏳ Owed</span>'}</td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                transactionsDisplay.innerHTML = '';
                transactionsDisplay.appendChild(table);
            } catch (err) {
                console.error("Error loading transactions:", err);
                transactionsDisplay.innerHTML = '<p style="color:#fc8181;">Error loading transactions.</p>';
            }
        }

        exportTransactionsBtn?.addEventListener('click', async () => {
            try {
                const q = firestore.query(firestore.collection(db, "pd_transactions"), firestore.orderBy("createdAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { alert("No transactions to export."); return; }
                const rows = [["Date", "Employee", "Type", "Items", "Total Revenue", "Emp Commission", "Commission Paid"]];
                snap.forEach(d => {
                    const tx = d.data();
                    const date = tx.createdAt?.toDate?.()?.toLocaleString() || '';
                    const items = (tx.items || []).map(i => `${i.productName || i.itemName}(x${i.qty})`).join('; ');
                    rows.push([`"${date}"`, `"${tx.employeeName}"`, tx.type, `"${items}"`, tx.totalRevenue || 0, tx.totalEmpCommission || 0, tx.commissionCleared ? 'Yes' : 'No']);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'pump_dump_transactions.csv'; a.click();
                URL.revokeObjectURL(url);
            } catch (err) { alert("Export error."); }
        });

        // ===== COMMISSION PAYMENT LOGS =====
        const commissionLogsDisplay = document.getElementById('commission-payment-logs-display');
        const exportCommissionLogBtn = document.getElementById('export-commission-log-btn');

        async function renderCommissionLogs() {
            if (!commissionLogsDisplay) return;
            commissionLogsDisplay.innerHTML = '<p class="loading-message">Loading...</p>';
            try {
                const q = firestore.query(firestore.collection(db, "pd_commission_logs"), firestore.orderBy("paidAt", "desc"));
                const snap = await firestore.getDocs(q);
                if (snap.empty) { commissionLogsDisplay.innerHTML = '<p class="loading-message">No payment logs yet.</p>'; return; }
                const table = document.createElement('table');
                table.innerHTML = `<thead><tr><th>Date Paid</th><th>Employee</th><th>Amount Paid</th><th>Paid By</th><th># Transactions</th></tr></thead>`;
                const tbody = document.createElement('tbody');
                snap.forEach(d => {
                    const log = d.data();
                    const date = log.paidAt?.toDate?.()?.toLocaleString() || '—';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${date}</td>
                        <td>${log.employeeName || '—'}</td>
                        <td style="color:#48bb78; font-weight:700;">$${(log.totalPaid || 0).toLocaleString()}</td>
                        <td>${log.paidBy || '—'}</td>
                        <td>${(log.transactionIds || []).length}</td>
                    `;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                commissionLogsDisplay.innerHTML = '';
                commissionLogsDisplay.appendChild(table);
            } catch (err) {
                commissionLogsDisplay.innerHTML = '<p style="color:#fc8181;">Error loading logs.</p>';
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
                    rows.push([`"${log.paidAt?.toDate?.()?.toLocaleString()}"`, `"${log.employeeName}"`, log.totalPaid || 0, `"${log.paidBy}"`, (log.transactionIds || []).length]);
                });
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'pump_dump_commission_log.csv'; a.click();
                URL.revokeObjectURL(url);
            } catch (err) { alert("Export error."); }
        });



        // ===== COMPOST INVENTORY =====
        // Defined inside initManagerContent so it closes over the correct db/firestore
        async function loadCompostInventory() {
            const display = document.getElementById('compost-stock-display');
            const input = document.getElementById('compost-stock-input');
            const saveBtn = document.getElementById('compost-stock-save-btn');
            const statusMsg = document.getElementById('compost-stock-status');
            if (!display) return;

            try {
                const docRef = firestore.doc(db, "pd_inventory", "bag_of_compost");
                const snap = await firestore.getDoc(docRef);
                const current = snap.exists() ? (snap.data().stock ?? 0) : 0;
                display.textContent = current;
                display.style.color = current > 0 ? '#48bb78' : '#fc8181';
                if (input) input.value = current;
            } catch (e) {
                console.warn("Could not load compost stock:", e);
                if (display) display.textContent = '—';
            }

            // Remove any old listener before adding a new one (prevents duplicates on re-init)
            const newSaveBtn = saveBtn?.cloneNode(true);
            if (saveBtn && newSaveBtn) saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

            newSaveBtn?.addEventListener('click', async () => {
                const currentInput = document.getElementById('compost-stock-input');
                const currentDisplay = document.getElementById('compost-stock-display');
                const currentStatus = document.getElementById('compost-stock-status');
                const newStock = parseInt(currentInput?.value);
                if (isNaN(newStock) || newStock < 0) {
                    if (currentStatus) { currentStatus.textContent = 'Enter a valid number.'; currentStatus.style.color = '#fc8181'; }
                    return;
                }
                newSaveBtn.disabled = true;
                if (currentStatus) currentStatus.textContent = 'Saving...';
                try {
                    const docRef = firestore.doc(db, "pd_inventory", "bag_of_compost");
                    await firestore.setDoc(docRef, { stock: newStock, updatedAt: firestore.serverTimestamp() });
                    if (currentDisplay) { currentDisplay.textContent = newStock; currentDisplay.style.color = newStock > 0 ? '#48bb78' : '#fc8181'; }
                    if (currentStatus) { currentStatus.textContent = `✅ Stock updated to ${newStock}.`; currentStatus.style.color = '#48bb78'; }
                } catch (err) {
                    console.error("Error saving stock:", err);
                    if (currentStatus) { currentStatus.textContent = 'Error saving. Try again.'; currentStatus.style.color = '#fc8181'; }
                } finally {
                    newSaveBtn.disabled = false;
                }
            });
        }

        // Auto-load everything
        loadAndRenderEmployees();
        loadCommissionSummary();
        loadTransactions();
        renderCommissionLogs();
        loadCompostInventory();
    }

    let processed = false;

    if (FIREBASE_BYPASS) {
        const bypass = buildBypassFirebase();
        executeManagerAppLogic(bypass);
    } else {
        document.addEventListener('firebaseReady', (e) => {
            if (!processed) { processed = true; executeManagerAppLogic(e.detail); }
        });
        document.addEventListener('firebaseError', () => {
            if (!processed) { processed = true; hideLoadingScreen(); alert("Firebase failed to initialize."); }
        });
        setTimeout(() => {
            if (!processed) {
                if (window.isFirebaseReady && window.db) executeManagerAppLogic({ db: window.db, functions: window.firestoreFunctions });
                else { processed = true; hideLoadingScreen(); }
            }
        }, 3500);
    }
});
