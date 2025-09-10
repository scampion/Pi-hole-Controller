document.addEventListener('DOMContentLoaded', () => {
    // --- Login Elements ---
    const loginContainer = document.getElementById('login-container');
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password-input');
    const loginError = document.getElementById('login-error');

    // --- Main App Elements ---
    const mainContainer = document.getElementById('main-container');
    const logoutBtn = document.getElementById('logout-btn');
    const loadingDiv = document.getElementById('loading');
    const controlsDiv = document.getElementById('controls');
    const tagsContainer = document.getElementById('tags-container');
    const durationsContainer = document.getElementById('durations-container');
    const unblockBtn = document.getElementById('unblock-btn');
    const statusMessage = document.getElementById('status-message');

    let selectedDomainIds = null;
    let selectedDuration = null;

    // --- Login/Logout Logic ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Login failed.');
            }
            showMainApp();
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            // Always show login screen after logout attempt
            showLogin();
        }
    });

    function showLogin() {
        mainContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        passwordInput.value = ''; // Clear password field
    }

    function showMainApp() {
        loginContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        fetchDomains();
    }

    // --- Main App Logic ---
    async function fetchDomains() {
        // Reset UI state before fetching
        controlsDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        loadingDiv.textContent = 'Loading domains...';
        loadingDiv.style.color = '';

        try {
            const response = await fetch('/api/domains');
            if (response.status === 401) {
                showLogin();
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch domains.');
            }
            const data = await response.json();
            
            const taggedDomains = data.domains.filter(d => d.comment && d.comment.includes('#'));
            
            if (taggedDomains.length === 0) {
                loadingDiv.textContent = 'No domains with #tags found in their comment.';
                return;
            }

            displayTags(taggedDomains);
            loadingDiv.classList.add('hidden');
            controlsDiv.classList.remove('hidden');

        } catch (error) {
            loadingDiv.textContent = `Error: ${error.message}`;
            loadingDiv.style.color = 'red';
        }
    }

    function displayTags(domains) {
        tagsContainer.innerHTML = '';
        const uniqueTags = {};
        domains.forEach(domain => {
            const tags = domain.comment.match(/#\w+/g);
            if (tags) {
                tags.forEach(tag => {
                    if (!uniqueTags[tag]) uniqueTags[tag] = [];
                    uniqueTags[tag].push(domain.id);
                });
            }
        });
        for (const tag in uniqueTags) {
            const btn = document.createElement('button');
            btn.className = 'tag-btn';
            btn.textContent = tag;
            btn.dataset.domainIds = JSON.stringify(uniqueTags[tag]);
            btn.addEventListener('click', () => selectTag(btn));
            tagsContainer.appendChild(btn);
        }
    }

    function selectTag(selectedBtn) {
        document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('selected'));
        selectedBtn.classList.add('selected');
        selectedDomainIds = selectedBtn.dataset.domainIds;
        checkSelections();
    }

    durationsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('duration-btn')) {
            document.querySelectorAll('.duration-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedDuration = e.target.dataset.duration;
            checkSelections();
        }
    });

    function checkSelections() {
        unblockBtn.disabled = !(selectedDomainIds && selectedDuration);
    }

    unblockBtn.addEventListener('click', async () => {
        if (!selectedDomainIds || !selectedDuration) return;

        unblockBtn.disabled = true;
        unblockBtn.textContent = 'Unblocking...';
        statusMessage.textContent = '';

        const domainIdsToDisable = JSON.parse(selectedDomainIds);
        const promises = domainIdsToDisable.map(domainId =>
            fetch('/api/disable-domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domainId, duration: selectedDuration })
            }).then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err)))
        );

        try {
            await Promise.all(promises);
            const selectedTag = document.querySelector('.tag-btn.selected').textContent;
            statusMessage.textContent = `Successfully unblocked ${selectedTag} for ${selectedDuration} minutes.`;
            statusMessage.style.color = 'green';
        } catch (error) {
            if (error.error && error.error.includes("Authentication required")) {
                showLogin();
            } else {
                statusMessage.textContent = `Error: ${error.error || 'An unknown error occurred.'}`;
                statusMessage.style.color = 'red';
            }
        } finally {
            setTimeout(() => {
                unblockBtn.textContent = 'Unblock';
                checkSelections();
                statusMessage.textContent = '';
                document.querySelectorAll('.tag-btn, .duration-btn').forEach(btn => btn.classList.remove('selected'));
                selectedDomainIds = null;
                selectedDuration = null;
            }, 5000);
        }
    });

    // --- Initial Check ---
    async function checkInitialAuth() {
        try {
            const response = await fetch('/api/check-auth');
            if (response.ok) {
                showMainApp();
            } else {
                showLogin();
            }
        } catch (error) {
            showLogin();
        }
    }

    checkInitialAuth();
});