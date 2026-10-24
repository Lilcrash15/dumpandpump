document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    function hideLoadingScreen() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => { if (loadingOverlay?.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay); }, 500);
        }
    }

    let db, firestore;
    let appLogicHasRun = false;

    const loginContainer = document.getElementById('commission-login-form-container');
    const loginForm = document.getElementById('commission-page-login-form');
    const loginSelect = document.getElementById('commission-login-select');
    const passwordGroup = document.getElementById('commission-password-group');
    const passwordInput = document.getElementById('commission-page-password');
    const loginSubmitBtn = document.getElementById('commission-login-submit-btn');
    const loginError = document.getElementById('commission-page-login-error');
    const mainContent = document.getElementById('commission-main-content');
    const detailsContainer = document.getElementById('commission-details-container');
    const employeeNameDisplay = document.getElementById('selected-employee-name');
    const initialsDisplay = document.getElementById('commission-initials');
    const totalCommissionDisplay = document.getElementById('total-commission-owed');
    const transactionCountDisplay = document.getElementById('transaction-count');
    const playerIdDisplay = document.getElementById('employee-player-id');
    const statusMessage = document.getElementById('commission-status-message');

    function setStatus(text, kind) {
        statusMessage.textContent = text;
        statusMessage.classList.remove('ok', 'err');
        statusMessage.style.color = '';
        if (kind === 'ok' || kind === 'err') statusMessage.classList.add(kind);
        if (kind === 'warn') statusMessage.style.color = 'var(--amber)';
    }

    function updateView(isLoggedIn) {
        if (isLoggedIn) {
            loginContainer.style.display = 'none';
            mainContent.style.display = 'block';
            if (typeof addLogoutButton === 'function') addLogoutButton();
        } else {
            loginContainer.style.display = 'block';
            mainContent.style.display = 'none';
        }
    }

    async function fetchCommission(employeeName, employeeData) {
        if (!employeeName) { detailsContainer.style.display = 'none'; return; }
        employeeNameDisplay.textContent = employeeName;
        if (initialsDisplay) initialsDisplay.textContent = initials(employeeName);
        totalCommissionDisplay.textContent = '…';
        detailsContainer.style.display = 'block';
        setStatus('');

        playerIdDisplay.textContent = employeeData?.playerId || employeeData?.playerID || '—';

        try {
            const q = firestore.query(
                firestore.collection(db, "pd_transactions"),
                firestore.where("employeeName", "==", employeeName),
                firestore.where("commissionCleared", "==", false)
            );
            const snapshot = await firestore.getDocs(q);
            let totalCommission = 0;
            let count = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (typeof data.totalEmpCommission === 'number') {
                    totalCommission += data.totalEmpCommission;
                    count++;
                }
            });

            totalCommissionDisplay.textContent = money(totalCommission);
            totalCommissionDisplay.style.color = totalCommission > 0 ? 'var(--amber)' : 'var(--green)';
            if (transactionCountDisplay) transactionCountDisplay.textContent = count;

            if (totalCommission <= 0) {
                setStatus('✅ No outstanding commission — you\'re all paid up!', 'ok');
            } else {
                setStatus(`You have ${money(totalCommission)} in commission ready to be paid out.`, 'warn');
            }
        } catch (err) {
            console.error("Error fetching commission:", err);
            totalCommissionDisplay.textContent = 'Error';
            setStatus('Error loading data. Check console (F12) — a Firestore index may be required.', 'err');
        }
    }

    async function executeAppLogic(firebaseDetail) {
        if (appLogicHasRun) return;
        appLogicHasRun = true;
        db = firebaseDetail.db;
        firestore = firebaseDetail.functions;

        let employeeList = [];
        try {
            const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
            const snap = await firestore.getDocs(q);
            employeeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error("Error loading employees:", e); }

        if (loginSelect) {
            loginSelect.innerHTML = '<option value="">— Select Your Name —</option>';
            employeeList.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.fullName;
                loginSelect.appendChild(opt);
            });

            loginSelect.addEventListener('change', () => {
                if (loginSelect.value) {
                    passwordGroup.style.display = 'flex';
                    loginSubmitBtn.style.display = 'flex';
                    passwordInput.value = '';
                    passwordInput.focus();
                    loginError.style.display = 'none';
                } else {
                    passwordGroup.style.display = 'none';
                    loginSubmitBtn.style.display = 'none';
                }
            });
        }

        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedId = loginSelect.value;
            const enteredPw = passwordInput.value;
            if (!selectedId) return;
            const emp = employeeList.find(em => em.id === selectedId);
            if (emp && emp.loginPassword && emp.loginPassword === enteredPw) {
                if (typeof grantEmployeeSession === 'function') grantEmployeeSession();
                localStorage.setItem('loggedInEmployeeName', emp.fullName);
                localStorage.setItem('loggedInEmployeeId', emp.id);
                updateView(true);
                await fetchCommission(emp.fullName, emp);
            } else {
                loginError.style.display = 'block';
                passwordInput.value = '';
            }
        });

        if (typeof checkEmployeeSession === 'function' && checkEmployeeSession()) {
            updateView(true);
            const empName = localStorage.getItem('loggedInEmployeeName');
            const empId = localStorage.getItem('loggedInEmployeeId');
            const emp = employeeList.find(e => e.id === empId) || { fullName: empName };
            await fetchCommission(empName, emp);
        }

        hideLoadingScreen();
    }

    let processed = false;

    const FIREBASE_BYPASS = false;
    function buildBypassFirebase() {
        const noopPromise = () => Promise.resolve({ docs: [], empty: true, forEach: () => {} });
        return { db: {}, functions: { collection: () => ({}), query: () => ({}), where: () => ({}), orderBy: () => ({}), getDocs: noopPromise, doc: () => ({}), getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }), serverTimestamp: () => new Date() } };
    }

    if (FIREBASE_BYPASS) {
        executeAppLogic(buildBypassFirebase());
    } else if (window.isFirebaseReady && window.db && window.firestoreFunctions) {
        // Firebase usually finishes before this script runs — start right away instead of waiting on the timeout
        processed = true;
        executeAppLogic({ db: window.db, functions: window.firestoreFunctions });
    } else {
        document.addEventListener('firebaseReady', (e) => { if (!processed) { processed = true; executeAppLogic(e.detail); } });
        document.addEventListener('firebaseError', () => { if (!processed) { processed = true; hideLoadingScreen(); } });
        setTimeout(() => {
            if (!processed) {
                processed = true;
                if (window.isFirebaseReady && window.db) executeAppLogic({ db: window.db, functions: window.firestoreFunctions });
                else hideLoadingScreen();
            }
        }, 3500);
    }
});
