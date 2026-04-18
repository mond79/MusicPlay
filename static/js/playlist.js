/**
 * Mond Play — 플레이리스트 관리 모듈
 */

const Playlist = {
    playlists: [],

    init() {
        this._bindEvents();
    },

    async loadPlaylists() {
        try {
            const res = await fetch('/api/playlists');
            this.playlists = await res.json();
            this._renderSidebar();
            return this.playlists;
        } catch (e) {
            console.error('플레이리스트 로딩 오류:', e);
            return [];
        }
    },

    _bindEvents() {
        // 새 플레이리스트 생성
        document.getElementById('btn-create-playlist').addEventListener('click', async () => {
            const name = prompt('새 플레이리스트 이름:');
            if (name && name.trim()) {
                await fetch('/api/playlists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name.trim() })
                });
                await this.loadPlaylists();
                App.showToast(`"${name.trim()}" 플레이리스트가 생성되었습니다`);
            }
        });
    },

    _renderSidebar() {
        const container = document.getElementById('playlist-list');
        container.innerHTML = '';

        this.playlists.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'playlist-nav-item';
            item.dataset.playlistId = pl.id;

            item.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <span>${this._escapeHtml(pl.name)}</span>
            `;

            item.addEventListener('click', () => {
                this.showPlaylistView(pl.id);
                // 네비게이션 활성화
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.querySelectorAll('.playlist-nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            });

            // 우클릭으로 삭제/이름변경
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this._showPlaylistContextMenu(e, pl);
            });

            container.appendChild(item);
        });
    },

    async showPlaylistView(playlistId) {
        Library._hideAllViews();
        const view = document.getElementById('view-playlist');
        view.classList.remove('hidden');

        const playlist = this.playlists.find(p => p.id == playlistId);
        document.getElementById('playlist-view-name').textContent = playlist ? playlist.name : '';

        const res = await fetch(`/api/playlists/${playlistId}/songs`);
        const songs = await res.json();

        document.getElementById('playlist-count').textContent = `${songs.length}곡`;

        const container = document.getElementById('playlist-songs-list');
        Library.renderSongs(songs, container, {
            showGenre: false, showYear: false, showPlays: false,
            playlistId: playlistId, contextType: 'playlist'
        });

        App.currentView = { type: 'playlist', id: playlistId };
    },

    _showPlaylistContextMenu(e, playlist) {
        // 간단한 커스텀 메뉴
        const existing = document.getElementById('playlist-ctx-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'playlist-ctx-menu';
        menu.className = 'context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        menu.innerHTML = `
            <ul>
                <li class="context-item" id="pl-ctx-export"><span>M3U 내보내기 📥</span></li>
                <li class="context-item" id="pl-ctx-rename"><span>이름 변경</span></li>
                <li class="context-divider"></li>
                <li class="context-item context-danger" id="pl-ctx-delete"><span>삭제</span></li>
            </ul>
        `;

        document.body.appendChild(menu);

        menu.querySelector('#pl-ctx-export').addEventListener('click', () => {
            window.location.href = `/api/playlists/${playlist.id}/m3u`;
            App.showToast('플레이리스트 다운로드를 시작합니다');
            menu.remove();
        });

        menu.querySelector('#pl-ctx-rename').addEventListener('click', async () => {
            const name = prompt('새 이름:', playlist.name);
            if (name && name.trim()) {
                await fetch(`/api/playlists/${playlist.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name.trim() })
                });
                await this.loadPlaylists();
                App.showToast('이름이 변경되었습니다');
            }
            menu.remove();
        });

        menu.querySelector('#pl-ctx-delete').addEventListener('click', async () => {
            if (confirm(`"${playlist.name}" 플레이리스트를 삭제하시겠습니까?`)) {
                await fetch(`/api/playlists/${playlist.id}`, { method: 'DELETE' });
                await this.loadPlaylists();
                App.showToast('플레이리스트가 삭제되었습니다');
                // 현재 플레이리스트를 보고 있었다면 노래 뷰로 전환
                if (App.currentView?.type === 'playlist' && App.currentView?.id == playlist.id) {
                    App.navigate('songs');
                }
            }
            menu.remove();
        });

        // 외부 클릭으로 닫기
        setTimeout(() => {
            const closeHandler = (ev) => {
                if (!menu.contains(ev.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    },

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
