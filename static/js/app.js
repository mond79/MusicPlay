/**
 * Music Play — 메인 앱 모듈
 * 초기화, 네비게이션, 설정, 라우팅을 관리합니다.
 */

const App = {
    currentView: null,
    history: [],
    historyIndex: -1,
    toastTimer: null,

    async init() {
        console.log('🎵 Music Play 초기화 중...');

        // 모듈 초기화
        Player.init();
        ContextMenu.init();
        SongInfo.init();
        Playlist.init();

        // 네비게이션 바인딩
        this._bindNavigation();
        this._bindSettings();
        this._bindSearch();

        // 데이터 로딩
        await this._loadInitialData();

        console.log('🎵 Music Play 준비 완료!');
    },

    _bindNavigation() {
        // 사이드바 네비게이션
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigate(view);

                // 활성 상태
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.playlist-nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            });
        });

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

        // 폴더 추가: 찾아보기 버튼
        document.getElementById('btn-browse-folder').addEventListener('click', async () => {
            try {
                const res = await fetch('/api/tools/browse-folder');
                const data = await res.json();
                if (data.path) {
                    document.getElementById('folder-path-input').value = data.path;
                }
            } catch (e) {
                console.error("폴더 선택 오류:", e);
                this.showToast('폴더 선택 창을 띄울 수 없습니다');
            }
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
        scanBtn.disabled = true;
        scanBtn.textContent = '스캔 중...';

        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (data.success) {
                this.showToast(`${data.scanned}곡을 스캔했습니다`);
            } else {
                this.showToast(data.error || '스캔 실패');
            }

            // 라이브러리 새로고침
            await Promise.all([
                Library.loadSongs(),
                Library.loadAlbums(),
                Library.loadArtists(),
                Playlist.loadPlaylists()
            ]);

            // 환영 화면 닫기 → 노래 뷰
            document.getElementById('welcome-screen').classList.add('hidden');
            this.navigate('songs');

            // 사이드바 활성화
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById('nav-songs').classList.add('active');

        } catch (e) {
            console.error('스캔 오류:', e);
            this.showToast('스캔 중 오류가 발생했습니다');
        }

        scanBtn.disabled = false;
        scanBtn.innerHTML = `
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
    }
};

// ─── 앱 시작 ───
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
