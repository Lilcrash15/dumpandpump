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
        { id: 'portalodo',       name: 'Portaloo',      img: 'portaloo.png',      price: 10000, bizCut: 1000,  empCut: 9000 },
        { id: 'zero_ply',        name: '0 PLY',          img: '0ply.png',          price: 100,   bizCut: 10,    empCut: 90 },
        { id: 'twelve_ply',      name: '12 PLY',         img: '0ply.png',          price: 100,   bizCut: 10,    empCut: 90 },
        { id: 'toilet_seal',     name: 'Toilet Seal',    img: 'toiletsealpng.png', price: 1000,  bizCut: 100,   empCut: 900 },
        { id: 'lighter',         name: 'D&P Lighter',    img: 'lighter.png',       price: 500,   bizCut: 100,   empCut: 400 },
        { id: 'keychain',        name: 'D&P Keychain',   img: 'keychain.png',      price: 500,   bizCut: 100,   empCut: 400 },
        { id: 'bag_of_compost',  name: 'Bag of Compost', img: 'compost.png',       price: 4000,  bizCut: 3000,  empCut: 1000 },
    ];

    // Buy items (business buys from customers)
    const BUY_ITEMS = [
        { id: 'bag_of_trash', name: 'Bag of Trash', img: 'trash.png', price: 150, empCut: 160 }
    ];

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
        const activeEmployeeDisplay = document.getElementById('active-employee-display');
        const activeEmployeeName = document.getElementById('active-employee-name');
        const activeEmployeeInitials = document.getElementById('active-employee-initials');
        const activeEmployeeRank = document.getElementById('active-employee-rank');
        const showPosBtn = document.getElementById('show-pos-view-btn');
        const showBuySellBtn = document.getElementById('show-buysell-view-btn');
        const posView = document.getElementById('pos-view-container');
        const buySellView = document.getElementById('buysell-view-container');
        const posItemsContainer = document.getElementById('pos-items-container');
        const posCartList = document.getElementById('pos-cart-list');
        const posCartEmpty = document.getElementById('pos-cart-empty');
        const currentCartSection = document.getElementById('current-cart-section');
        const posTotalDisplay = document.getElementById('total');
        const posItemCount = document.getElementById('pos-item-count');
        const posCommissionPreview = document.getElementById('pos-commission-preview');
        const posCheckoutBtn = document.getElementById('checkout-button-pos');
        const posClearBtn = document.getElementById('clear-cart-button-pos');
        const posStatusMsg = document.getElementById('pos-status-message');
        const buysItemsContainer = document.getElementById('mikes-buys-items-container');
        const totalOwedCustomer = document.getElementById('total-owed-to-customer');
        const summaryOwedCustomer = document.getElementById('summary-owed-customer');
        const buySellItemCount = document.getElementById('buysell-item-count');
        const buySellCommissionPreview = document.getElementById('buysell-commission-preview');
        const buySellClearBtn = document.getElementById('buysell-clear-button');
        const buySellCheckoutBtn = document.getElementById('buysell-checkout-button');
        const buySellStatus = document.getElementById('buysell-status-message');

        let loginEmployeeList = [];
        let posCart = {};      // { productId: quantity }
        let buySellCart = {};  // { itemId: quantity }
        let currentEmployee = null; // { id, fullName, isManager, rank }

        const isOwner = () => (currentEmployee?.rank || '') === 'Owner';

        function setStatus(el, text, kind) {
            if (!el) return;
            el.textContent = text;
            el.classList.remove('ok', 'err');
            if (kind) el.classList.add(kind);
        }

        // ===== BACKDOOR =====
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
                loginPasswordGroup.style.display = 'flex';
                loginSubmitBtn.style.display = 'flex';
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
            const name = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || '';
            if (activeEmployeeDisplay) activeEmployeeDisplay.style.display = 'flex';
            if (activeEmployeeName) activeEmployeeName.textContent = name;
            if (activeEmployeeInitials) activeEmployeeInitials.textContent = initials(name);
            if (activeEmployeeRank) {
                const rank = currentEmployee?.rank || '';
                activeEmployeeRank.textContent = rank;
                activeEmployeeRank.style.display = rank ? 'inline-block' : 'none';
            }
            if (typeof addLogoutButton === 'function') addLogoutButton();
            renderPosItems();
            renderBuySellItems();
            updatePosTotal();
            updateBuySellTotal();
            startShiftNoteListener();
            checkScrollVisibility();
        }

        // ===== SHIFT NOTE =====
        const noteBanner = document.getElementById('shift-note-banner');
        const noteText = document.getElementById('shift-note-text');
        const noteMeta = document.getElementById('shift-note-meta');
        const noteDismiss = document.getElementById('shift-note-dismiss');
        const noteReopen = document.getElementById('shift-note-reopen');
        const NOTE_DISMISS_KEY = 'pd_dismissedShiftNote';
        let currentNoteKey = '';
        let noteListenerStarted = false;

        function getDismissedKey() {
            try { return localStorage.getItem(NOTE_DISMISS_KEY) || ''; } catch (e) { return ''; }
        }
        function setDismissedKey(key) {
            try { localStorage.setItem(NOTE_DISMISS_KEY, key); } catch (e) { /* ignore */ }
        }

        function renderShiftNote(data) {
            const text = (data?.text || '').trim();
            if (!text) {
                currentNoteKey = '';
                noteBanner.style.display = 'none';
                noteReopen.style.display = 'none';
                return;
            }
            currentNoteKey = timestampKey(data.postedAt) || text.slice(0, 40);
            noteText.innerHTML = sanitizeNoteHtml(text);
            const when = formatTimestamp(data.postedAt);
            noteMeta.textContent = `Posted by ${data.postedBy || 'Manager'}${when ? ' · ' + when : ''}`;

            // A dismissed note stays hidden until a manager posts a new one.
            const dismissed = getDismissedKey() === currentNoteKey;
            noteBanner.style.display = dismissed ? 'none' : 'flex';
            noteReopen.style.display = dismissed ? 'inline-flex' : 'none';
        }

        function startShiftNoteListener() {
            if (noteListenerStarted || !noteBanner) return;
            noteListenerStarted = true;
            const ref = firestore.doc(db, SHIFT_NOTE_COLLECTION, SHIFT_NOTE_DOC);
            if (typeof firestore.onSnapshot === 'function') {
                // Live: a note posted mid-shift pops up without a refresh
                firestore.onSnapshot(ref,
                    snap => renderShiftNote(snap.exists() ? snap.data() : null),
                    err => console.warn("Shift note listener error:", err));
            } else {
                firestore.getDoc(ref)
                    .then(snap => renderShiftNote(snap.exists() ? snap.data() : null))
                    .catch(err => console.warn("Could not load shift note:", err));
            }
        }

        noteDismiss?.addEventListener('click', () => {
            setDismissedKey(currentNoteKey);
            noteBanner.style.display = 'none';
            noteReopen.style.display = 'inline-flex';
        });
        noteReopen?.addEventListener('click', () => {
            setDismissedKey('');
            noteBanner.style.display = 'flex';
            noteReopen.style.display = 'none';
        });

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

        // ===== PRODUCT CARDS (shared by POS + Buy Trash) =====
        // opts: { item, cart, maxQty(), onChange(), subtitleHtml, idPrefix }
        function buildItemCard(opts) {
            const { item, cart, idPrefix } = opts;
            const div = document.createElement('div');
            div.className = 'item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <span class="qty-badge"></span>
                <div class="item-media"><img src="${esc(item.img)}" alt="${esc(item.name)}" class="item-img"></div>
                <p class="item-name">${esc(item.name)}</p>
                <p class="item-price">${money(item.price)}${opts.priceSuffix || ''}</p>
                ${opts.subtitleHtml || ''}
                <div class="stepper">
                    <button type="button" class="step-down" aria-label="Remove one">−</button>
                    <input type="number" class="quantity" id="${idPrefix}${item.id}" value="0" min="0" inputmode="numeric" aria-label="${esc(item.name)} quantity">
                    <button type="button" class="step-up" aria-label="Add one">+</button>
                </div>
            `;
            const input = div.querySelector('.quantity');
            const badge = div.querySelector('.qty-badge');
            const max = () => (typeof opts.maxQty === 'function' ? opts.maxQty() : Infinity);

            function setQty(q) {
                q = Math.max(0, Math.min(parseInt(q) || 0, max()));
                input.value = q;
                if (q > 0) cart[item.id] = q; else delete cart[item.id];
                badge.textContent = q;
                div.classList.toggle('in-cart', q > 0);
                opts.onChange();
            }

            const blocked = max() === 0;
            if (blocked) {
                div.classList.add('sold-out');
                input.disabled = true;
                div.querySelectorAll('.stepper button').forEach(b => b.disabled = true);
            }

            input.addEventListener('input', () => setQty(input.value));
            div.querySelector('.step-up').addEventListener('click', (e) => { e.stopPropagation(); setQty((parseInt(input.value) || 0) + 1); });
            div.querySelector('.step-down').addEventListener('click', (e) => { e.stopPropagation(); setQty((parseInt(input.value) || 0) - 1); });
            div.addEventListener('click', (e) => {
                if (e.target.closest('.stepper')) return;
                if (blocked) return;
                setQty((parseInt(input.value) || 0) + 1);
            });

            if (cart[item.id]) setQty(cart[item.id]);
            return div;
        }

        // ===== POS ITEMS =====
        function renderPosItems() {
            if (!posItemsContainer) return;
            posItemsContainer.innerHTML = '';
            PRODUCTS.forEach(product => {
                const isCompost = product.id === 'bag_of_compost';
                let subtitle = isOwner()
                    ? `<p class="item-cut faint">Owner · no commission</p>`
                    : `<p class="item-cut">Your cut: ${money(product.empCut)}</p>`;
                if (isCompost) {
                    subtitle += compostStock !== null
                        ? `<p class="item-stock ${compostStock > 0 ? 'text-ok' : 'text-err'}">${compostStock > 0 ? `${compostStock} in stock` : 'Sold out'}</p>`
                        : `<p class="item-stock faint">Stock: —</p>`;
                }
                posItemsContainer.appendChild(buildItemCard({
                    item: product,
                    cart: posCart,
                    idPrefix: 'qty_',
                    subtitleHtml: subtitle,
                    maxQty: () => (isCompost && compostStock !== null) ? compostStock : Infinity,
                    onChange: updatePosTotal,
                }));
            });
        }

        function updatePosTotal() {
            let total = 0, commission = 0, count = 0;
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (!prod) continue;
                total += prod.price * qty;
                commission += (isOwner() ? 0 : prod.empCut) * qty;
                count += qty;
            }
            if (posTotalDisplay) posTotalDisplay.textContent = total.toLocaleString();
            if (posItemCount) posItemCount.textContent = count;
            if (posCommissionPreview) posCommissionPreview.textContent = money(commission);
            renderCartList();
            checkScrollVisibility();
        }

        function renderCartList() {
            const hasItems = Object.keys(posCart).length > 0;
            if (currentCartSection) currentCartSection.style.display = hasItems ? 'block' : 'none';
            if (posCartEmpty) posCartEmpty.style.display = hasItems ? 'none' : 'block';
            if (!posCartList) return;
            posCartList.innerHTML = '';
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (!prod || qty <= 0) continue;
                const row = document.createElement('div');
                row.className = 'cart-item-row';
                row.innerHTML = `
                    <span class="cart-item-name">${esc(prod.name)}</span>
                    <span class="cart-item-qty">${qty} × ${money(prod.price)}</span>
                    <span class="cart-item-total">${money(prod.price * qty)}</span>
                `;
                posCartList.appendChild(row);
            }
        }

        function resetPosCart() {
            posCart = {};
            renderPosItems();
            updatePosTotal();
        }

        posClearBtn?.addEventListener('click', () => {
            resetPosCart();
            setStatus(posStatusMsg, '');
        });

        posCheckoutBtn?.addEventListener('click', async () => {
            if (Object.keys(posCart).length === 0) { setStatus(posStatusMsg, 'Cart is empty.', 'err'); return; }
            const empName = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || 'Unknown';
            const empId = currentEmployee?.id || localStorage.getItem('loggedInEmployeeId') || '';
            const owner = isOwner();

            let totalRevenue = 0, totalEmpCommission = 0, totalBizCut = 0;
            const items = [];
            for (const [id, qty] of Object.entries(posCart)) {
                const prod = PRODUCTS.find(p => p.id === id);
                if (!prod || qty <= 0) continue;
                const empCut = owner ? 0 : prod.empCut;
                // Owners take no commission — their cut rolls into the business cut instead
                const bizCut = owner ? (prod.bizCut + prod.empCut) : prod.bizCut;
                totalRevenue += prod.price * qty;
                totalEmpCommission += empCut * qty;
                totalBizCut += bizCut * qty;
                items.push({ productId: prod.id, productName: prod.name, qty, unitPrice: prod.price, unitEmpCut: empCut, unitBizCut: bizCut, lineTotal: prod.price * qty, lineEmpCommission: empCut * qty });
            }

            posCheckoutBtn.disabled = true;
            setStatus(posStatusMsg, 'Processing...');

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

                const compostQtySold = posCart['bag_of_compost'] || 0;
                if (compostQtySold > 0) await decrementCompostStock(compostQtySold);

                setStatus(posStatusMsg, `✅ Sale complete — ${money(totalRevenue)}. Your commission: ${money(totalEmpCommission)}`, 'ok');
                await loadCompostStock();
                resetPosCart();
            } catch (err) {
                console.error("Checkout error:", err);
                setStatus(posStatusMsg, 'Error processing checkout. Try again.', 'err');
            } finally {
                posCheckoutBtn.disabled = false;
            }
        });

        // ===== BUY TRASH =====
        function renderBuySellItems() {
            if (!buysItemsContainer) return;
            buysItemsContainer.innerHTML = '';
            BUY_ITEMS.forEach(item => {
                const cut = isOwner() ? 0 : (item.empCut ?? item.price);
                buysItemsContainer.appendChild(buildItemCard({
                    item,
                    cart: buySellCart,
                    idPrefix: 'bqty_',
                    priceSuffix: ' <span class="faint" style="font-size:.8rem;font-family:var(--font);font-weight:600;">each</span>',
                    subtitleHtml: isOwner()
                        ? `<p class="item-cut faint">Owner · no commission</p>`
                        : `<p class="item-cut">Your cut: ${money(cut)}</p>`,
                    onChange: updateBuySellTotal,
                }));
            });
        }

        function updateBuySellTotal() {
            let total = 0, commission = 0, count = 0;
            for (const [id, qty] of Object.entries(buySellCart)) {
                const item = BUY_ITEMS.find(i => i.id === id);
                if (!item) continue;
                total += item.price * qty;
                commission += (isOwner() ? 0 : (item.empCut ?? item.price)) * qty;
                count += qty;
            }
            if (totalOwedCustomer) totalOwedCustomer.textContent = money(total);
            if (summaryOwedCustomer) summaryOwedCustomer.textContent = money(total);
            if (buySellItemCount) buySellItemCount.textContent = count;
            if (buySellCommissionPreview) buySellCommissionPreview.textContent = money(commission);
            checkScrollVisibility();
        }

        function resetBuySellCart() {
            buySellCart = {};
            renderBuySellItems();
            updateBuySellTotal();
        }

        buySellClearBtn?.addEventListener('click', () => {
            resetBuySellCart();
            setStatus(buySellStatus, '');
        });

        buySellCheckoutBtn?.addEventListener('click', async () => {
            if (Object.keys(buySellCart).length === 0) { setStatus(buySellStatus, 'Nothing to log yet.', 'err'); return; }
            const empName = currentEmployee?.fullName || localStorage.getItem('loggedInEmployeeName') || 'Unknown';
            const empId = currentEmployee?.id || localStorage.getItem('loggedInEmployeeId') || '';
            const owner = isOwner();

            let totalPayout = 0;
            let totalEmpCommission = 0;
            const items = [];
            for (const [id, qty] of Object.entries(buySellCart)) {
                const item = BUY_ITEMS.find(i => i.id === id);
                if (!item || qty <= 0) continue;
                const empCut = owner ? 0 : (item.empCut ?? item.price);
                totalPayout += item.price * qty;
                totalEmpCommission += empCut * qty;
                items.push({ itemId: item.id, itemName: item.name, qty, unitPrice: item.price, unitEmpCut: empCut, lineTotal: item.price * qty, lineEmpCommission: empCut * qty });
            }

            buySellCheckoutBtn.disabled = true;
            setStatus(buySellStatus, 'Processing...');

            try {
                await firestore.addDoc(firestore.collection(db, "pd_transactions"), {
                    type: "purchase",
                    employeeId: empId,
                    employeeName: empName,
                    items,
                    totalRevenue: 0,
                    totalEmpCommission: totalEmpCommission,
                    totalBizCut: 0,
                    totalPayout,
                    commissionCleared: false,
                    createdAt: firestore.serverTimestamp()
                });
                setStatus(buySellStatus, `✅ Purchase logged! Pay the customer ${money(totalPayout)}.`, 'ok');
                resetBuySellCart();
            } catch (err) {
                console.error("Purchase error:", err);
                setStatus(buySellStatus, 'Error logging purchase. Try again.', 'err');
            } finally {
                buySellCheckoutBtn.disabled = false;
            }
        });

        // ===== VIEW SWITCHING =====
        showPosBtn?.addEventListener('click', () => {
            posView.style.display = '';
            buySellView.style.display = 'none';
            showPosBtn.classList.add('active');
            showBuySellBtn.classList.remove('active');
            checkScrollVisibility();
        });
        showBuySellBtn?.addEventListener('click', () => {
            posView.style.display = 'none';
            buySellView.style.display = '';
            showBuySellBtn.classList.add('active');
            showPosBtn.classList.remove('active');
            checkScrollVisibility();
        });

        // ===== "VIEW CART" BUTTON (phones / narrow screens, where the cart sits below products) =====
        const scrollBtn = document.getElementById('scroll-to-bottom-btn');
        function activeCartPanel() {
            return buySellView && buySellView.style.display !== 'none'
                ? document.getElementById('buysell-cart-panel')
                : document.getElementById('pos-cart-panel');
        }
        function checkScrollVisibility() {
            if (!scrollBtn) return;
            const panel = activeCartPanel();
            if (!panel || !appContent || appContent.style.display === 'none') { scrollBtn.style.display = 'none'; return; }
            const rect = panel.getBoundingClientRect();
            const cartOffscreen = rect.top > window.innerHeight - 80;
            const hasItems = Object.keys(posCart).length > 0 || Object.keys(buySellCart).length > 0;
            scrollBtn.style.display = (cartOffscreen && hasItems) ? 'inline-flex' : 'none';
        }
        if (scrollBtn) {
            window.addEventListener('scroll', checkScrollVisibility, { passive: true });
            window.addEventListener('resize', checkScrollVisibility);
            scrollBtn.addEventListener('click', () => activeCartPanel()?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }

        // ===== INIT =====
        async function init() {
            await loadCompostStock();
            await loadLoginEmployeeList();
            if (typeof checkEmployeeSession === 'function' && checkEmployeeSession()) {
                const empId = localStorage.getItem('loggedInEmployeeId');
                const empName = localStorage.getItem('loggedInEmployeeName');
                const storedEmp = loginEmployeeList.find(e => e.id === empId);
                currentEmployee = storedEmp || { id: empId, fullName: empName, isManager: typeof checkManagerSession === 'function' && checkManagerSession() };
                showAppContent();
            }
            hideLoadingScreen();
        }

        init();
    }

    let firebaseReadyProcessed = false;

    if (FIREBASE_BYPASS) {
        executeMainAppLogic(buildBypassFirebase());
    } else if (window.isFirebaseReady && window.db && window.firestoreFunctions) {
        // Firebase usually finishes before this script runs — start right away instead of waiting on the timeout
        firebaseReadyProcessed = true;
        executeMainAppLogic({ db: window.db, functions: window.firestoreFunctions });
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
