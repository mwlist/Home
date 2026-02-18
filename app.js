// --- Side Menu Responsive Logic ---
window.addEventListener('DOMContentLoaded', () => {
    // Fetch all movie lists immediately on DOMContentLoaded
    fetchAllMovieLists();
    // Move 'All' tab to Home dropdown as a submenu
    const homeDropdown = document.getElementById('homeDropdown');
    if (homeDropdown && !document.getElementById('homeAllSubBtn')) {
        const allSubBtn = document.createElement('button');
        allSubBtn.className = 'home-dropdown-btn';
        allSubBtn.id = 'homeAllSubBtn';
        allSubBtn.setAttribute('data-home', 'all');
        allSubBtn.textContent = 'All';
        // Insert as first item in the Home dropdown
        homeDropdown.insertBefore(allSubBtn, homeDropdown.firstChild);
        allSubBtn.addEventListener('click', function() {
            document.querySelectorAll('.home-dropdown-btn').forEach(tb => tb.classList.remove('active'));
            allSubBtn.classList.add('active');
            currentTab = 'home';
            currentHome = 'all';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            renderMoviesForTab('home');
        });
    }

    // Automatically load the 'New' tab on website open
    currentTab = 'home';
    currentHome = 'new';
    // Set the New tab as active visually
    document.querySelectorAll('.tab-btn').forEach(tb => {
        tb.classList.toggle('active', tb.getAttribute('data-tab') === 'home');
    });
    document.querySelectorAll('.home-dropdown-btn').forEach(tb => {
        tb.classList.toggle('active', tb.getAttribute('data-home') === 'new');
    });
    renderMoviesForTab('home');
                // Move search input into mobile container on small screens
                function moveSearchInputMobile() {
                    var searchInput = document.getElementById('searchInput');
                    var mobileContainer = document.getElementById('searchMobileContainer');
                    if (window.innerWidth <= 720 && searchInput && mobileContainer && !mobileContainer.contains(searchInput)) {
                        mobileContainer.appendChild(searchInput);
                    } else if (window.innerWidth > 720 && searchInput && searchInput.parentElement === mobileContainer) {
                        // Move back to original parent (title bar)
                        var titleBar = document.querySelector('.title-bar');
                        if (titleBar) {
                            titleBar.appendChild(searchInput);
                        }
                    }
                }
                window.addEventListener('resize', moveSearchInputMobile);
                moveSearchInputMobile();
            // Helper to fetch missing runtime/episode info from TMDB for watched items
            async function fetchMissingRuntimesForProfile(items) {
                let updated = false;
                for (let m of items) {
                    // Only fetch if missing runtime info
                    if (m.media_type === 'tv') {
                        let needs = !m.episode_run_time && !m.runtime;
                        if (needs && m.id && typeof m.id === 'number') {
                            try {
                                const resp = await fetch(`${TMDB_BASE_URL}/tv/${m.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                                if (resp.ok) {
                                    const data = await resp.json();
                                    if (Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0) m.episode_run_time = data.episode_run_time;
                                    if (typeof data.runtime === 'number') m.runtime = data.runtime;
                                    if (typeof data.number_of_episodes === 'number') m.number_of_episodes = data.number_of_episodes;
                                    if (Array.isArray(data.seasons)) m.seasons = data.seasons;
                                    updated = true;
                                }
                            } catch {}
                        }
                    } else {
                        let needs = typeof m.runtime !== 'number' && typeof m.duration !== 'number' && typeof m.length !== 'number';
                        if (needs && m.id && typeof m.id === 'number') {
                            try {
                                const resp = await fetch(`${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                                if (resp.ok) {
                                    const data = await resp.json();
                                    if (typeof data.runtime === 'number') m.runtime = data.runtime;
                                    updated = true;
                                }
                            } catch {}
                        }
                    }
                }
                return updated;
            }
        // --- Profile Stats Update ---
        function getProfileStatsHtml() {
            // Accurate stats calculation (copied from renderWatchedSummary)
            let movies = watched;
            let total = movies.length;
            let totalMovies = movies.filter(m => m.media_type !== 'tv').length;
            let totalShows = movies.filter(m => m.media_type === 'tv').length;
            let totalMinutes = 0;
            let totalWatchlist = Array.isArray(watchlist) ? watchlist.length : 0;

            let fallbackItems = [];
            movies.forEach(m => {
                if (m.media_type === 'tv') {
                    let epTimes = [];
                    if (Array.isArray(m.episode_run_time) && m.episode_run_time.length > 0) {
                        epTimes = epTimes.concat(m.episode_run_time.filter(x => typeof x === 'number' && x > 0));
                    } else if (typeof m.episode_run_time === 'number' && m.episode_run_time > 0) {
                        epTimes.push(m.episode_run_time);
                    }
                    if (Array.isArray(m.seasons)) {
                        m.seasons.forEach(season => {
                            if (Array.isArray(season.episode_run_time) && season.episode_run_time.length > 0) {
                                epTimes = epTimes.concat(season.episode_run_time.filter(x => typeof x === 'number' && x > 0));
                            } else if (typeof season.episode_run_time === 'number' && season.episode_run_time > 0) {
                                epTimes.push(season.episode_run_time);
                            }
                        });
                    }
                    let epTime = 0;
                    if (epTimes.length > 0) {
                        epTime = Math.round(epTimes.reduce((a, b) => a + b, 0) / epTimes.length);
                    } else if (typeof m.runtime === 'number' && m.runtime > 0) {
                        epTime = m.runtime;
                    } else {
                        epTime = 45;
                        fallbackItems.push({title: m.title || m.name || 'Unknown TV Show', reason: 'No episode runtime'});
                    }
                    let numEps = 0;
                    if (Array.isArray(m.seasons) && m.seasons.length > 0) {
                        numEps = m.seasons.reduce((sum, s) => sum + (s.episode_count || 0), 0);
                    }
                    if (!numEps && typeof m.number_of_episodes === 'number') {
                        numEps = m.number_of_episodes;
                    } else if (!numEps && typeof m.episodes === 'number') {
                        numEps = m.episodes;
                    } else if (!numEps && typeof m.total_episodes === 'number') {
                        numEps = m.total_episodes;
                    }
                    if (numEps > 0 && (!epTime || epTime <= 0)) {
                        epTime = 45;
                        fallbackItems.push({title: m.title || m.name || 'Unknown TV Show', reason: 'No episode runtime'});
                    }
                    if (!numEps && epTime > 0) {
                        numEps = 1;
                        fallbackItems.push({title: m.title || m.name || 'Unknown TV Show', reason: 'No episode count'});
                    }
                    if (!numEps) {
                        numEps = 1;
                        fallbackItems.push({title: m.title || m.name || 'Unknown TV Show', reason: 'No episode count'});
                    }
                    if (!epTime || epTime <= 0) {
                        epTime = 45;
                        fallbackItems.push({title: m.title || m.name || 'Unknown TV Show', reason: 'No episode runtime'});
                    }
                    totalMinutes += epTime * numEps;
                } else {
                    if (typeof m.runtime === 'number') {
                        totalMinutes += m.runtime;
                    } else if (typeof m.duration === 'number') {
                        totalMinutes += m.duration;
                    } else if (typeof m.length === 'number') {
                        totalMinutes += m.length;
                    } else {
                        // Use a visible default and mark it clearly
                        totalMinutes += 100;
                        fallbackItems.push({title: m.title || m.name || 'Unknown Movie', reason: 'No runtime (default 100m used)'});
                    }
                }
            });
            let hours = Math.floor(totalMinutes / 60);
            let mins = totalMinutes % 60;
            let timeStr = totalMinutes > 0 ? `${hours}h ${mins}m` : 'N/A';
            let tooltip = '';
            let warningHtml = '';
            if (fallbackItems.length > 0) {
                tooltip = 'Some items used fallback values:\n' + fallbackItems.map(f => `${f.title}: ${f.reason}`).join('\n');
                warningHtml = `<div style='color:#ff4444;font-size:13px;margin-top:4px;'>⚠ Some runtimes are estimated. <span title="${tooltip}">(details)</span></div>`;
                console.warn('Fallbacks used for runtime:', fallbackItems);
            }
            return `
                <div><strong>${totalMovies}</strong> Movies Watched</div>
                <div><strong>${totalShows}</strong> Shows Watched</div>
                <div><strong title="${tooltip}">${timeStr}</strong> Runtime</div>
                <div><strong>${totalWatchlist}</strong> listed</div>
                ${warningHtml}
            `;
        }

        function updateProfileStats() {
            const statsDiv = document.getElementById('profileStats');
            if (statsDiv) {
                // Debug: log watched array
                console.log('Profile watched array:', watched);
                fetchMissingRuntimesForProfile(watched).then(() => {
                    statsDiv.innerHTML = getProfileStatsHtml();
                    console.log('Profile stats updated:', getProfileStatsHtml());
                });
            }
        }

        // Ensure stats update when watched changes
        function watchedChanged() {
            updateProfileStats();
        }

    // Profile Popup Logic
    const signInBtn = document.getElementById('signInBtn');
    const profilePicBtn = document.getElementById('profilePicBtn');
    const profilePopup = document.getElementById('profilePopup');
    const closeProfilePopup = document.getElementById('closeProfilePopup');

    // Simulate sign-in state (replace with real auth logic)


    function updateProfileUI() {
        // Only use googleUser for sign-in state
        let user = window.googleUser;
        if (!user) {
            try {
                const saved = localStorage.getItem('googleUser');
                if (saved) user = JSON.parse(saved);
            } catch {}
        }
        let signedIn = false;
        let photo = '';
        let name = '';
        let email = '';
        if (user && user.profile) {
            signedIn = true;
            photo = user.profile.picture || '';
            name = user.profile.name || '';
            email = user.profile.email || '';
        }
        if (signedIn) {
            signInBtn.style.display = 'none';
            profilePicBtn.style.display = 'inline-block';
            profilePicBtn.src = photo;
            // Update profile popup layout
            const profileAvatar = document.querySelector('#profilePopup .profile-avatar');
            const profileName = document.querySelector('#profilePopup .profile-name');
            const profileEmail = document.querySelector('#profilePopup .profile-email');
            if (profileAvatar) profileAvatar.src = photo;
            if (profileName) profileName.textContent = name;
            if (profileEmail) profileEmail.textContent = email;
            updateProfileStats();
        } else {
            signInBtn.style.display = '';
            profilePicBtn.style.display = 'none';
            // Reset profile popup to default
            const profileAvatar = document.querySelector('#profilePopup .profile-avatar');
            const profileName = document.querySelector('#profilePopup .profile-name');
            const profileEmail = document.querySelector('#profilePopup .profile-email');
            if (profileAvatar) profileAvatar.src = 'https://ui-avatars.com/api/?name=User';
            if (profileName) profileName.textContent = 'User Name';
            if (profileEmail) profileEmail.textContent = 'user@email.com';
        }
    }

    // Open profile popup from either button
    function openProfilePopup() {
        if (!profilePopup) return;
        // Always update profile popup with latest user info before showing
        if (typeof updateProfileUI === 'function') updateProfileUI();
        // Position below the right side of the button/pic
        let anchor = profilePicBtn && profilePicBtn.style.display !== 'none' ? profilePicBtn : signInBtn;
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            profilePopup.style.top = (rect.bottom + scrollTop + 8) + 'px';
            profilePopup.style.left = '';
            profilePopup.style.right = (window.innerWidth - rect.right - scrollLeft) + 'px';
        }
        profilePopup.classList.add('open');
    }
    // Only allow profile popup to open from profilePicBtn (not signInBtn)
    if (profilePicBtn) {
        profilePicBtn.addEventListener('click', openProfilePopup);
    }
    if (closeProfilePopup && profilePopup) {
        closeProfilePopup.addEventListener('click', function() {
            profilePopup.classList.remove('open');
        });
    }
    // Close dropdown when clicking outside
    document.addEventListener('mousedown', function(e) {
        if (profilePopup && profilePopup.classList.contains('open')) {
            if (!profilePopup.contains(e.target) && e.target !== signInBtn && e.target !== profilePicBtn) {
                profilePopup.classList.remove('open');
            }
        }
    });

    // Simulate sign in/out for demo (replace with real auth logic)
    if (profilePopup) {
        const signOutBtn = profilePopup.querySelector('.profile-action-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', function() {
                // Remove googleUser and update UI
                localStorage.removeItem('googleUser');
                window.googleUser = null;
                updateSignInUI();
                profilePopup.classList.remove('open');
            });
        }
    }

    // Patch watched list mutations to update profile stats
    const origPush = watched.push;
    watched.push = function(...args) {
        const result = origPush.apply(this, args);
        watchedChanged();
        return result;
    };
    // Also patch watched.splice for removals
    const origSplice = watched.splice;
    watched.splice = function(...args) {
        const result = origSplice.apply(this, args);
        watchedChanged();
        return result;
    };
    // For demo: sign in when clicking sign in button (replace with real logic)
    if (signInBtn) {
        signInBtn.addEventListener('click', function() {
            isSignedIn = true;
            updateProfileUI();
        });
    }
    updateProfileUI();
    // Filter type dropdown
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', function() {
            renderMoviesForTab(currentTab);
        });
    }
        // Mobile search icon toggle
        const searchInput = document.getElementById('searchInput');
        const searchIconBtn = document.getElementById('searchIconBtn');
        const appTitle = document.querySelector('.title-bar .app-title');
        function handleMobileSearchToggle() {
            if (!searchInput) return;
            const isOpen = searchInput.classList.toggle('mobile-visible');
            if (appTitle) {
                if (isOpen) {
                    appTitle.classList.add('hide-mobile-title');
                } else {
                    appTitle.classList.remove('hide-mobile-title');
                }
            }
            if (searchIconBtn) {
                if (isOpen) {
                    searchIconBtn.classList.add('close-icon');
                } else {
                    searchIconBtn.classList.remove('close-icon');
                }
            }
            if (isOpen) {
                searchInput.focus();
            } else {
                searchInput.blur();
                searchInput.value = '';
                // Reload the current tab (or Home/New if on Home)
                if (currentTab === 'home') {
                    currentHome = 'new';
                    renderMoviesForTab('home');
                } else {
                    renderMoviesForTab(currentTab);
                }
            }
        }
        if (searchIconBtn) {
            searchIconBtn.addEventListener('click', handleMobileSearchToggle);
        }
        // Hide search input when clicking outside (mobile)
        document.addEventListener('click', function(e) {
            if (window.innerWidth > 720) return;
            if (searchInput && searchInput.classList.contains('mobile-visible')) {
                if (!searchInput.contains(e.target) && !searchIconBtn.contains(e.target)) {
                    searchInput.classList.remove('mobile-visible');
                    if (appTitle) appTitle.classList.remove('hide-mobile-title');
                    if (searchIconBtn) searchIconBtn.classList.remove('close-icon');
                    searchInput.value = '';
                    // Reload the current tab (or Home/New if on Home)
                    if (currentTab === 'home') {
                        currentHome = 'new';
                        renderMoviesForTab('home');
                    } else {
                        renderMoviesForTab(currentTab);
                    }
                }
            }
        });
        // Hide search input on resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 720 && searchInput) {
                searchInput.classList.remove('mobile-visible');
                if (appTitle) appTitle.classList.remove('hide-mobile-title');
                if (searchIconBtn) searchIconBtn.classList.remove('close-icon');
            }
        });
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const closeSideMenu = document.getElementById('closeSideMenu');
    if (closeSideMenu && sideMenu) {
        closeSideMenu.addEventListener('click', () => {
            sideMenu.classList.remove('open');
        });
    }
    const sideMenuBtns = document.querySelectorAll('.side-menu-btn');
    const sideMenuHomeBtn = document.getElementById('sideMenuHomeBtn');
    const sideMenuHomeGroup = document.querySelector('.side-menu-home-group');
    const sideMenuHomeSublist = document.getElementById('sideMenuHomeSublist');
    const sideMenuHomeSubBtns = document.querySelectorAll('.side-menu-home-subbtn');
    const sideMenuSearch = document.getElementById('sideMenuSearch');
    const sideMenuSignIn = document.getElementById('sideMenuSignIn');
    const sideMenuProfile = document.getElementById('sideMenuProfile');
    if (hamburgerBtn && sideMenu) {
        hamburgerBtn.addEventListener('click', () => {
            // Close details page if open
            const detailPage = document.getElementById('detailPage');
            const moviesGrid = document.getElementById('moviesGrid');
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            if (detailPage && detailPage.style.display !== 'none') {
                detailPage.style.display = 'none';
                if (moviesGrid) moviesGrid.style.display = '';
                if (loadingDiv) loadingDiv.style.display = '';
                if (errorDiv) errorDiv.style.display = '';
            }
            sideMenu.classList.add('open');
        });
    }
    // Tab navigation
    sideMenuBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            // Clear search box
            var searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            document.querySelectorAll('.side-menu-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Home tab: toggle sublist
            if (btn.getAttribute('data-tab') === 'home') {
                e.preventDefault();
                if (sideMenuHomeGroup) sideMenuHomeGroup.classList.toggle('open');
                return;
            } else {
                if (sideMenuHomeGroup) sideMenuHomeGroup.classList.remove('open');
            }
            // Always close detail page if open
            const detailPage = document.getElementById('detailPage');
            const moviesGrid = document.getElementById('moviesGrid');
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            if (detailPage && detailPage.style.display !== 'none') {
                detailPage.style.display = 'none';
                if (moviesGrid) moviesGrid.style.display = '';
                if (loadingDiv) loadingDiv.style.display = '';
                if (errorDiv) errorDiv.style.display = '';
            }
            // Simulate tab click
            const tab = btn.getAttribute('data-tab');
            if (tab) {
                document.querySelectorAll('.tab-btn').forEach(tb => {
                    if (tb.getAttribute('data-tab') === tab) tb.click();
                });
            }
            sideMenu.classList.remove('open');
        });
    });
    // Home sublist navigation
    sideMenuHomeSubBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            document.querySelectorAll('.side-menu-home-subbtn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Simulate dropdown click
            const home = btn.getAttribute('data-home');
            if (home) {
                document.querySelectorAll('.home-dropdown-btn').forEach(tb => {
                    if (tb.getAttribute('data-home') === home) tb.click();
                });
            }
            sideMenu.classList.remove('open');
        });
    });
    // Search
    if (sideMenuSearch) {
        sideMenuSearch.addEventListener('input', function() {
            document.getElementById('searchInput').value = sideMenuSearch.value;
            const event = new Event('input', { bubbles: true });
            document.getElementById('searchInput').dispatchEvent(event);
        });
    }
    // Sign in
    if (sideMenuSignIn) {
        sideMenuSignIn.addEventListener('click', function() {
            document.getElementById('signInBtn').click();
            sideMenu.classList.remove('open');
        });
    }

    // Profile rendering
    function renderSideMenuProfile() {
        if (!sideMenuProfile) return;
        let html = '';
        // Try to get latest googleUser from localStorage if not present
        let user = window.googleUser;
        if (!user) {
            try {
                const saved = localStorage.getItem('googleUser');
                if (saved) user = JSON.parse(saved);
            } catch {}
        }
        if (user && user.profile) {
            const p = user.profile;
            html = `<img class="profile-avatar" src="${p.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.name || 'User') + '&background=222c3a&color=00c4ff'}" alt="Profile">
                <div class="profile-name">${p.name || ''}</div>
                <div class="profile-email">${p.email || ''}</div>`;
        } else {
            html = `<img class="profile-avatar" src="https://ui-avatars.com/api/?name=Guest&background=222c3a&color=00c4ff" alt="Profile">
                <div class="profile-name">Guest</div>
                <div class="profile-email">Not signed in</div>`;
        }
        sideMenuProfile.innerHTML = html;
    }
    renderSideMenuProfile();
    window.renderSideMenuProfile = renderSideMenuProfile;
});
// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyD924WfruL_1bN0CrkygeeqvTMgXg2sp7c",
  authDomain: "mywatch-list.firebaseapp.com",
  databaseURL: "https://mywatch-list-default-rtdb.firebaseio.com",
  projectId: "mywatch-list",
  storageBucket: "mywatch-list.firebasestorage.app",
  messagingSenderId: "544292504115",
  appId: "1:544292504115:web:7dda18e23237d10aa85946",
  measurementId: "G-483NF80D60"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function getUserDbPath() {
    if (!googleUser || !googleUser.profile || !googleUser.profile.id) return null;
    return `users/${googleUser.profile.id}`;
}

async function saveUserLists() {
    // Always update localStorage for offline/guest mode
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    localStorage.setItem('watched', JSON.stringify(watched));
    const path = getUserDbPath();
    if (!path) return;
    await db.ref(path).set({
        watchlist,
        watched
    });
}

async function loadUserLists() {
    const path = getUserDbPath();
    if (!path) return;
    const snap = await db.ref(path).get();
    if (snap.exists()) {
        const data = snap.val();
        watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];
        watched = Array.isArray(data.watched) ? data.watched : [];
        // Always update localStorage for offline/guest mode
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        localStorage.setItem('watched', JSON.stringify(watched));
        // Update profile stats after loading
        if (typeof updateProfileStats === 'function') updateProfileStats();
    }
}
// TMDB API key from save.py

// --- Google Sign-In ---
const GOOGLE_CLIENT_ID = "544292504115-tuebk6rkerrt8pbt0vtrhbrht3u72dh4.apps.googleusercontent.com";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_REDIRECT_URI = window.location.origin + window.location.pathname;
let googleUser = null;

function openGoogleSignIn() {
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: "token",
        scope: "profile email",
        include_granted_scopes: "true",
        state: "signin",
        prompt: "select_account"
    });
    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    // Open popup
    const w = 480, h = 600;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const popup = window.open(authUrl, "GoogleSignIn", `width=${w},height=${h},left=${left},top=${top}`);
    // Listen for token in URL hash
    window.addEventListener("message", function handler(e) {
        if (e.data && e.data.type === "google-auth" && e.data.token) {
            googleUser = e.data;
            updateSignInUI();
            window.removeEventListener("message", handler);
        }
    });
}

function updateSignInUI() {
    const btn = document.getElementById("signInBtn");
        if (googleUser && googleUser.profile) {
            // Hide the sign in button entirely when signed in
            btn.style.display = 'none';
            // Save to localStorage
            localStorage.setItem('googleUser', JSON.stringify(googleUser));
            // Save user profile (name, email) to Firebase
            try {
                const userId = googleUser.profile.id;
                const name = googleUser.profile.name || '';
                const email = googleUser.profile.email || '';
                if (userId && name && email && typeof firebase !== 'undefined') {
                    firebase.database().ref('users/' + userId + '/profile').set({ name, email });
                }
            } catch (e) { console.warn('Failed to save user profile to database', e); }
            // Load user lists from Firebase
            loadUserLists();
            // Show profile picture in title bar
            const profilePicBtn = document.getElementById('profilePicBtn');
            if (profilePicBtn) {
                profilePicBtn.style.display = 'inline-block';
                profilePicBtn.src = googleUser.profile.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(googleUser.profile.name || 'User');
            }
            // Update profile popup layout with user info
            if (typeof updateProfileUI === 'function') updateProfileUI();
        } else {
            btn.textContent = "Sign In";
            btn.disabled = false;
            btn.style.background = "";
            btn.style.color = "";
            btn.style.display = '';
            // Hide profile picture in title bar
            const profilePicBtn = document.getElementById('profilePicBtn');
            if (profilePicBtn) {
                profilePicBtn.style.display = 'none';
            }
            // Remove from localStorage
            localStorage.removeItem('googleUser');
            // Reset profile popup layout
            if (typeof updateProfileUI === 'function') updateProfileUI();
        }
        // Update side menu profile
        if (window.renderSideMenuProfile) window.renderSideMenuProfile();
        // Highlight active subitem on load
        function highlightActiveHomeSubBtn() {
            const current = document.querySelector('.home-dropdown-btn.active');
            if (current) {
                const val = current.getAttribute('data-home');
                document.querySelectorAll('.side-menu-home-subbtn').forEach(btn => {
                    if (btn.getAttribute('data-home') === val) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
        }
        highlightActiveHomeSubBtn();
        // Also update highlight on dropdown change
        document.querySelectorAll('.home-dropdown-btn').forEach(btn => {
            btn.addEventListener('click', highlightActiveHomeSubBtn);
        });
}

// Handle OAuth redirect (popup flow)
window.addEventListener("load", () => {
    if (window.location.hash && window.location.hash.includes("access_token")) {
        const hash = Object.fromEntries(new URLSearchParams(window.location.hash.substring(1)));
        if (hash.access_token) {
            // Fetch user info
            fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${hash.access_token}` }
            })
            .then(r => r.json())
            .then(profile => {
                // If this is a popup, send token to opener and close
                if (window.opener && window.opener !== window) {
                    window.opener.postMessage({ type: "google-auth", token: hash.access_token, profile }, "*");
                    window.close();
                } else {
                    // If not a popup, update UI directly
                    googleUser = { token: hash.access_token, profile };
                    updateSignInUI();
                }
            });
        }
        // Remove token from URL
        history.replaceState(null, '', window.location.pathname);
    }
});

// Attach to button and restore sign-in state
window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("signInBtn");
    if (btn) {
        btn.addEventListener("click", openGoogleSignIn);
    }
    // Restore sign-in state from localStorage
    const saved = localStorage.getItem('googleUser');
    if (saved) {
        try {
            googleUser = JSON.parse(saved);
            updateSignInUI();
        } catch {}
    } else {
        updateSignInUI();
    }
});
const TMDB_API_KEY = "c17ff2e8519a9bdab2857aaa17325ea0";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const moviesGrid = document.getElementById('moviesGrid');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const searchInput = document.getElementById('searchInput');
const tabs = document.getElementById('mainTabs');
const homeDropdown = document.getElementById('homeDropdown');
const homeTabBtn = document.getElementById('homeTabBtn');

let nowPlayingMovies = [];
let allMovies = [];
let trendingMovies = [];
let popularMovies = [];
let upcomingMovies = [];
let watchlist = [];
let watched = [];
let currentTab = 'home';
let currentHome = 'now_playing';
let homeDropdownOpen = false;

function createMovieCard(movie, tab) {
    const card = document.createElement('div');
    card.className = 'movie-card';

    const posterWrapper = document.createElement('div');
    posterWrapper.className = 'poster-wrapper';

    // Add 'Watched' hint if the movie/show is in the watched list
    const isWatched = watched.some(m => m.id === movie.id) || watched.some(m => (m.title || m.name || '').toLowerCase().trim() === (movie.title || movie.name || '').toLowerCase().trim());
    if (isWatched) {
        const watchedBadge = document.createElement('div');
        watchedBadge.className = 'watched-badge-overlay';
        watchedBadge.textContent = 'Watched';
        watchedBadge.style.position = 'absolute';
        watchedBadge.style.top = '12px';
        watchedBadge.style.right = '12px';
        watchedBadge.style.background = 'linear-gradient(90deg, #00e6b2 60%, #00c4ff 100%)';
        watchedBadge.style.color = '#fff';
        watchedBadge.style.fontWeight = 'bold';
        watchedBadge.style.fontSize = '0.98rem';
        watchedBadge.style.padding = '4px 14px';
        watchedBadge.style.borderRadius = '8px';
        watchedBadge.style.boxShadow = '0 2px 8px rgba(0,196,255,0.13)';
        watchedBadge.style.zIndex = '6';
        watchedBadge.style.letterSpacing = '0.04em';
        watchedBadge.style.pointerEvents = 'none';
        posterWrapper.appendChild(watchedBadge);
    }
    const poster = document.createElement('img');
    poster.className = 'movie-poster';
    poster.src = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : 'https://via.placeholder.com/300x450/222c3a/ffffff?text=No+Image';
    poster.alt = movie.title || movie.name;
    posterWrapper.appendChild(poster);
    // Add rating badge overlay
    if (typeof movie.vote_average === 'number' && movie.vote_average > 0) {
        const badge = document.createElement('div');
        badge.className = 'rating-badge';
        badge.textContent = movie.vote_average.toFixed(1);
        posterWrapper.appendChild(badge);
    }
    card.appendChild(posterWrapper);

    const title = document.createElement('div');
    title.className = 'movie-title';
    title.textContent = movie.title || movie.name;
    card.appendChild(title);

    const date = document.createElement('div');
    date.className = 'movie-date';
    // Format date as '1 Jan 2025'
    let rawDate = movie.release_date || movie.first_air_date || '';
    let formattedDate = '';
    if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d)) {
            const day = d.getDate();
            const month = d.toLocaleString('en-US', { month: 'short' });
            const year = d.getFullYear();
            formattedDate = `${day} ${month} ${year}`;
        } else {
            formattedDate = rawDate;
        }
    }
    date.textContent = formattedDate;

    card.appendChild(date);

    // Add category display (movie or show) below date
    const category = document.createElement('div');
    category.className = 'movie-category-overlay';
    let typeLabel = '';
    if (movie.type) {
        typeLabel = (movie.type === 'tv' || movie.type === 'series') ? 'Show' : 'Movie';
    } else if (movie.media_type) {
        typeLabel = (movie.media_type === 'tv' || movie.media_type === 'series') ? 'Show' : 'Movie';
    } else if (typeof movie.first_air_date === 'string' && movie.first_air_date) {
        typeLabel = 'Show';
    } else {
        typeLabel = 'Movie';
    }
    category.textContent = typeLabel;
    category.style.marginBottom = '4px';
    card.appendChild(category);

    // Add runtime/season info to bottom of poster
    const runtimeDiv = document.createElement('div');
    runtimeDiv.className = 'movie-runtime';
    let runtimeText = '';
    if (movie.media_type === 'tv' || movie.type === 'tv' || (typeof movie.first_air_date === 'string' && movie.first_air_date)) {
        // If this is a season card, display the specific season number
        if (movie._seasonCard && movie.season_number) {
            runtimeText = `Season ${movie.season_number}`;
        } else if (typeof movie.number_of_seasons === 'number' && movie.number_of_seasons > 0) {
            runtimeText = `${movie.number_of_seasons} Season${movie.number_of_seasons > 1 ? 's' : ''}`;
        }
        // Show average episode runtime as h:m if available
        let epTime = 0;
        if (Array.isArray(movie.episode_run_time) && movie.episode_run_time.length > 0) {
            epTime = Math.round(movie.episode_run_time.reduce((a, b) => a + b, 0) / movie.episode_run_time.length);
        } else if (typeof movie.episode_run_time === 'number') {
            epTime = movie.episode_run_time;
        }
        if (epTime > 0) {
            const h = Math.floor(epTime / 60);
            const m = epTime % 60;
            let epStr = h > 0 ? `${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${m}m`;
            runtimeText += (runtimeText ? ', ' : '') + `${epStr}/ep`;
        }
    } else {
        // Movie: show runtime as h:m if available
        let min = movie.runtime || movie.duration || movie.length;
        if (typeof min === 'number' && min > 0) {
            const h = Math.floor(min / 60);
            const m = min % 60;
            runtimeText = h > 0 ? `${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${m}m`;
        }
    }
    if (runtimeText) {
        runtimeDiv.textContent = runtimeText;
        runtimeDiv.style.position = 'absolute';
        runtimeDiv.style.left = '0';
        runtimeDiv.style.right = '0';
        runtimeDiv.style.bottom = '0';
        runtimeDiv.style.background = 'rgba(0,0,0,0.65)';
        runtimeDiv.style.color = '#fff';
        runtimeDiv.style.fontSize = '13px';
        runtimeDiv.style.textAlign = 'center';
        runtimeDiv.style.padding = '3px 0 2px 0';
        runtimeDiv.style.borderBottomLeftRadius = '12px';
        runtimeDiv.style.borderBottomRightRadius = '12px';
        posterWrapper.appendChild(runtimeDiv);
    }

    // Add action button(s) to the bottom of the card
    const actionContainer = document.createElement('div');
    actionContainer.className = 'card-action-container';
    const normTitle = (movie.title || movie.name || '').toLowerCase().trim();
    const inWatchlist = watchlist.some(m => m.id === movie.id) || watchlist.some(m => (m.title || m.name || '').toLowerCase().trim() === normTitle);
    const inWatched = watched.some(m => m.id === movie.id) || watched.some(m => (m.title || m.name || '').toLowerCase().trim() === normTitle);
    if ((tab === 'home' && currentHome === 'new') || tab === 'home' || tab === undefined) {
        const btn = document.createElement('button');
        btn.className = 'tab-action-btn';
        const goToWatchlist = (e) => {
            e.stopPropagation();
            // Switch to watchlist tab and render
            currentTab = 'watchlist';
            document.querySelectorAll('.tab-btn').forEach(tb => {
                tb.classList.toggle('active', tb.getAttribute('data-tab') === 'watchlist');
            });
            renderMoviesForTab('watchlist');
        };
        if (inWatched) {
            btn.textContent = 'Watched';
            btn.style.minWidth = '120px';
            btn.disabled = false;
            btn.onclick = (e) => {
                e.stopPropagation();
                currentTab = 'watched';
                document.querySelectorAll('.tab-btn').forEach(tb => {
                    tb.classList.toggle('active', tb.getAttribute('data-tab') === 'watched');
                });
                renderMoviesForTab('watched');
            };
        } else if (inWatchlist) {
            btn.textContent = 'In Watchlist';
            btn.disabled = false;
            btn.onclick = goToWatchlist;
        } else {
            btn.textContent = 'Add to Watchlist';
            btn.disabled = false;
            btn.onclick = async (e) => {
                e.stopPropagation();
                // Normalize movie object for local storage
                const normMovie = {
                    id: movie.id,
                    title: movie.title || movie.name || '',
                    name: movie.name || movie.title || '',
                    poster_path: movie.poster_path || '',
                    release_date: movie.release_date || movie.first_air_date || '',
                    first_air_date: movie.first_air_date || movie.release_date || '',
                    vote_average: movie.vote_average || 0,
                    media_type: movie.media_type || movie.type || (typeof movie.first_air_date === 'string' ? 'tv' : 'movie'),
                    overview: movie.overview || '',
                    ...(movie._seasonCard ? { _seasonCard: true, _seasonData: movie._seasonData, season_number: movie.season_number, show_id: movie.show_id } : {})
                };
                // Prevent duplicates by id or title
                if (!watchlist.some(m => m.id === normMovie.id) &&
                    !watchlist.some(m => (m.title || m.name || '').toLowerCase().trim() === normMovie.title.toLowerCase().trim()) &&
                    !watched.some(m => m.id === normMovie.id) &&
                    !watched.some(m => (m.title || m.name || '').toLowerCase().trim() === normMovie.title.toLowerCase().trim())
                ) {
                    watchlist.push(normMovie);
                    await saveUserLists();
                    currentTab = 'watchlist';
                    document.querySelectorAll('.tab-btn').forEach(tb => {
                        tb.classList.toggle('active', tb.getAttribute('data-tab') === 'watchlist');
                    });
                    renderMoviesForTab('watchlist'); // Show the card in watchlist
                    updateProfileStats();
                }
            };
        }
        actionContainer.appendChild(btn);
    } else if (tab === 'watchlist') {
        // Mark as Watched button
        const btn = document.createElement('button');
        btn.textContent = 'Mark as Watched';
        btn.className = 'tab-action-btn';
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (!watched.some(m => m.id === movie.id)) {
                watched.push(movie);
                watchlist = watchlist.filter(m => m.id !== movie.id);
                await saveUserLists();
                renderMoviesForTab(currentTab);
                updateProfileStats();
            }
        };
        actionContainer.appendChild(btn);

        // Delete icon overlay
        const delIcon = document.createElement('button');
        delIcon.className = 'delete-icon-btn';
        delIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="delete-circle" cx="12" cy="12" r="12" fill="rgba(0,0,0,0.55)"/><path d="M8 8L16 16M16 8L8 16" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
        delIcon.title = 'Remove from Watchlist';
        delIcon.onclick = async (e) => {
            e.stopPropagation();
            watchlist = watchlist.filter(m => m.id !== movie.id);
            await saveUserLists();
            renderMoviesForTab(currentTab);
            updateProfileStats();
        };
        delIcon.style.position = 'absolute';
        delIcon.style.top = '10px';
        delIcon.style.right = '10px';
        delIcon.style.background = 'none';
        delIcon.style.border = 'none';
        delIcon.style.padding = '0';
        delIcon.style.cursor = 'pointer';
        delIcon.style.zIndex = '5';
        delIcon.onmouseover = () => {
            const circle = delIcon.querySelector('.delete-circle');
            if (circle) circle.setAttribute('fill', 'rgba(255,0,0,0.75)');
        };
        delIcon.onmouseout = () => {
            const circle = delIcon.querySelector('.delete-circle');
            if (circle) circle.setAttribute('fill', 'rgba(0,0,0,0.55)');
        };
        posterWrapper.appendChild(delIcon);
    }
    card.appendChild(actionContainer);

    card.addEventListener('click', () => {
        // If this is a season card, show the parent show details and trailer, but highlight the season
        if (movie._seasonCard && movie.show_id) {
            // Fetch the parent show details and pass the season info for highlighting
            fetch(`${TMDB_BASE_URL}/tv/${movie.show_id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=release_dates,content_ratings,credits,videos`)
                .then(r => r.json())
                .then(showData => {
                    // Merge the showData with the season info for detail page
                    const merged = {
                        ...showData,
                        // For display, keep the season number and season data
                        _seasonCard: true,
                        _seasonData: movie._seasonData,
                        season_number: movie.season_number,
                        // Use the show id for detail page
                        id: movie.show_id
                    };
                    showDetailPage(merged);
                });
        } else {
            showDetailPage(movie);
        }
    });
// --- Custom Detail Page Logic ---
function showDetailPage(movie) {
    const detailPage = document.getElementById('detailPage');
    const moviesGrid = document.getElementById('moviesGrid');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    // Hide main grid and errors
    moviesGrid.style.display = 'none';
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    // Build detail HTML with backdrop background and fetch extra info
    // If this is a season card, use the season's poster and air date for the main detail
    let useSeason = movie._seasonCard && movie._seasonData;
    let bgUrl = '';
    // For mobile (<=720px), always use poster if available
    if (window.innerWidth <= 720 && movie.poster_path) {
        bgUrl = `https://image.tmdb.org/t/p/original${movie.poster_path}`;
    } else if (useSeason && movie._seasonData.poster_path) {
        bgUrl = `https://image.tmdb.org/t/p/original${movie._seasonData.poster_path}`;
    } else if (movie.backdrop_path && movie.backdrop_path !== 'null') {
        bgUrl = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
    }
    // Show loading while fetching details
    detailPage.innerHTML = `${bgUrl ? `<div class="detail-bg" style="background-image:url('${bgUrl}')"></div>` : ''}
        <button class="detail-back-btn" style="position:absolute;top:18px;left:18px;z-index:2;background:rgba(18,32,47,0.85);border:none;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00c4ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="detail-content"><div style="padding:48px 0;text-align:center;">Loading details...</div></div>`;
    detailPage.style.display = 'flex';
    // Add back button event
    const backBtn = detailPage.querySelector('.detail-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            detailPage.style.display = 'none';
            document.getElementById('moviesGrid').style.display = '';
        };
    }

    // Fetch extra details from TMDB
    // Robustly determine type for TMDB API (search results may lack media_type)
    let type = 'movie';
    if (
        movie.media_type === 'tv' ||
        movie.type === 'tv' ||
        (typeof movie.first_air_date === 'string' && movie.first_air_date) ||
        movie.number_of_seasons !== undefined
    ) {
        type = 'tv';
    }
    // If this is a season card, fetch season videos as well
    let seasonVideos = null;
    let promises = [
        fetch(`${TMDB_BASE_URL}/${type}/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=release_dates,content_ratings`).then(r => r.json()),
        fetch(`${TMDB_BASE_URL}/${type}/${movie.id}/credits?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json()),
        fetch(`${TMDB_BASE_URL}/${type}/${movie.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json())
    ];
    if (movie._seasonCard && movie.season_number) {
        promises.push(
            fetch(`${TMDB_BASE_URL}/tv/${movie.id}/season/${movie.season_number}/videos?api_key=${TMDB_API_KEY}&language=en-US`).then(r => r.json())
        );
    }
    Promise.all(promises).then(async (results) => {
        let [data, credits, videos] = results;
        if (movie._seasonCard && movie.season_number && results.length > 3) {
            seasonVideos = results[3];
        }
            // MPA/Certification
            let mpa = '';
            if (type === 'movie' && data.release_dates && data.release_dates.results) {
                const us = data.release_dates.results.find(r => r.iso_3166_1 === 'US');
                if (us && us.release_dates && us.release_dates.length > 0) {
                    mpa = us.release_dates[0].certification;
                }
            } else if (type === 'tv' && data.content_ratings && data.content_ratings.results) {
                const us = data.content_ratings.results.find(r => r.iso_3166_1 === 'US');
                if (us && us.rating) mpa = us.rating;
            }
            // Genres
            let genres = (data.genres || []).map(g => g.name).join(', ');
            // Runtime or Total Seasons (robust: always show seasons for TV shows, runtime for movies)
            let runtimeOrSeasons = '';
            // Determine if this is a TV show (search results may not have media_type set)
            const isShow = (type === 'tv') || movie.media_type === 'tv' || movie.type === 'tv' || movie.first_air_date || movie.number_of_seasons !== undefined;
            if (!isShow) {
                // Movie
                let runtime = data.runtime || movie.runtime || movie.duration || movie.length || 0;
                if (runtime && typeof runtime === 'number') {
                    const h = Math.floor(runtime / 60);
                    const m = runtime % 60;
                    runtimeOrSeasons = `${h > 0 ? h + 'h ' : ''}${m}m`;
                } else {
                    runtimeOrSeasons = 'N/A';
                }
            } else {
                // TV Show: try all possible fields for number of seasons
                let seasons = null;
                if (typeof data.number_of_seasons === 'number') seasons = data.number_of_seasons;
                else if (typeof movie.number_of_seasons === 'number') seasons = movie.number_of_seasons;
                else if (Array.isArray(data.seasons)) seasons = data.seasons.length;
                else if (Array.isArray(movie.seasons)) seasons = movie.seasons.length;
                if (seasons !== null) {
                    runtimeOrSeasons = `${seasons} season${seasons !== 1 ? 's' : ''}`;
                } else {
                    runtimeOrSeasons = 'N/A';
                }
            }
            // Date
            let date = data.release_date || data.first_air_date || '';
            if (date && date.length === 10) {
                // Format as MM/DD/YYYY
                const d = new Date(date);
                date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
            }
            // Build detail HTML
            // If TV show, get selected season details if present, else latest season
            let seasonHtml = '';
            if (isShow) {
                let seasonsArr = data.seasons || movie.seasons || [];
                if (Array.isArray(seasonsArr) && seasonsArr.length > 0) {
                    let seasonToShow = null;
                    // If this is a season card, show that season's details
                    if (movie._seasonCard && movie.season_number) {
                        seasonToShow = seasonsArr.find(s => s.season_number === movie.season_number);
                    }
                    // Fallback to latest season if not found
                    if (!seasonToShow) {
                        seasonToShow = seasonsArr[0];
                        for (let s of seasonsArr) {
                            if (s.air_date && (!seasonToShow.air_date || new Date(s.air_date) > new Date(seasonToShow.air_date))) {
                                seasonToShow = s;
                            }
                        }
                    }
                    if (seasonToShow) {
                        seasonHtml = `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Season:</span> <b>${seasonToShow.name || 'Season ' + seasonToShow.season_number}</b> (${seasonToShow.air_date || 'N/A'}) - ${seasonToShow.episode_count || '?'} episodes</div>`;
                        // If this is a season card, also show the season's overview
                        if (movie._seasonCard && movie._seasonData && movie._seasonData.overview) {
                            seasonHtml += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Season Overview:</span> <span>${movie._seasonData.overview}</span></div>`;
                        } else if (seasonToShow.overview) {
                            seasonHtml += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Season Overview:</span> <span>${seasonToShow.overview}</span></div>`;
                        }
                    }
                }
            }
            // Extra details
            let extraRows = seasonHtml;
            // Writer(s) and Director(s)
            if (credits && credits.crew) {
                // Director
                const directors = credits.crew.filter(c => c.job === 'Director').map(c => c.name);
                if (directors.length > 0) {
                    extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Director:</span> ${directors.join(', ')}</div>`;
                }
                // Writer (Screenplay, Writer, Story, Teleplay)
                const writers = credits.crew.filter(c => ['Screenplay','Writer','Story','Teleplay'].includes(c.job)).map(c => c.name);
                // Remove duplicates
                const uniqueWriters = [...new Set(writers)];
                if (uniqueWriters.length > 0) {
                    extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Writer:</span> ${uniqueWriters.join(', ')}</div>`;
                }
            }
            if (data.original_title || data.original_name) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Original Title:</span> ${data.original_title || data.original_name}</div>`;
            }
            if (data.status) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Status:</span> ${data.status}</div>`;
            }
            if (data.original_language) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Language:</span> ${data.original_language.toUpperCase()}</div>`;
            }
            if (type === 'movie' && typeof data.budget === 'number' && data.budget > 0) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Budget:</span> $${data.budget.toLocaleString()}</div>`;
            }
            if (type === 'movie' && typeof data.revenue === 'number' && data.revenue > 0) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Revenue:</span> $${data.revenue.toLocaleString()}</div>`;
            }
            if (data.homepage) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Homepage:</span> <a href=\"${data.homepage}\" target=\"_blank\" style=\"color:#00e6b2;word-break:break-all;\">${data.homepage}</a></div>`;
            }
            if (data.tagline) {
                extraRows += `<div class=\"detail-extra-row\"><span class=\"detail-extra-label\">Tagline:</span> <span style=\"font-style:italic;opacity:0.85;\">${data.tagline}</span></div>`;
            }
            // Videos (teaser/trailer)
            let videoHtml = '';
            let useVideos = videos;
            // If this is a season card and season has its own videos, use those
            if (movie._seasonCard && seasonVideos && Array.isArray(seasonVideos.results) && seasonVideos.results.length > 0) {
                useVideos = seasonVideos;
            }
            if (useVideos && useVideos.results && useVideos.results.length > 0) {
                const teasers = useVideos.results.filter(v => v.type === 'Teaser' && v.site === 'YouTube');
                const trailers = useVideos.results.filter(v => v.type === 'Trailer' && v.site === 'YouTube');
                let videoItems = [];
                if (teasers.length > 0) {
                    videoItems.push(`
                        <div class=\"detail-video-item\">
                            <div class=\"detail-video-title\">Teaser</div>
                            <iframe class=\"detail-video-embed\" src=\"https://www.youtube.com/embed/${teasers[0].key}\" allowfullscreen></iframe>
                        </div>
                    `);
                }
                if (trailers.length > 0) {
                    videoItems.push(`
                        <div class=\"detail-video-item\">
                            <div class=\"detail-video-title\">Trailer</div>
                            <iframe class=\"detail-video-embed\" src=\"https://www.youtube.com/embed/${trailers[0].key}\" allowfullscreen></iframe>
                        </div>
                    `);
                }
                if (videoItems.length > 0) {
                    videoHtml = `<div class=\"detail-videos\">${videoItems.join('')}</div>`;
                }
            }
                        // Fetch IMDb rating from OMDb (fallback to title search if no imdb_id)
                        let imdbRatingHtml = '';
                        let imdbId = data.imdb_id || movie.imdb_id;
                        let omdbData = null;
                        try {
                            let omdbUrl = '';
                            let omdbType = 'movie';
                            let titleRaw = '';
                            let year = '';
                            // For TV show seasons, always use the parent show's IMDb ID if available
                            if (movie._seasonCard && data.imdb_id) {
                                imdbId = data.imdb_id;
                                omdbType = 'series';
                                titleRaw = data.name;
                            } else if (type === 'tv') {
                                omdbType = 'series';
                                titleRaw = (data.name || movie.name || '').trim();
                            } else {
                                omdbType = 'movie';
                                titleRaw = (data.title || movie.title || '').trim();
                                year = (data.release_date || '').slice(0,4);
                            }
                            let title = encodeURIComponent(titleRaw);
                            // Try by imdbId first (for TV seasons, this is always the parent show)
                            if (imdbId) {
                                omdbUrl = `https://www.omdbapi.com/?apikey=c8cce5e3&i=${imdbId}`;
                                let omdbResp = await fetch(omdbUrl);
                                omdbData = await omdbResp.json();
                            }
                            // Only try title fallback if no IMDb ID or OMDb result is N/A
                            if ((!imdbId || !omdbData || !omdbData.imdbRating || omdbData.imdbRating === 'N/A') && titleRaw) {
                                if (omdbType === 'series') {
                                    omdbUrl = `https://www.omdbapi.com/?apikey=c8cce5e3&t=${title}&type=series`;
                                } else {
                                    omdbUrl = `https://www.omdbapi.com/?apikey=c8cce5e3&t=${title}${year ? `&y=${year}` : ''}&type=movie`;
                                }
                                let omdbResp = await fetch(omdbUrl);
                                omdbData = await omdbResp.json();
                            }
                            // If still not found, try by title only (no year/type)
                            if ((!omdbData || !omdbData.imdbRating || omdbData.imdbRating === 'N/A') && titleRaw) {
                                omdbUrl = `https://www.omdbapi.com/?apikey=c8cce5e3&t=${title}`;
                                let omdbResp = await fetch(omdbUrl);
                                omdbData = await omdbResp.json();
                            }
                        } catch (e) {
                            // ignore OMDb errors
                        }
                        let rtRatingHtml = '';
                        if (omdbData && Array.isArray(omdbData.Ratings)) {
                            const rt = omdbData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
                            if (rt && rt.Value) {
                                rtRatingHtml = `<span class=\"detail-rating-rt\">Rotten Tomatoes: ${rt.Value}</span>`;
                            } else {
                                rtRatingHtml = `<span class=\"detail-rating-rt\">Rotten Tomatoes: N/A</span>`;
                            }
                        } else {
                            rtRatingHtml = `<span class=\"detail-rating-rt\">Rotten Tomatoes: N/A</span>`;
                        }
                        if (omdbData && omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
                            imdbRatingHtml = `<span class=\"detail-rating-imdb\">IMDb: ${omdbData.imdbRating}</span>`;
                        } else {
                            imdbRatingHtml = `<span class=\"detail-rating-imdb\">IMDb: N/A</span>`;
                        }
                        detailPage.innerHTML = `
                                ${bgUrl ? `<div class=\"detail-bg\" style=\"background-image:url('${bgUrl}')\"></div>` : ''}
                                <div style=\"display:flex;flex-direction:column;flex:1;\">
                                    <div style=\"display:flex;flex-direction:row;gap:36px;align-items:flex-start;\">
                                        <img class=\"detail-poster\" src=\"${useSeason && movie._seasonData.poster_path ? `https://image.tmdb.org/t/p/w500${movie._seasonData.poster_path}` : (movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/300x450/222c3a/ffffff?text=No+Image')}\" alt=\"${useSeason ? (movie._seasonData.name || movie.title || movie.name) : (movie.title || movie.name)}\">
                                        <div class=\"detail-content\">\n                        <div class=\"detail-title\" style=\"display:flex;align-items:center;gap:8px;\">${useSeason ? (movie.title || movie.name) : (movie.title || movie.name)}<button class=\"detail-back-btn\" title=\"Close\" onclick=\"window.goBackToGrid()\">&times;</button></div>\n                        <div class=\"detail-meta\">\n                            <span class=\"detail-mpa\">${mpa || ''}</span>\n                            <span class=\"detail-date\">${useSeason && movie._seasonData.air_date ? movie._seasonData.air_date : date}</span>\n                            <span class=\"detail-genres\">${genres}</span>\n                            <span class=\"detail-runtime\">${runtimeOrSeasons}</span>\n                        </div>\n                        <div class=\"detail-rating-row\">\n                            <span class=\"detail-rating\">${typeof movie.vote_average === 'number' && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : 'N/A'}</span>\n                            ${imdbRatingHtml}\n                            ${rtRatingHtml}\n                            <span class=\"detail-category\">${movie.media_type === 'tv' ? 'Show' : 'Movie'}</span>\n                        </div>\n                        <div class=\"detail-overview\">${useSeason && movie._seasonData.overview ? movie._seasonData.overview : (movie.overview || 'No overview available.')}</div>\n                        ${extraRows ? `<div class=\"detail-extra\">${extraRows}</div>` : ''}
                                        </div>
                                    </div>
                                    ${videoHtml ? `<div class=\"detail-videos\">${videoHtml}</div>` : ''}
                                </div>
                        `;
        });
    // Add global back handler
    window.goBackToGrid = function() {
        detailPage.style.display = 'none';
        moviesGrid.style.display = '';
        loadingDiv.style.display = '';
        errorDiv.style.display = '';
    };
    // Scroll to top for detail view
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

    return card;
}

function renderMoviesForTab(tab) {
    let movies = [];
    const filterType = document.getElementById('filterType');
    const filterVal = filterType ? filterType.value : 'all';
    if (tab === 'home') {
        if (currentHome === 'all') {
            // Show all movies and shows from all available lists (deduplicated)
            let allItems = [
                ...nowPlayingMovies,
                ...allMovies,
                ...trendingMovies,
                ...popularMovies,
                ...upcomingMovies
            ];
            // Deduplicate by id
            const seen = new Set();
            allItems = allItems.filter(m => {
                if (!m || !m.id) return false;
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
            // Sort by popularity descending, fallback to vote_average, then date
            allItems.sort((a, b) => {
                if (typeof b.popularity === 'number' && typeof a.popularity === 'number') {
                    return b.popularity - a.popularity;
                } else if (typeof b.vote_average === 'number' && typeof a.vote_average === 'number') {
                    return b.vote_average - a.vote_average;
                } else {
                    const dateA = new Date(a.release_date || a.first_air_date || 0);
                    const dateB = new Date(b.release_date || b.first_air_date || 0);
                    return dateB - dateA;
                }
            });
            // Filter by type if filterType is set
            const filterType = document.getElementById('filterType');
            const filterVal = filterType ? filterType.value : 'all';
            let movies = allItems;
            if (filterVal === 'movie') {
                movies = movies.filter(m => (m.media_type === 'movie' || m.type === 'movie' || (m.first_air_date === undefined && m.release_date)));
            } else if (filterVal === 'tv') {
                movies = movies.filter(m => (m.media_type === 'tv' || m.type === 'tv' || m.first_air_date));
            }
            // Apply search filter
            const q = searchInput.value.trim().toLowerCase();
            if (q) {
                movies = movies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
            }
            moviesGrid.innerHTML = '';
            if (!movies.length) {
                return;
            }
            movies.forEach(movie => {
                moviesGrid.appendChild(createMovieCard(movie, tab));
            });
            return;
        }
        if (currentHome === 'now_playing') {
            movies = nowPlayingMovies.filter(m => !watchlist.some(w => w.id === m.id) && !watched.some(w => w.id === m.id));
        } else if (currentHome === 'new') {
            // Show more cards: expand the date range and include more sources for new/running movies and shows
            const today = new Date();
            const daysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 180);
            // Get recent movies from allMovies (last 180 days)
            let recentMovies = allMovies.filter(m => {
                if ((m.media_type === 'movie' || m.type === 'movie' || (m.first_air_date === undefined && m.release_date)) && m.release_date) {
                    const rel = new Date(m.release_date);
                    return rel >= daysAgo && rel <= today;
                }
                return false;
            });
            // Get running/recent TV shows from trendingMovies (which contains both movies and shows)
            let runningShows = trendingMovies.filter(m => {
                if ((m.media_type === 'tv' || m.type === 'tv' || m.first_air_date)) {
                    const fad = m.first_air_date ? new Date(m.first_air_date) : null;
                    if (m.status && (m.status === 'Running' || m.status === 'Returning Series' || m.status === 'In Production')) return true;
                    if (fad && fad >= daysAgo && fad <= today) return true;
                }
                return false;
            });
            // Also include recent TV shows from allMovies (not just trending)
            let recentShows = allMovies.filter(m => {
                if ((m.media_type === 'tv' || m.type === 'tv' || m.first_air_date)) {
                    const fad = m.first_air_date ? new Date(m.first_air_date) : null;
                    return fad && fad >= daysAgo && fad <= today;
                }
                return false;
            });
            // Remove duplicates by id
            let allNew = [...recentMovies, ...runningShows, ...recentShows];
            const seen = new Set();
            movies = allNew.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return !watchlist.some(w => w.id === m.id) && !watched.some(w => w.id === m.id);
            });
            // Sort by release/air date descending (latest first)
            movies = movies.sort((a, b) => {
                const dateA = new Date(a.release_date || a.first_air_date || '');
                const dateB = new Date(b.release_date || b.first_air_date || '');
                return dateB - dateA;
            });
        } else if (currentHome === 'trending') {
            movies = trendingMovies.filter(m => !watchlist.some(w => w.id === m.id) && !watched.some(w => w.id === m.id));
        } else if (currentHome === 'popular') {
            // Show up to 100 cards: both popular shows and movies, deduplicated
            let combined = [...popularMovies, ...trendingMovies];
            const seen = new Set();
            movies = combined.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                // Accept as show if: media_type/type is tv, or has first_air_date, or has number_of_seasons, or lacks release_date but has name
                const isShow = (
                    m.media_type === 'tv' ||
                    m.type === 'tv' ||
                    (typeof m.first_air_date === 'string' && m.first_air_date) ||
                    typeof m.number_of_seasons === 'number' ||
                    (m.name && !m.release_date)
                );
                // Accept as movie if: media_type/type is movie, or has release_date, or has title
                const isMovie = (
                    m.media_type === 'movie' ||
                    m.type === 'movie' ||
                    (typeof m.release_date === 'string' && m.release_date) ||
                    (m.title && !m.first_air_date)
                );
                return (isMovie || isShow) && !watchlist.some(w => w.id === m.id) && !watched.some(w => w.id === m.id);
            });
            // Sort by popularity descending if available, else by vote_average, else by date
            movies = movies.sort((a, b) => {
                if (typeof b.popularity === 'number' && typeof a.popularity === 'number') return b.popularity - a.popularity;
                if (typeof b.vote_average === 'number' && typeof a.vote_average === 'number') return b.vote_average - a.vote_average;
                const dateA = new Date(a.release_date || a.first_air_date || '');
                const dateB = new Date(b.release_date || b.first_air_date || '');
                return dateB - dateA;
            });
            movies = movies.slice(0, 100);
        } else if (currentHome === 'upcoming') {
            movies = upcomingMovies.filter(m => !watchlist.some(w => w.id === m.id) && !watched.some(w => w.id === m.id));
        }
        // Filter by type
        if (filterVal === 'movie') {
            movies = movies.filter(m => (m.media_type === 'movie' || m.type === 'movie' || (m.first_air_date === undefined && m.release_date)));
        } else if (filterVal === 'tv') {
            movies = movies.filter(m => (m.media_type === 'tv' || m.type === 'tv' || m.first_air_date));
        }
        // Apply search filter
        const q = searchInput.value.trim().toLowerCase();
        if (q) {
            movies = movies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        }
        moviesGrid.innerHTML = '';
        if (!movies.length) {
            // Do not display any message for empty home tab
            return;
        }
        movies.forEach(movie => {
            moviesGrid.appendChild(createMovieCard(movie, tab));
        });
    } else if (tab === 'watchlist') {
        movies = watchlist;
        // Filter by type
        if (filterVal === 'movie') {
            movies = movies.filter(m => (m.media_type === 'movie' || m.type === 'movie' || (m.first_air_date === undefined && m.release_date)));
        } else if (filterVal === 'tv') {
            movies = movies.filter(m => (m.media_type === 'tv' || m.type === 'tv' || m.first_air_date));
        }
        const q = searchInput.value.trim().toLowerCase();
        if (q) {
            movies = movies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        }
        moviesGrid.innerHTML = '';
        if (!movies.length) {
            // Do not display any message for empty watchlist tab
            return;
        }
        movies.forEach(movie => {
            moviesGrid.appendChild(createMovieCard(movie, tab));
        });
    } else if (tab === 'watched') {
        movies = watched.slice().reverse(); // Show last watched first
        // Filter by type
        if (filterVal === 'movie') {
            movies = movies.filter(m => (m.media_type === 'movie' || m.type === 'movie' || (m.first_air_date === undefined && m.release_date)));
        } else if (filterVal === 'tv') {
            movies = movies.filter(m => (m.media_type === 'tv' || m.type === 'tv' || m.first_air_date));
        }
        const q = searchInput.value.trim().toLowerCase();
        if (q) {
            movies = movies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        }
        moviesGrid.innerHTML = '';
        if (!movies.length) {
            // Do not display any message for empty watched tab
            return;
        }
        movies.forEach(movie => {
            moviesGrid.appendChild(createMovieCard(movie, tab));
        });
    } else if (tab === 'settings') {
        moviesGrid.innerHTML = '<div class="info">Settings will be available soon.</div>';
    } else if (tab === 'about') {
        moviesGrid.innerHTML = `
        <div class="about-card" style="max-width:1100px;margin:32px auto 24px auto;padding:22px 48px 22px 48px;background:linear-gradient(135deg,#1a2636 80%,#00c4ff22 100%);border-radius:18px;box-shadow:0 4px 32px 0 rgba(0,196,255,0.10),0 1.5px 8px 0 rgba(0,0,0,0.13);color:#eaf6fb;text-align:center;position:relative;overflow:hidden;">
            <div style="display:flex;justify-content:center;align-items:center;margin-bottom:12px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;background:linear-gradient(135deg,#00e6b2 60%,#00c4ff 100%);border-radius:50%;box-shadow:0 2px 12px #00c4ff33;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/></svg>
                </span>
            </div>
            <h2 style="font-size:2rem;font-weight:700;letter-spacing:0.01em;margin-bottom:8px;color:#00e6b2;">About <span style='color:#00c4ff;'>My Watchlist</span></h2>
            <p style="font-size:1.08rem;line-height:1.6;color:#eaf6fb;opacity:0.93;margin-bottom:16px;">A modern, beautiful web app for discovering, tracking, and managing your favorite movies and TV shows. Built for movie lovers, binge-watchers, and everyone in between.</p>
            <div class="about-feature-row" style="display:flex;flex-direction:row;gap:18px 38px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:0 auto 12px auto;max-width:1040px;">
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;min-width:260px;max-width:320px;min-height:90px;max-height:140px;background:rgba(0,228,178,0.07);border-radius:12px;padding:12px 10px 10px 10px;box-shadow:0 2px 8px #00c4ff0a;">
                    <span style="color:#00e6b2;font-size:1.5em;display:inline-flex;align-items:center;justify-content:center;width:36px;"><svg width="24" height="24" fill="none" stroke="#00e6b2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"/><rect x="8" y="13" width="8" height="4" rx="1"/><path d="M8 7v6m8-6v6"/></svg></span>
                    <span style="text-align:center;">Browse the latest, trending, popular, and upcoming movies and shows.</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;min-width:260px;max-width:320px;min-height:90px;max-height:140px;background:rgba(0,228,178,0.07);border-radius:12px;padding:12px 10px 10px 10px;box-shadow:0 2px 8px #00c4ff0a;">
                    <span style="color:#00e6b2;font-size:1.5em;display:inline-flex;align-items:center;justify-content:center;width:36px;"><svg width="24" height="24" fill="none" stroke="#00e6b2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6m0 0V4m0 10l-3-3m3 3l3-3"/></svg></span>
                    <span style="text-align:center;">Add items to your personal watchlist and mark them as watched.</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;min-width:260px;max-width:320px;min-height:90px;max-height:140px;background:rgba(0,228,178,0.07);border-radius:12px;padding:12px 10px 10px 10px;box-shadow:0 2px 8px #00c4ff0a;">
                    <span style="color:#00e6b2;font-size:1.5em;display:inline-flex;align-items:center;justify-content:center;width:36px;"><svg width="24" height="24" fill="none" stroke="#00e6b2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></span>
                    <span style="text-align:center;">See ratings, release dates, and categories for every title.</span>
                </div>
            </div>
            <div style="margin-top:18px;font-size:1.05rem;color:#aec4c9;opacity:0.93;">Created by <b style='color:#00e6b2;'>Nayan</b>. All rights reserved &copy; 2025.</div>
        </div>
        <style>
        .about-card {
            animation: aboutFadeIn 0.7s cubic-bezier(.4,1.6,.4,1) 0s 1;
        }
        @keyframes aboutFadeIn {
            0% { opacity: 0; transform: translateY(40px) scale(0.98); }
            100% { opacity: 1; transform: none; }
        }
        </style>
        `;
    }
}

async function fetchAllMovieLists() {
    loadingDiv.style.display = 'block';
    errorDiv.textContent = '';
    try {
        // Now Playing
        const nowPlayingResp = await fetch(`${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        if (!nowPlayingResp.ok) throw new Error('Failed to fetch now playing');
        const nowPlayingData = await nowPlayingResp.json();
        // Filter Now Playing: Only movies in theaters or streaming
        let filteredNowPlaying = [];
        if (nowPlayingData.results && nowPlayingData.results.length) {
            // Check for streaming availability in parallel (limit to first 20 for performance)
            const streamingChecks = await Promise.all(
                nowPlayingData.results.slice(0, 20).map(async m => {
                    // Check if movie is in theaters (all in now_playing) or streaming
                    try {
                        const resp = await fetch(`${TMDB_BASE_URL}/movie/${m.id}/watch/providers?api_key=${TMDB_API_KEY}`);
                        if (resp.ok) {
                            const data = await resp.json();
                            const country = data.results['US'] || Object.values(data.results)[0];
                            if (country && ((country.flatrate && country.flatrate.length > 0) || (country.ads && country.ads.length > 0))) {
                                m._isStreaming = true;
                            }
                        }
                    } catch {}
                    return m;
                })
            );
            // Only include if in theaters (all in now_playing) or streaming
            filteredNowPlaying = streamingChecks.filter(m => true || m._isStreaming); // For demo, keep all, but you can filter by m._isStreaming if needed
        }

        // Helper to fetch runtime for a list of movies
        async function fetchRuntimesForMovies(movies) {
            for (let m of movies) {
                if (typeof m.runtime !== 'number') {
                    try {
                        const resp = await fetch(`${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (typeof data.runtime === 'number') m.runtime = data.runtime;
                        }
                    } catch {}
                }
            }
        }

        await fetchRuntimesForMovies(filteredNowPlaying);
        nowPlayingMovies = filteredNowPlaying;

        // New: fetch 120 movies (6 pages of trending)
        let newMovies = [];
        for (let page = 1; page <= 6; page++) {
            const resp = await fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`);
            if (!resp.ok) break;
            const data = await resp.json();
            if (data.results && data.results.length) {
                newMovies = newMovies.concat(data.results);
            }
        }
        await fetchRuntimesForMovies(newMovies);
        allMovies = newMovies.slice(0, 120);

        // Trending: fetch weekly trending movies and shows
        // Trending
        const trendingMoviesResp1 = await fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`);
        const trendingShowsResp1 = await fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`);
        let trendingMoviesArr1 = [];
        let trendingShowsArr1 = [];
        if (trendingMoviesResp1.ok) {
            const data = await trendingMoviesResp1.json();
            trendingMoviesArr1 = data.results || [];
        }
        if (trendingShowsResp1.ok) {
            const data = await trendingShowsResp1.json();
            trendingShowsArr1 = data.results || [];
        }
        // Helper to fetch season/episode info for TV shows
        async function fetchShowDetailsForShows(shows) {
            for (let s of shows) {
                if ((s.media_type === 'tv' || s.first_air_date) && (!s.number_of_seasons || !s.number_of_episodes)) {
                    try {
                        const resp = await fetch(`${TMDB_BASE_URL}/tv/${s.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (typeof data.number_of_seasons === 'number') s.number_of_seasons = data.number_of_seasons;
                            if (typeof data.number_of_episodes === 'number') s.number_of_episodes = data.number_of_episodes;
                            if (Array.isArray(data.episode_run_time)) s.episode_run_time = data.episode_run_time;
                        }
                    } catch {}
                }
            }
        }
        await fetchRuntimesForMovies(trendingMoviesArr1);
        await fetchShowDetailsForShows(trendingShowsArr1);
        trendingMovies = [...trendingMoviesArr1, ...trendingShowsArr1].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        // Popular
        const popularResp1 = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        if (!popularResp1.ok) throw new Error('Failed to fetch popular');
        const popularData1 = await popularResp1.json();
        popularMovies = popularData1.results || [];
        await fetchRuntimesForMovies(popularMovies);
        await fetchShowDetailsForShows(popularMovies);
        // Upcoming: fetch all pages and show all future releases
        const today1 = new Date();
        let allUpcoming1 = [];
        let page1 = 1;
        let totalPages1 = 1;
        do {
            const resp = await fetch(`${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=${page1}`);
            if (!resp.ok) break;
            const data = await resp.json();
            totalPages1 = data.total_pages || 1;
            if (data.results && data.results.length) {
                allUpcoming1 = allUpcoming1.concat(data.results);
            }
            page1++;
        } while (page1 <= totalPages1);
        await fetchRuntimesForMovies(allUpcoming1);
        await fetchShowDetailsForShows(allUpcoming1);
        upcomingMovies = allUpcoming1.filter(m => {
            const dateStr = m.release_date || m.first_air_date;
            if (!dateStr) return false;
            const releaseDate = new Date(dateStr);
            return releaseDate >= new Date(today1.getFullYear(), today1.getMonth(), today1.getDate());
        }).sort((a, b) => {
            // Sort by release date ascending (earliest first)
            const dateA = new Date(a.release_date || a.first_air_date || '');
            const dateB = new Date(b.release_date || b.first_air_date || '');
            return dateA - dateB;
        });

        renderMoviesForTab(currentTab);
    } catch (err) {
        errorDiv.textContent = 'Error loading movies.';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

searchInput.addEventListener('input', async function() {
    let q = searchInput.value.trim().toLowerCase();
    if (!q) {
        // Clear search results and reset to current tab view
        if (moviesGrid) moviesGrid.innerHTML = '';
        renderMoviesForTab(currentTab);
        return;
    }
    // Try local search first
    let movies = [];
    if (currentTab === 'home') {
        if (currentHome === 'now_playing') {
            movies = nowPlayingMovies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        } else if (currentHome === 'new') {
            movies = allMovies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        } else if (currentHome === 'trending') {
            movies = trendingMovies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        } else if (currentHome === 'popular') {
            movies = popularMovies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        } else if (currentHome === 'upcoming') {
            movies = upcomingMovies.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
        }
    } else if (currentTab === 'watchlist') {
        movies = watchlist.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
    } else if (currentTab === 'watched') {
        movies = watched.filter(m => (m.title || m.name || '').toLowerCase().includes(q));
    }
    if (movies.length) {
        moviesGrid.innerHTML = '';
        movies.forEach(movie => {
            moviesGrid.appendChild(createMovieCard(movie, currentTab));
        });
    } else {
        // If not found locally, search TMDB
        moviesGrid.innerHTML = '<div class="loading">Searching TMDB...</div>';
        let tmdbResults = [];
        try {
            const movieResp = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
            const showResp = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
            if (movieResp.ok) {
                const data = await movieResp.json();
                tmdbResults = tmdbResults.concat(data.results || []);
            }
            if (showResp.ok) {
                const data = await showResp.json();
                tmdbResults = tmdbResults.concat(data.results || []);
            }
        } catch {}
        if (tmdbResults.length) {
            // Filter out results already in watchlist or watched by id or title/name
            const allIds = new Set([
                ...watchlist.map(m => m.id),
                ...watched.map(m => m.id)
            ]);
            const allTitles = new Set([
                ...watchlist.map(m => (m.title || m.name || '').toLowerCase().trim()),
                ...watched.map(m => (m.title || m.name || '').toLowerCase().trim())
            ]);
            let filteredResults = tmdbResults.filter(m => {
                const t = (m.title || m.name || '').toLowerCase().trim();
                // Only show if the title or name is a close match to the query (not just substring)
                // Accept if exact match or starts with query or query starts with title
                if (allIds.has(m.id) || allTitles.has(t)) return false;
                if (!t) return false;
                // Remove all non-alphanumeric for comparison
                const normT = t.replace(/[^a-z0-9]/g, '');
                const normQ = q.replace(/[^a-z0-9]/g, '');
                // Accept if exact match, starts with, or query starts with title
                if (normT === normQ) return true;
                if (normT.startsWith(normQ) || normQ.startsWith(normT)) return true;
                // Accept if Levenshtein distance is 1 (very close typo)
                function levenshtein(a, b) {
                    if (a.length === 0) return b.length;
                    if (b.length === 0) return a.length;
                    const matrix = [];
                    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
                    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
                    for (let i = 1; i <= b.length; i++) {
                        for (let j = 1; j <= a.length; j++) {
                            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                                matrix[i][j] = matrix[i - 1][j - 1];
                            } else {
                                matrix[i][j] = Math.min(
                                    matrix[i - 1][j - 1] + 1, // substitution
                                    matrix[i][j - 1] + 1,     // insertion
                                    matrix[i - 1][j] + 1      // deletion
                                );
                            }
                        }
                    }
                    return matrix[b.length][a.length];
                }
                if (levenshtein(normT, normQ) <= 1) return true;
                return false;
            });
            // Sort so that the latest show or movie appears first
            filteredResults = filteredResults.sort((a, b) => {
                // Prefer release_date for movies, first_air_date for shows
                const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
                const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
                return dateB - dateA;
            });
            if (filteredResults.length) {
                // Fetch missing runtimes for movies in search results
                async function fetchRuntimesForSearchResults(movies) {
                    for (let m of movies) {
                        // Only fetch for movies (not TV shows/seasons) and only if missing
                        if ((m.media_type === 'movie' || m.type === 'movie' || m.release_date) && typeof m.runtime !== 'number' && m.id) {
                            try {
                                const resp = await fetch(`${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                                if (resp.ok) {
                                    const data = await resp.json();
                                    if (typeof data.runtime === 'number') m.runtime = data.runtime;
                                }
                            } catch {}
                        }
                    }
                }
                await fetchRuntimesForSearchResults(filteredResults);
                moviesGrid.innerHTML = '';
                for (const movie of filteredResults) {
                    // If it's a TV show and has multiple seasons, fetch and display each season as a card
                    const isShow = (movie.media_type === 'tv' || movie.type === 'tv' || movie.first_air_date || movie.number_of_seasons !== undefined);
                    if (isShow && movie.id) {
                        try {
                            // Fetch show details to get seasons
                            const resp = await fetch(`${TMDB_BASE_URL}/tv/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`);
                            if (resp.ok) {
                                const showData = await resp.json();
                                if (Array.isArray(showData.seasons) && showData.seasons.length > 0) {
                                    for (const season of showData.seasons) {
                                        // Create a pseudo-movie object for the season
                                        const seasonCard = {
                                            ...movie,
                                            // Use season poster if available, else show poster
                                            poster_path: season.poster_path || movie.poster_path,
                                            title: `${movie.name || movie.title || ''} - ${season.name || 'Season ' + season.season_number}`,
                                            name: `${movie.name || movie.title || ''} - ${season.name || 'Season ' + season.season_number}`,
                                            first_air_date: season.air_date,
                                            overview: season.overview || movie.overview,
                                            season_number: season.season_number,
                                            episode_count: season.episode_count,
                                            // Mark as a season card
                                            _seasonCard: true,
                                            _seasonData: season,
                                            // For detail page
                                            seasons: showData.seasons,
                                            number_of_seasons: showData.number_of_seasons,
                                            show_id: movie.id,
                                            id: `${movie.id}-season-${season.season_number}`
                                        };
                                        moviesGrid.appendChild(createMovieCard(seasonCard, currentTab));
                                    }
                                    continue; // Skip adding the show card itself
                                }
                            }
                        } catch {}
                    }
                    // Otherwise, just add the movie/show card
                    moviesGrid.appendChild(createMovieCard(movie, currentTab));
                }
            } else {
                moviesGrid.innerHTML = '<div class="error">No movies or shows found.</div>';
            }
        } else {
            moviesGrid.innerHTML = '<div class="error">No movies or shows found.</div>';
        }
    }
});

if (tabs) {
    tabs.addEventListener('click', function(e) {
        if (e.target.classList.contains('tab-btn')) {
            // Clear search box
            var searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            // Close details page if open
            const detailPage = document.getElementById('detailPage');
            const moviesGrid = document.getElementById('moviesGrid');
            const loadingDiv = document.getElementById('loading');
            const errorDiv = document.getElementById('error');
            if (detailPage && detailPage.style.display !== 'none') {
                detailPage.style.display = 'none';
                if (moviesGrid) moviesGrid.style.display = '';
                if (loadingDiv) loadingDiv.style.display = '';
                if (errorDiv) errorDiv.style.display = '';
            }
            const selectedTab = e.target.getAttribute('data-tab');
            if (selectedTab === 'home') {
                currentTab = 'home';
                currentHome = 'new';
                tabs.classList.add('home-dropdown-open');
                homeDropdownOpen = true;
                document.querySelectorAll('.home-dropdown-btn').forEach(btn => btn.classList.remove('active'));
                const defaultBtn = document.querySelector('.home-dropdown-btn[data-home="new"]');
                if (defaultBtn) defaultBtn.classList.add('active');
                // Remove active from all tab-btn except home
                document.querySelectorAll('.tab-btn').forEach(btn => {
                  if (btn.getAttribute('data-tab') !== 'home') btn.classList.remove('active');
                });
                document.getElementById('homeTabBtn').classList.add('active');
                // Always load New section when returning to Home
                renderMoviesForTab('home');
            } else {
                currentTab = selectedTab;
                tabs.classList.remove('home-dropdown-open');
                tabs.classList.remove('home-dropdown-hover');
                homeDropdownOpen = false;
                // Always reload lists from storage before rendering Watchlist or Watched tab
                if (currentTab === 'watchlist' || currentTab === 'watched') {
                    // Try to load from Firebase if signed in, else from localStorage
                    if (googleUser && googleUser.profile) {
                        // Only render after async load completes
                        loadUserLists().then(() => {
                            renderMoviesForTab(currentTab);
                        });
                    } else {
                        // LocalStorage fallback
                        try {
                            const w = localStorage.getItem('watchlist');
                            const d = localStorage.getItem('watched');
                            if (w) watchlist = JSON.parse(w);
                            if (d) watched = JSON.parse(d);
                        } catch {}
                        renderMoviesForTab(currentTab);
                    }
                } else {
                    renderMoviesForTab(currentTab);
                }
            }
        }
    });
    // Show dropdown on mouseenter, hide on mouseleave
    if (homeTabBtn && homeDropdown) {
        homeTabBtn.addEventListener('mouseenter', function() {
            // Always allow hover to show menu, even after switching tabs
            currentTab = 'home';
            tabs.classList.add('home-dropdown-hover');
            tabs.classList.add('home-dropdown-open');
            homeDropdownOpen = true;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('homeTabBtn').classList.add('active');
        });
        tabs.addEventListener('mouseleave', function(e) {
            if (currentTab === 'home') {
                tabs.classList.remove('home-dropdown-hover');
                // Only close dropdown if not manually opened
                if (!homeDropdownOpen) {
                    tabs.classList.remove('home-dropdown-open');
                }
            }
        });
    }
}

if (homeTabBtn && homeDropdown) {
    // Also allow click to select Home tab and keep dropdown open
    homeTabBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Clear search box
        var searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
        // Always load Home tab and reset dropdown state
        currentTab = 'home';
        homeDropdownOpen = false;
        tabs.classList.remove('home-dropdown-open');
        tabs.classList.remove('home-dropdown-hover');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('homeTabBtn').classList.add('active');
        renderMoviesForTab('home');
    });
    document.addEventListener('click', function(e) {
        if (!tabs.contains(e.target)) {
            tabs.classList.remove('home-dropdown-open');
            tabs.classList.remove('home-dropdown-hover');
            homeDropdownOpen = false;
        }
    });
    homeDropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('home-dropdown-btn')) {
            // Clear search box
            var searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            document.querySelectorAll('.home-dropdown-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentHome = e.target.getAttribute('data-home');
            tabs.classList.remove('home-dropdown-open');
            tabs.classList.remove('home-dropdown-hover');
            homeDropdownOpen = false;
            renderMoviesForTab(currentTab);
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    fetchAllMovieLists();
    // Add Settings and About tabs dynamically if not present
    if (tabs && !document.getElementById('settingsTabBtn')) {
        const settingsTab = document.createElement('button');
        settingsTab.className = 'tab-btn';
        settingsTab.id = 'settingsTabBtn';
        settingsTab.setAttribute('data-tab', 'settings');
        settingsTab.textContent = 'Settings';
        tabs.querySelector('.tab-group').appendChild(settingsTab);
    }
    if (tabs && !document.getElementById('aboutTabBtn')) {
        const aboutTab = document.createElement('button');
        aboutTab.className = 'tab-btn';
        aboutTab.id = 'aboutTabBtn';
        aboutTab.setAttribute('data-tab', 'about');
        aboutTab.textContent = 'About';
        tabs.querySelector('.tab-group').appendChild(aboutTab);
    }
    // Show home dropdown by default
    tabs.classList.add('home-dropdown-open');
    homeDropdownOpen = true;
    // Always set Home/New as active on load
    currentTab = 'home';
    currentHome = 'new';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const homeBtn = document.getElementById('homeTabBtn');
    if (homeBtn) homeBtn.classList.add('active');
    document.querySelectorAll('.home-dropdown-btn').forEach(btn => btn.classList.remove('active'));
    const newBtn = document.querySelector('.home-dropdown-btn[data-home="new"]');
    if (newBtn) newBtn.classList.add('active');
    renderMoviesForTab('home');
});

// Add minimal styling for action buttons
const style = document.createElement('style');
style.textContent = `
.tab-action-btn {
    margin: 12px 0 8px 0;
    background: #00c4ff;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 1rem;
    font-family: 'Montserrat', Arial, sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    box-shadow: 0 2px 8px rgba(0,196,255,0.08);
}
.tab-action-btn:hover {
    background: #0099cc;
}
`;
document.head.appendChild(style);
