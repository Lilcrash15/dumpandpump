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
    const totalCommissionDisplay = document.getElementById('total-commission-owed');
    const transactionCountDisplay = document.getElementById('transaction-count');
    const playerIdDisplay = document.getElementById('employee-player-id');
    const statusMessage = document.getElementById('commission-status-message');

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
        totalCommissionDisplay.textContent = 'Loading...';
        detailsContainer.style.display = 'block';
        statusMessage.textContent = '';

        if (employeeData?.playerId) {
            playerIdDisplay.textContent = employeeData.playerId;
        } else {
            playerIdDisplay.textContent = employeeData?.playerID || '—';
        }

        try {
            const q = firestore.query(
                firestore.collection(db, "pd_transactions"),
                firestore.where("employeeName", "==", employeeName),
                firestore.where("commissionCleared", "==", false),
                firestore.where("type", "==", "sale")
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

            totalCommissionDisplay.textContent = `$${totalCommission.toLocaleString()}`;
            totalCommissionDisplay.style.color = totalCommission > 0 ? '#d4a847' : '#48bb78';
            if (transactionCountDisplay) transactionCountDisplay.textContent = count;

            if (totalCommission <= 0) {
                statusMessage.textContent = '✅ No outstanding commission — you\'re all paid up!';
                statusMessage.style.color = '#48bb78';
            } else {
                statusMessage.textContent = `You have $${totalCommission.toLocaleString()} in commission ready to be paid out.`;
                statusMessage.style.color = '#d4a847';
            }
        } catch (err) {
            console.error("Error fetching commission:", err);
            totalCommissionDisplay.textContent = 'Error';
            statusMessage.textContent = 'Error loading data. Check console (F12) — a Firestore index may be required.';
            statusMessage.style.color = '#fc8181';
        }
    }

    async function executeAppLogic(firebaseDetail) {
        if (appLogicHasRun) return;
        appLogicHasRun = true;
        db = firebaseDetail.db;
        firestore = firebaseDetail.functions;

        // Load employees for login select
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
                    passwordGroup.style.display = 'block';
                    loginSubmitBtn.style.display = 'block';
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

        // Check if already logged in
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
    } else {
        document.addEventListener('firebaseReady', (e) => { if (!processed) { processed = true; executeAppLogic(e.detail); } });
        document.addEventListener('firebaseError', () => { if (!processed) { processed = true; hideLoadingScreen(); } });
        setTimeout(() => {
            if (!processed) {
                if (window.isFirebaseReady && window.db) executeAppLogic({ db: window.db, functions: window.firestoreFunctions });
                else { processed = true; hideLoadingScreen(); }
            }
        }, 3500);
    }
});
