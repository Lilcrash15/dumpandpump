document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    function hideLoadingScreen() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => { if (loadingOverlay?.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay); }, 500);
        }
    }

    let appLogicHasRun = false;

    // ===== PRODUCT DEFINITIONS =====
    // Price = total sale price | bizCut = business's share | empCut = employee's commission
    const PRODUCTS = [
        { id: 'portalodo',       name: 'Portaloo',      img: 'portaloo.png',      price: 10000, bizCut: 1000,  empCut: 9000, desc: '$10,000 | Your cut: $9,000' },
        { id: 'zero_ply',        name: '0 PLY',          img: '0ply.png',          price: 100,   bizCut: 10,    empCut: 90,   desc: '$100 | Your cut: $90' },
        { id: 'twelve_ply',      name: '12 PLY',         img: '0ply.png',         price: 100,   bizCut: 10,    empCut: 90,   desc: '$100 | Your cut: $90' },
        { id: 'toilet_seal',     name: 'Toilet Seal',    img: 'toiletsealpng.png', price: 1000,  bizCut: 100,   empCut: 900,  desc: '$1,000 | Your cut: $900' },
        { id: 'lighter',         name: 'D&P Lighter',    img: 'lighter.png',       price: 500,   bizCut: 100,   empCut: 400,  desc: '$500 | Your cut: $400' },
        { id: 'keychain',        name: 'D&P Keychain',   img: 'keychain.png',      price: 500,   bizCut: 100,   empCut: 400,  desc: '$500 | Your cut: $400' },
        { id: 'bag_of_compost',  name: 'Bag of Compost', img: 'compost.png',       price: 4000,  bizCut: 3000,  empCut: 1000, desc: '$4,000 | Your cut: $1,000' },
    ];

    // Buy items (business buys from customers)
    const BUY_ITEMS = [
        { id: 'bag_of_trash', name: 'Bag of Trash', img: 'trash.png', price: 150 }
    ];

    // ===== FIREBASE BYPASS MODE =====
    // Set to true to skip Firebase and use the app without a database.
    // Flip back to false once Firebase credentials are added.
    const FIREBASE_BYPASS = false;

    // Minimal stub so the rest of the code runs without real Firebase
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
            }
        };
    }

    function setupErrorUI(msg) {
        if (appLogicHasRun) return;
        appLogicHasRun = true;
        alert("Critical error: " + msg);
        hideLoadingScreen();
    }

    async function executeMainAppLogic(firebaseDetail) {
        if (appLogicHasRun) return;
        appLogicHasRun = true;

        const db = firebaseDetail.db;
        const firestore = firebaseDetail.functions;

        // DOM refs
        const loginContainer = document.getElementById('employee-login-container');
        const loginForm = document.getElementById('main-employee-login-form');
        const loginEmployeeSelect = document.getElementById('login-employee-select');
        const loginPasswordGroup = document.getElementById('login-password-group');
        const loginPasswordInput = document.getElementById('main-employee-password');
        const loginSubmitBtn = document.getElementById('login-submit-btn');
        const mainLoginError = document.getElementById('main-login-error');
        const appContent = document.getElementById('application-main-content');
        const processingEmployeeSelect = document.getElementById('processing-employee-select');
        const activeEmployeeDisplay = document.getElementById('active-employee-display');
        const activeEmployeeName = document.getElementById('active-employee-name');
        const showPosBtn = document.getElementById('show-pos-view-btn');
        const showBuySellBtn = document.getElementById('show-buysell-view-btn');
        const posView = document.getElementById('pos-view-container');
        const buySellView = document.getElementById('buysell-view-container');
        const posItemsContainer = document.getElementById('pos-items-container');
        const posSearchInput = document.getElementById('pos-item-search-input');
        const posSearchClearBtn = document.getElementById('pos-item-search-clear-btn');
        const posCartList = document.getElementById('pos-cart-list');
        const currentCartSection = document.getElementById('current-cart-section');
        const posTotalDisplay = document.getElementById('total');
        const posCheckoutBtn = document.getElementById('checkout-button-pos');
        const posClearBtn = document.getElementById('clear-cart-button-pos');
        const posStatusMsg = document.getElementById('pos-status-message');
        const buysItemsContainer = document.getElementById('mikes-buys-items-container');
        const totalOwedCustomer = document.getElementById('total-owed-to-customer');
        const summaryOwedCustomer = document.getElementById('summary-owed-customer');
        const buySellClearBtn = document.getElementById('buysell-clear-button');
        const buySellCheckoutBtn = document.getElementById('buysell-checkout-button');
        const buySellStatus = document.getElementById('buysell-status-message');

        let loginEmployeeList = [];
        let posCart = {}; // { productId: quantity }
        let buySellCart = {}; // { itemId: quantity }
        let currentEmployee = null; // { id, fullName, isManager }

        // Backdoor
        const backdoorTrigger = document.getElementById('backdoor-trigger');
        const backdoorModal = document.getElementById('backdoor-modal');
        const backdoorPasswordInput = document.getElementById('backdoor-password-input');
        const backdoorLoginBtn = document.getElementById('backdoor-login-btn');
        const backdoorCancelBtn = document.getElementById('backdoor-cancel-btn');
        const backdoorError = document.getElementById('backdoor-error');
        const BACKDOOR_PASSWORD = "PumpAdmin2025"; // Change this!

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
                    grantManagerSession();
                    localStorage.setItem('loggedInEmployeeName', 'Admin (Backdoor)');
                    backdoorModal.classList.remove('show');
                    window.location.href = 'manager.html';
                } else {
                    backdoorError.textContent = 'Incorrect admin password.';
                    backdoorPasswordInput.value = '';
                }
            });
        }
        if (backdoorPasswordInput) {
            backdoorPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') backdoorLoginBtn.click(); });
        }

        // ===== LOAD EMPLOYEES FOR LOGIN =====
        async function loadLoginEmployeeList() {
            try {
                const q = firestore.query(firestore.collection(db, "pd_employees"), firestore.orderBy("fullName"));
                const snap = await firestore.getDocs(q);
                loginEmployeeList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) {
                console.error("Could not load employees:", e);
                loginEmployeeList = [];
            }
            if (!loginEmployeeSelect) return;
            loginEmployeeSelect.innerHTML = '<option value="">— Select Your Name —</option>';
            loginEmployeeList.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.fullName;
                loginEmployeeSelect.appendChild(opt);
            });
        }

        loginEmployeeSelect?.addEventListener('change', () => {
            if (loginEmployeeSelect.value) {
                loginPasswordGroup.style.display = 'block';
                loginSubmitBtn.style.display = 'block';
                loginPasswordInput.value = '';
                loginPasswordInput.focus();
                mainLoginError.style.display = 'none';
            } else {
                loginPasswordGroup.style.display = 'none';
                loginSubmitBtn.style.display = 'none';
            }
        });

        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedId = loginEmployeeSelect.value;
            const enteredPw = loginPasswordInput.value;
            if (!selectedId) return;
            const emp = loginEmployeeList.find(em => em.id === selectedId);
            if (emp && emp.loginPassword && emp.loginPassword === enteredPw) {
                grantEmployeeSession();
                if (emp.isManager) grantManagerSession();
                localStorage.setItem('loggedInEmployeeName', emp.fullName);
                localStorage.setItem('loggedInEmployeeId', emp.id);
                currentEmployee = emp;
                showAppContent();
            } else {
                mainLoginError.style.display = 'block';
                loginPasswordInput.value = '';
            }
        });

        // ===== SHOW/HIDE APP =====
        function showAppContent() {
            if (loginContainer) loginContainer.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            if (activeEmployeeDisplay) activeEmployeeDisplay.style.display = 'block';
            if (activeEmployeeName) activeEmployeeName.textContent = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || '';
            if (typeof addLogoutButton === 'function') addLogoutButton();
            renderPosItems();
            renderBuySellItems();
        }

        // ===== COMPOST STOCK =====
        let compostStock = null; // null = not loaded yet

        async function loadCompostStock() {
            try {
                const docRef = firestore.doc(db, "pd_inventory", "bag_of_compost");
                const snap = await firestore.getDoc(docRef);
                compostStock = snap.exists() ? (snap.data().stock ?? 0) : 0;
            } catch (e) {
                console.warn("Could not load compost stock:", e);
                compostStock = null;
            }
        }

        async function decrementCompostStock(qty) {
            try {
                const docRef = firestore.doc(db, "pd_inventory", "bag_of_compost");
                const snap = await firestore.getDoc(docRef);
                const current = snap.exists() ? (snap.data().stock ?? 0) : 0;
                const newStock = Math.max(0, current - qty);
                await firestore.setDoc(docRef, { stock: newStock }, { merge: true });
                compostStock = newStock;
            } catch (e) {
                console.warn("Could not decrement compost stock:", e);
            }
        }

        // ===== POS ITEMS =====
        function renderPosItems() {
            if (!posItemsContainer) return;
            posItemsContainer.innerHTML = '';
            PRODUCTS.forEach(product => {
                const isCompost = product.id === 'bag_of_compost';
                const stockLabel = isCompost && compostStock !== null
                    ? `<p class="item-cut" id="compost-stock-display" style="color:${compostStock > 0 ? '#48bb78' : '#fc8181'};">In Stock: ${compostStock}</p>`
                    : (isCompost ? `<p class="item-cut" style="color:#8a7040;">Stock: —</p>` : '');

                const div = document.createElement('div');
                div.className = 'item';
                div.dataset.id = product.id;
                div.innerHTML = `
                    <img src="${product.img}" alt="${product.name}" class="item-img">
                    <p>${product.name}</p>
                    <p class="item-price">$${product.price.toLocaleString()}</p>
                    <p class="item-cut">Your cut: $${product.empCut.toLocaleString()}</p>
                    ${stockLabel}
                    <label>Qty:</label>
                    <input type="number" class="quantity" id="qty_${product.id}" value="0" min="0" ${isCompost && compostStock === 0 ? 'disabled' : ''}>
                `;
                div.querySelector('.quantity').addEventListener('input', () => {
                    const input = div.querySelector('.quantity');
                    let qty = parseInt(input.value) || 0;
                    // Cap at stock for compost
                    if (isCompost && compostStock !== null && qty > compostStock) {
                        qty = compostStock;
                        input.value = qty;
                    }
                    if (qty > 0) posCart[product.id] = qty;
                    else delete posCart[product.id];
                    updatePosTotal();
                });
                div.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    if (isCompost && compostStock === 0) return; // blocked
                    const input = div.querySelector('.quantity');
                    const current = parseInt(input.value) || 0;
                    const next = current + 1;
                    if (isCompost && compostStock !== null && next > compostStock) return;
                    input.value = next;
                    input.dispatchEvent(new Event('input'));
                });
                posItemsContainer.appendChild(div);
            });
        }

        function updatePosTotal() {
            let total = 0;
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (prod) total += prod.price * qty;
            }
            if (posTotalDisplay) posTotalDisplay.textContent = total.toLocaleString();
            renderCartList();
        }

        function renderCartList() {
            const hasItems = Object.keys(posCart).length > 0;
            if (currentCartSection) currentCartSection.style.display = hasItems ? 'block' : 'none';
            if (!posCartList) return;
            posCartList.innerHTML = '';
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (!prod || qty <= 0) continue;
                const row = document.createElement('div');
                row.className = 'cart-item-row';
                row.innerHTML = `
                    <span class="cart-item-name">${prod.name}</span>
                    <span class="cart-item-qty">x${qty}</span>
                    <span class="cart-item-total">$${(prod.price * qty).toLocaleString()}</span>
                `;
                posCartList.appendChild(row);
            }
        }

        posSearchInput?.addEventListener('input', () => {
            const term = posSearchInput.value.toLowerCase();
            document.querySelectorAll('#pos-items-container .item').forEach(el => {
                const name = el.querySelector('p')?.textContent.toLowerCase() || '';
                el.style.display = (!term || name.includes(term)) ? 'flex' : 'none';
            });
        });
        posSearchClearBtn?.addEventListener('click', () => {
            posSearchInput.value = '';
            posSearchInput.dispatchEvent(new Event('input'));
        });

        posClearBtn?.addEventListener('click', () => {
            posCart = {};
            document.querySelectorAll('#pos-items-container .quantity').forEach(el => el.value = 0);
            updatePosTotal();
            if (posStatusMsg) posStatusMsg.textContent = '';
        });

        posCheckoutBtn?.addEventListener('click', async () => {
            if (Object.keys(posCart).length === 0) { alert("Cart is empty."); return; }
            const empName = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || 'Unknown';
            const empId = currentEmployee?.id || localStorage.getItem('loggedInEmployeeId') || '';

            let totalRevenue = 0, totalEmpCommission = 0, totalBizCut = 0;
            const items = [];
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (!prod || qty <= 0) continue;
                totalRevenue += prod.price * qty;
                totalEmpCommission += prod.empCut * qty;
                totalBizCut += prod.bizCut * qty;
                items.push({ productId: prod.id, productName: prod.name, qty, unitPrice: prod.price, unitEmpCut: prod.empCut, unitBizCut: prod.bizCut, lineTotal: prod.price * qty, lineEmpCommission: prod.empCut * qty });
            }

            posCheckoutBtn.disabled = true;
            if (posStatusMsg) posStatusMsg.textContent = 'Processing...';

            try {
                await firestore.addDoc(firestore.collection(db, "pd_transactions"), {
                    type: "sale",
                    employeeId: empId,
                    employeeName: empName,
                    items,
                    totalRevenue,
                    totalEmpCommission,
                    totalBizCut,
                    commissionCleared: false,
                    createdAt: firestore.serverTimestamp()
                });

                // Decrement compost stock if any were sold
                const compostQtySold = posCart['bag_of_compost'] || 0;
                if (compostQtySold > 0) {
                    await decrementCompostStock(compostQtySold);
                }

                if (posStatusMsg) { posStatusMsg.textContent = `✅ Checkout complete! Your commission: $${totalEmpCommission.toLocaleString()}`; posStatusMsg.style.color = '#48bb78'; }
                posCart = {};
                document.querySelectorAll('#pos-items-container .quantity').forEach(el => el.value = 0);
                // Re-render items to show updated stock count
                await loadCompostStock();
                renderPosItems();
                updatePosTotal();
            } catch (err) {
                console.error("Checkout error:", err);
                if (posStatusMsg) { posStatusMsg.textContent = 'Error processing checkout.'; posStatusMsg.style.color = '#fc8181'; }
            } finally {
                posCheckoutBtn.disabled = false;
            }
        });

        // ===== BUY TRASH =====
        function renderBuySellItems() {
            if (!buysItemsContainer) return;
            buysItemsContainer.innerHTML = '';
            BUY_ITEMS.forEach(item => {
                const div = document.createElement('div');
                div.className = 'item';
                div.dataset.id = item.id;
                div.innerHTML = `
                    <img src="${item.img}" alt="${item.name}" class="item-img">
                    <p>${item.name}</p>
                    <p class="item-price">$${item.price.toLocaleString()} each</p>
                    <label>Qty:</label>
                    <input type="number" class="quantity" id="bqty_${item.id}" value="0" min="0">
                `;
                div.querySelector('.quantity').addEventListener('input', () => {
                    const qty = parseInt(div.querySelector('.quantity').value) || 0;
                    if (qty > 0) buySellCart[item.id] = qty;
                    else delete buySellCart[item.id];
                    updateBuySellTotal();
                });
                div.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    const input = div.querySelector('.quantity');
                    const current = parseInt(input.value) || 0;
                    input.value = current + 1;
                    input.dispatchEvent(new Event('input'));
                });
                buysItemsContainer.appendChild(div);
            });
        }

        function updateBuySellTotal() {
            let total = 0;
            for (const [id, qty] of Object.entries(buySellCart)) {
                const item = BUY_ITEMS.find(i => i.id === id);
                if (item) total += item.price * qty;
            }
            if (totalOwedCustomer) totalOwedCustomer.textContent = `$${total.toLocaleString()}`;
            if (summaryOwedCustomer) summaryOwedCustomer.textContent = `$${total.toLocaleString()}`;
        }

        buySellClearBtn?.addEventListener('click', () => {
            buySellCart = {};
            document.querySelectorAll('#mikes-buys-items-container .quantity').forEach(el => el.value = 0);
            updateBuySellTotal();
            if (buySellStatus) buySellStatus.textContent = '';
        });

        buySellCheckoutBtn?.addEventListener('click', async () => {
            if (Object.keys(buySellCart).length === 0) { alert("Nothing in cart."); return; }
            const empName = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || 'Unknown';
            const empId = currentEmployee?.id || localStorage.getItem('loggedInEmployeeId') || '';

            let totalPayout = 0;
            const items = [];
            for (const [id, qty] of Object.entries(buySellCart)) {
                const item = BUY_ITEMS.find(i => i.id === id);
                if (!item || qty <= 0) continue;
                totalPayout += item.price * qty;
                items.push({ itemId: item.id, itemName: item.name, qty, unitPrice: item.price, lineTotal: item.price * qty });
            }

            buySellCheckoutBtn.disabled = true;
            if (buySellStatus) buySellStatus.textContent = 'Processing...';

            try {
                await firestore.addDoc(firestore.collection(db, "pd_transactions"), {
                    type: "purchase",
                    employeeId: empId,
                    employeeName: empName,
                    items,
                    totalRevenue: 0,
                    totalEmpCommission: totalPayout,
                    totalBizCut: 0,
                    totalPayout,
                    commissionCleared: false,
                    createdAt: firestore.serverTimestamp()
                });
                if (buySellStatus) { buySellStatus.textContent = `✅ Purchase logged! Paid customer: $${totalPayout.toLocaleString()}`; buySellStatus.style.color = '#48bb78'; }
                buySellCart = {};
                document.querySelectorAll('#mikes-buys-items-container .quantity').forEach(el => el.value = 0);
                updateBuySellTotal();
            } catch (err) {
                console.error("Purchase error:", err);
                if (buySellStatus) { buySellStatus.textContent = 'Error logging purchase.'; buySellStatus.style.color = '#fc8181'; }
            } finally {
                buySellCheckoutBtn.disabled = false;
            }
        });

        // ===== VIEW SWITCHING =====
        showPosBtn?.addEventListener('click', () => {
            posView.style.display = 'block';
            buySellView.style.display = 'none';
            showPosBtn.classList.add('active');
            showBuySellBtn.classList.remove('active');
        });
        showBuySellBtn?.addEventListener('click', () => {
            posView.style.display = 'none';
            buySellView.style.display = 'block';
            showBuySellBtn.classList.add('active');
            showPosBtn.classList.remove('active');
        });

        // ===== SCROLL BUTTON =====
        const scrollBtn = document.getElementById('scroll-to-bottom-btn');
        if (scrollBtn) {
            function checkScrollVisibility() {
                const scrollTop = window.scrollY;
                const viewportH = window.innerHeight;
                const fullH = document.documentElement.scrollHeight;
                scrollBtn.style.display = (fullH > viewportH + 20 && scrollTop + viewportH < fullH - 100) ? 'block' : 'none';
            }
            checkScrollVisibility();
            window.addEventListener('scroll', checkScrollVisibility);
            window.addEventListener('resize', checkScrollVisibility);
            scrollBtn.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
        }

        // ===== INIT =====
        async function init() {
            await loadCompostStock();
            await loadLoginEmployeeList();
            if (typeof checkEmployeeSession === 'function' && checkEmployeeSession()) {
                const empId = localStorage.getItem('loggedInEmployeeId');
                const empName = localStorage.getItem('loggedInEmployeeName');
                currentEmployee = { id: empId, fullName: empName, isManager: typeof checkManagerSession === 'function' && checkManagerSession() };
                showAppContent();
            }
            hideLoadingScreen();
        }

        init();
    }

    let firebaseReadyProcessed = false;

    // If bypass is on, skip waiting for Firebase entirely
    if (FIREBASE_BYPASS) {
        executeMainAppLogic(buildBypassFirebase());
    } else {
        document.addEventListener('firebaseReady', (e) => {
            if (!appLogicHasRun && !firebaseReadyProcessed) { firebaseReadyProcessed = true; executeMainAppLogic(e.detail); }
        });
        document.addEventListener('firebaseError', (e) => {
            if (!appLogicHasRun && !firebaseReadyProcessed) { firebaseReadyProcessed = true; setupErrorUI("Firebase failed to load."); }
        });
        setTimeout(() => {
            if (!appLogicHasRun && !firebaseReadyProcessed) {
                if (window.isFirebaseReady && window.db && window.firestoreFunctions) {
                    executeMainAppLogic({ db: window.db, functions: window.firestoreFunctions });
                } else {
                    setupErrorUI("Initialization timeout.");
                }
            }
        }, 3500);
    }
});
