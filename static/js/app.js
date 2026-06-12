/**
 * Mond Play — 메인 앱 모듈
 * 초기화, 네비게이션, 설정, 라우팅을 관리합니다.
 */

const App = {
    currentView: null,
    history: [],
    historyIndex: -1,
    toastTimer: null,

    async init() {
        // 앱 컨테이너를 처음엔 숨겨두고 준비 완료 후 부드럽게 페이드인
        const appEl = document.getElementById('app');
        appEl.style.opacity = '0';
        appEl.style.transition = 'opacity 0.35s ease';

        // 모듈 초기화
        Player.init();
        Equalizer.init();
        MiniPlayer.init();
        Visualizer.init();
        ContextMenu.init();
        SongInfo.init();
        Playlist.init();

        // 네비게이션 바인딩
        this._bindNavigation();
        this._bindSettings();
        this._bindSearch();

        // 데이터 로딩
        await this._loadInitialData();

        // 모두 준비됐으면 부드럽게 나타내기
        requestAnimationFrame(() => {
            appEl.style.opacity = '1';
        });
    },

    _bindNavigation() {
        // 사이드바 및 모바일 하단 네비게이션
        document.querySelectorAll('.nav-item[data-view], .mob-nav-item[data-view]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigate(view);

                // 활성 상태
                document.querySelectorAll('.nav-item, .mob-nav-item').forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.playlist-nav-item').forEach(n => n.classList.remove('active'));
                
                // 동일한 view를 가리키는 모든 버튼 활성화
                document.querySelectorAll(`.nav-item[data-view="${view}"], .mob-nav-item[data-view="${view}"]`).forEach(n => n.classList.add('active'));
            });
        });
        
        // 모바일 설정 버튼
        const mobSettingsBtn = document.querySelector('.mob-nav-item.btn-settings');
        if (mobSettingsBtn) {
            mobSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('settings-overlay').classList.remove('hidden');
                
                // 현재 활성화된 탭 유지
                document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active'));
                mobSettingsBtn.classList.add('active');
            });
        }

        // 뒤로/앞으로
        document.getElementById('btn-back').addEventListener('click', () => this.goBack());
        document.getElementById('btn-forward').addEventListener('click', () => this.goForward());
    },

    _bindSettings() {
        // 설정 열기
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
            this._loadFolders();
        });

        // 설정 닫기
        document.getElementById('btn-close-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
        });

        document.getElementById('settings-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'settings-overlay') {
                document.getElementById('settings-overlay').classList.add('hidden');
            }
        });

        // 폴더 추가
        document.getElementById('btn-add-folder').addEventListener('click', () => this._addFolder());
        document.getElementById('folder-path-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._addFolder();
        });

        // 폴더 추가: 찾아보기 버튼 (웹 모달 띄우기)
        document.getElementById('btn-browse-folder').addEventListener('click', () => {
            this._openDirBrowser();
        });

        // 환영 화면 폴더 추가
        document.getElementById('btn-add-folder-welcome').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
            this._loadFolders();
        });

        // 전체 스캔
        document.getElementById('btn-scan-all').addEventListener('click', () => this._scanAll());

        // 보관함 완전 초기화
        document.getElementById('btn-reset-library').addEventListener('click', async () => {
            if (confirm('정말로 보관함의 모든 곡 정보를 초기화하시겠습니까?\n(알림: 실제 음악 파일은 디스크에서 삭제되지 않습니다)')) {
                try {
                    await fetch('/api/settings/reset', { method: 'POST' });
                    this.showToast('보관함이 초기화되었습니다. 다시 스캔해주세요.');
                    document.getElementById('settings-overlay').classList.add('hidden');
                    // 모든 뷰 비우기
                    Library.songs = [];
                    Library.albums = [];
                    Library.artists = [];
                    this.refreshCurrentView();
                    // 환영 화면 표시
                    document.getElementById('welcome-screen').classList.remove('hidden');
                } catch (e) {
                    console.error('보관함 초기화 오류:', e);
                    this.showToast('초기화 중 오류가 발생했습니다.');
                }
            }
        });
        // 볼륨 노멀라이제이션 토글
        const normToggle = document.getElementById('norm-toggle');
        // 저장된 상태 복원
        normToggle.checked = localStorage.getItem('mp-norm') === 'true';
        normToggle.addEventListener('change', (e) => {
            Equalizer.toggleNormalization(e.target.checked);
            App.showToast(e.target.checked ? '볼륨 노멀라이제이션 ON' : '볼륨 노멀라이제이션 OFF');
        });
    },

    _bindSearch() {
        let searchTimer = null;
        const input = document.getElementById('search-input');

        input.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                const query = input.value.trim();
                if (query.length >= 2) {
                    Library.showSearchResults(query);
                } else if (query.length === 0) {
                    this.refreshCurrentView();
                }
            }, 300);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = input.value.trim();
                if (query) {
                    Library.showSearchResults(query);
                }
            }
        });
    },

    async _loadInitialData() {
        // 음악 폴더 확인
        const foldersRes = await fetch('/api/settings/folders');
        const folders = await foldersRes.json();

        if (folders.length === 0) {
            // 폴더 없음 → 환영 화면
            document.getElementById('welcome-screen').classList.remove('hidden');
            return;
        }

        // 로딩 화면
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('loading-screen').classList.remove('hidden');

        // 라이브러리 로딩
        await Promise.all([
            Library.loadSongs(),
            Library.loadAlbums(),
            Library.loadArtists(),
            Playlist.loadPlaylists()
        ]);

        document.getElementById('loading-screen').classList.add('hidden');

        if (Library.songs.length === 0) {
            // 곡 없음 → 스캔 유도
            document.getElementById('welcome-screen').classList.remove('hidden');
            document.querySelector('.welcome-content p').textContent = '폴더가 등록되어 있지만 곡이 없습니다. 라이브러리를 스캔하세요.';
            document.querySelector('#btn-add-folder-welcome').textContent = '설정에서 스캔하기';
            return;
        }

        // 기본 뷰: 노래
        this.navigate('songs');
    },

    // ─── 네비게이션 ───

    navigate(viewName) {
        switch (viewName) {
            case 'songs':
                Library.showSongsView();
                this.currentView = { type: 'songs' };
                break;
            case 'albums':
                Library.renderAlbums();
                this.currentView = { type: 'albums' };
                break;
            case 'artists':
                Library.renderArtists();
                this.currentView = { type: 'artists' };
                break;
            case 'liked':
                Library.showLikedSongs();
                this.currentView = { type: 'liked' };
                break;
            case 'recent':
                this.showSmartPlaylist('recent', '최근 추가', '/api/smart/recent');
                this.currentView = { type: 'recent' };
                break;
            case 'most-played':
                this.showSmartPlaylist('most-played', '자주 들은 곡', '/api/smart/most-played');
                this.currentView = { type: 'most-played' };
                break;
            case 'recently-played':
                this.showSmartPlaylist('recently-played', '최근 재생', '/api/smart/recently-played');
                this.currentView = { type: 'recently-played' };
                break;
            case 'stats':
                Stats.render();
                this.currentView = { type: 'stats' };
                break;
            case 'wrapped':
                Wrapped.show();
                // do not push history or change background view
                return;
        }

        this.pushHistory({ view: viewName });
    },

    refreshCurrentView() {
        if (!this.currentView) return;

        switch (this.currentView.type) {
            case 'songs': Library.showSongsView(); break;
            case 'albums': Library.renderAlbums(); break;
            case 'artists': Library.renderArtists(); break;
            case 'liked': Library.showLikedSongs(); break;
            case 'recent': this.showSmartPlaylist('recent', '최근 추가', '/api/smart/recent'); break;
            case 'most-played': this.showSmartPlaylist('most-played', '자주 들은 곡', '/api/smart/most-played'); break;
            case 'recently-played': this.showSmartPlaylist('recently-played', '최근 재생', '/api/smart/recently-played'); break;
            case 'stats': Stats.render(); break;
            case 'playlist':
                if (this.currentView.id) {
                    Playlist.showPlaylistView(this.currentView.id);
                }
                break;
        }
    },

    pushHistory(state) {
        this.historyIndex++;
        this.history = this.history.slice(0, this.historyIndex);
        this.history.push(state);
    },

    goBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this._restoreState(state);
        }
    },

    goForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this._restoreState(state);
        }
    },

    _restoreState(state) {
        if (state.view === 'album-detail') {
            Library.showAlbumDetail(state.album, state.artist);
        } else if (state.view === 'artist-detail') {
            Library.showArtistDetail(state.artist);
        } else {
            this.navigate(state.view);
        }
    },

    // ─── 스마트 플레이리스트 ───

    async showSmartPlaylist(type, title, apiUrl) {
        Library._hideAllViews();
        const viewId = `view-${type}`;
        const view = document.getElementById(viewId);
        view.classList.remove('hidden');

        try {
            const res = await fetch(apiUrl);
            const songs = await res.json();

            const countId = type === 'most-played' ? 'most-played-count'
                          : type === 'recently-played' ? 'recently-played-count'
                          : 'recent-count';
            document.getElementById(countId).textContent = `${songs.length}곡`;

            const containerId = type === 'most-played' ? 'most-played-songs-list'
                              : type === 'recently-played' ? 'recently-played-songs-list'
                              : 'recent-songs-list';
            const container = document.getElementById(containerId);

            const showPlays = type === 'most-played';
            Library.renderSongs(songs, container, {
                showGenre: false, showYear: false, showPlays
            });
        } catch (e) {
            console.error(`스마트 플레이리스트 로딩 오류 (${type}):`, e);
        }
    },

    // ─── 설정 ───

    async _loadFolders() {
        const res = await fetch('/api/settings/folders');
        const folders = await res.json();

        const container = document.getElementById('folder-list');
        container.innerHTML = '';

        folders.forEach(folder => {
            const item = document.createElement('div');
            item.className = 'folder-item';
            item.innerHTML = `
                <span>${folder.path}</span>
                <button class="btn-icon" data-folder-id="${folder.id}" title="제거">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;

            const removeBtn = item.querySelector('button');
            removeBtn.addEventListener('click', async () => {
                await fetch(`/api/settings/folders/${folder.id}`, { method: 'DELETE' });
                this._loadFolders();
                this.showToast('폴더가 제거되었습니다');
            });

            container.appendChild(item);
        });

        if (folders.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); font-size: 13px; text-align: center; padding: 12px;">등록된 폴더가 없습니다</p>';
        }
    },

    async _addFolder() {
        const input = document.getElementById('folder-path-input');
        const path = input.value.trim();

        if (!path) {
            this.showToast('폴더 경로를 입력하세요');
            return;
        }

        const res = await fetch('/api/settings/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });

        const data = await res.json();

        if (res.ok) {
            input.value = '';
            this._loadFolders();
            this.showToast('폴더가 추가되었습니다. 스캔을 시작합니다...');
            await this._scanAll();
        } else {
            this.showToast(data.error || '폴더 추가에 실패했습니다');
        }
    },

    async _scanAll() {
        const scanBtn = document.getElementById('btn-scan-all');
        const progressContainer = document.getElementById('scan-progress-container');
        const progressBar = document.getElementById('scan-progress-bar');
        const statusText = document.getElementById('scan-status-text');
        const countText = document.getElementById('scan-count-text');
        
        scanBtn.disabled = true;
        scanBtn.style.display = 'none';
        progressContainer.style.display = 'block';
        
        statusText.innerHTML = '스캔 준비 중... <span id="scan-current-file" style="opacity: 0.6; margin-left: 6px;"></span>';
        progressBar.style.width = '0%';
        countText.textContent = '';

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (data.error) {
                this.showToast(data.error);
                this._resetScanUI();
                return;
            }

            // 폴링으로 진행 상황 추적
            const pollInterval = setInterval(async () => {
                try {
                    const statusRes = await fetch('/api/scan/status');
                    const status = await statusRes.json();

                    if (status.running) {
                        if (status.total > 0) {
                            const percent = Math.min(100, Math.round((status.current / status.total) * 100));
                            document.getElementById('scan-status-text').childNodes[0].nodeValue = '파일 스캔 중... ';
                            document.getElementById('scan-current-file').textContent = status.current_file || '';
                            countText.textContent = `${status.current} / ${status.total} (${percent}%)`;
                            progressBar.style.width = `${percent}%`;
                        } else {
                            document.getElementById('scan-status-text').childNodes[0].nodeValue = '디렉토리 검색 중... ';
                        }
                    } else {
                        // 스캔 완료
                        clearInterval(pollInterval);
                        this.showToast(`${status.scanned}곡을 스캔했습니다`);

                        // 라이브러리 새로고침
                        await Promise.all([
                            Library.loadSongs(),
                            Library.loadAlbums(),
                            Library.loadArtists(),
                            Playlist.loadPlaylists()
                        ]);

                        document.getElementById('welcome-screen').classList.add('hidden');
                        this._resetScanUI();
                        this.navigate('songs');

                        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                        document.getElementById('nav-songs').classList.add('active');
                        this._resetScanButton(scanBtn);
                    }
                } catch (e) {
                    clearInterval(pollInterval);
                    scanBtn.disabled = false;
                    this._resetScanButton(scanBtn);
                }
            }, 500);

        } catch (e) {
            console.error('스캔 오류:', e);
            this.showToast('스캔 중 오류가 발생했습니다');
            scanBtn.disabled = false;
            this._resetScanButton(scanBtn);
        }
    },

    _resetScanButton(btn) {
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            라이브러리 다시 스캔
        `;
    },

    // ─── 토스트 알림 ───

    showToast(message, duration = 3000) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        clearTimeout(this.toastTimer);

        // 표시
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // 숨기기
        this.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    // ─── 웹 디렉토리 탐색기 (Directory Browser) 로직 ───
    _openDirBrowser() {
        const modal = document.getElementById('dir-browser-modal');
        modal.classList.remove('hidden');
        
        if (!this._dirBrowserBound) {
            document.getElementById('btn-close-dir-browser').addEventListener('click', () => this._closeDirBrowser());
            document.getElementById('btn-cancel-dir').addEventListener('click', () => this._closeDirBrowser());
            document.getElementById('btn-select-dir').addEventListener('click', () => {
                const currentPath = document.getElementById('dir-current-path').textContent;
                document.getElementById('folder-path-input').value = currentPath;
                this._closeDirBrowser();
            });
            this._dirBrowserBound = true;
        }
        
        this._loadDirList('');
    },

    _closeDirBrowser() {
        document.getElementById('dir-browser-modal').classList.add('hidden');
    },

    async _loadDirList(path) {
        const container = document.getElementById('dir-list-container');
        const pathEl = document.getElementById('dir-current-path');
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-sec); font-size: 13px;">로딩 중...</div>';
        
        try {
            const url = path ? `/api/tools/directories?path=${encodeURIComponent(path)}` : '/api/tools/directories';
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.error) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--error); font-size: 13px;">${data.error}</div>`;
                return;
            }
            
            pathEl.textContent = data.current_path;
            pathEl.title = data.current_path;
            
            if (data.directories.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-sec); font-size: 13px;">하위 폴더가 없습니다.</div>';
                return;
            }
            
            container.innerHTML = '';
            data.directories.forEach(dir => {
                const el = document.createElement('div');
                el.className = 'dir-item';
                
                let icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
                if (dir.name === '..') {
                    icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
                    el.innerHTML = `${icon}<span>상위 폴더로 이동</span>`;
                } else {
                    el.innerHTML = `${icon}<span>${dir.name}</span>`;
                }
                
                el.addEventListener('click', () => {
                    this._loadDirList(dir.path);
                });
                container.appendChild(el);
            });
        } catch (e) {
            console.error("디렉토리 로드 오류:", e);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--error); font-size: 13px;">경로를 불러올 수 없습니다.</div>';
        }
    }
};

// ─── 앱 시작 ───
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
