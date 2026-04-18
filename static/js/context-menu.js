/**
 * Mond Play — 우클릭 컨텍스트 메뉴 모듈
 * 10가지 메뉴 항목 처리
 */

const ContextMenu = {
    menuEl: null,
    currentSong: null,
    currentContext: null,

    init() {
        this.menuEl = document.getElementById('context-menu');
        this._bindEvents();
    },

    _bindEvents() {
        // 메뉴 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            if (!this.menuEl.contains(e.target)) {
                this.hide();
            }
        });

        document.addEventListener('contextmenu', (e) => {
            // 곡 아이템이 아닌 곳에서 우클릭하면 메뉴 닫기
            if (!e.target.closest('.song-item') && !e.target.closest('.queue-item')) {
                this.hide();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });

        // 메뉴 항목 클릭 이벤트
        document.getElementById('ctx-play-next').addEventListener('click', () => {
            if (this.currentSong) {
                Player.playNext(this.currentSong);
            }
            this.hide();
        });

        document.getElementById('ctx-play-last').addEventListener('click', () => {
            if (this.currentSong) {
                Player.playLast(this.currentSong);
            }
            this.hide();
        });

        document.getElementById('ctx-song-info').addEventListener('click', () => {
            if (this.currentSong) {
                SongInfo.open(this.currentSong.id);
            }
            this.hide();
        });

        document.getElementById('ctx-like').addEventListener('click', async () => {
            if (this.currentSong) {
                const res = await fetch(`/api/songs/${this.currentSong.id}/like`, { method: 'POST' });
                const data = await res.json();
                this.currentSong.liked = data.liked;
                this.currentSong.disliked = 0;
                Library.updateSongLike(this.currentSong.id, data.liked);
                App.showToast(data.liked ? '좋아요를 표시했습니다 ♥' : '좋아요를 해제했습니다');
            }
            this.hide();
        });

        document.getElementById('ctx-dislike').addEventListener('click', async () => {
            if (this.currentSong) {
                const res = await fetch(`/api/songs/${this.currentSong.id}/dislike`, { method: 'POST' });
                const data = await res.json();
                this.currentSong.disliked = data.disliked;
                this.currentSong.liked = 0;
                Library.updateSongLike(this.currentSong.id, 0);
                App.showToast(data.disliked ? '나빠요를 표시했습니다 👎' : '나빠요를 해제했습니다');
            }
            this.hide();
        });

        document.getElementById('ctx-go-album').addEventListener('click', () => {
            if (this.currentSong && this.currentSong.album) {
                Library.showAlbumDetail(
                    this.currentSong.album,
                    this.currentSong.album_artist || this.currentSong.artist
                );
                this._setActiveNav('');
            }
            this.hide();
        });

        document.getElementById('ctx-copy').addEventListener('click', () => {
            if (this.currentSong) {
                const text = `${this.currentSong.title} — ${this.currentSong.artist}`;
                navigator.clipboard.writeText(text).then(() => {
                    App.showToast('클립보드에 복사되었습니다');
                });
            }
            this.hide();
        });

        document.getElementById('ctx-remove-playlist').addEventListener('click', async () => {
            if (this.currentSong && this.currentContext?.playlistId) {
                await fetch(
                    `/api/playlists/${this.currentContext.playlistId}/songs/${this.currentSong.id}`,
                    { method: 'DELETE' }
                );
                App.showToast('플레이리스트에서 제거되었습니다');
                Playlist.showPlaylistView(this.currentContext.playlistId);
                await Playlist.loadPlaylists();
            }
            this.hide();
        });

        document.getElementById('ctx-delete').addEventListener('click', async () => {
            if (this.currentSong) {
                if (confirm(`"${this.currentSong.title}"을(를) 보관함에서 삭제하시겠습니까?`)) {
                    await fetch(`/api/songs/${this.currentSong.id}`, { method: 'DELETE' });
                    App.showToast('보관함에서 삭제되었습니다');
                    // 라이브러리 전체 새로고침
                    await Promise.all([
                        Library.loadSongs(),
                        Library.loadAlbums(),
                        Library.loadArtists(),
                        Playlist.loadPlaylists()
                    ]);
                    
                    // 현재 상세 뷰인 경우 해당 뷰 새로고침, 아니면 일반 뷰 새로고침
                    const state = App.history[App.historyIndex];
                    if (state && state.view === 'album-detail') {
                        await Library.showAlbumDetail(state.album, state.artist);
                    } else if (state && state.view === 'artist-detail') {
                        await Library.showArtistDetail(state.artist);
                    } else {
                        App.refreshCurrentView();
                    }
                }
            }
            this.hide();
        });
    },

    show(e, song, context = {}) {
        this.currentSong = song;
        this.currentContext = context;

        // 플레이리스트 서브메뉴 업데이트
        this._updatePlaylistSubmenu();

        // 플레이리스트에서 제거 버튼 표시 여부
        const removeBtn = document.getElementById('ctx-remove-playlist');
        if (context.playlistId) {
            removeBtn.style.display = 'flex';
        } else {
            removeBtn.style.display = 'none';
        }

        // 좋아요/나빠요 라벨 업데이트
        const likeSpan = document.querySelector('#ctx-like span');
        likeSpan.textContent = song.liked ? '좋아요 해제' : '좋아요';
        const dislikeSpan = document.querySelector('#ctx-dislike span');
        dislikeSpan.textContent = song.disliked ? '나빠요 해제' : '나빠요';

        // 위치 계산
        const menuWidth = 240;
        const menuHeight = 380;
        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 8;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 8;
        }

        this.menuEl.style.left = `${x}px`;
        this.menuEl.style.top = `${y}px`;
        this.menuEl.classList.remove('hidden');
    },

    hide() {
        this.menuEl.classList.add('hidden');
        this.currentSong = null;
        this.currentContext = null;
        // 다중 선택 메뉴 숨기기
        const multiMenu = document.getElementById('multi-context-menu');
        if (multiMenu) multiMenu.classList.add('hidden');
    },

    showMulti(e, songs) {
        this.hide(); // 일반 메뉴 닫기
        
        let menu = document.getElementById('multi-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'multi-context-menu';
            menu.className = 'context-menu';
            menu.innerHTML = `
                <div class="ctx-header" style="padding: 8px 12px; font-size: 12px; color: var(--text-tertiary); border-bottom: 1px solid var(--border);"></div>
                <div class="ctx-item" id="multi-play">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>선택 곡 재생</span>
                </div>
                <div class="ctx-item" id="multi-queue">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <span>대기열에 추가</span>
                </div>
                <div class="ctx-divider"></div>
                <div class="ctx-item" id="multi-delete" style="color: var(--error);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>선택 곡 삭제</span>
                </div>
            `;
            document.body.appendChild(menu);

            menu.querySelector('#multi-play').addEventListener('click', () => {
                Player.play(Library.selectedSongs[0], Library.selectedSongs, 0);
                Library.clearSelection();
                this.hide();
            });
            menu.querySelector('#multi-queue').addEventListener('click', () => {
                Library.selectedSongs.forEach(s => Player.playLast(s));
                App.showToast(`${Library.selectedSongs.length}곡을 대기열에 추가했습니다`);
                Library.clearSelection();
                this.hide();
            });
            menu.querySelector('#multi-delete').addEventListener('click', async () => {
                const count = Library.selectedSongs.length;
                if (confirm(`선택된 ${count}곡을 보관함에서 삭제하시겠습니까?`)) {
                    for (const s of Library.selectedSongs) {
                        await fetch(`/api/songs/${s.id}`, { method: 'DELETE' });
                    }
                    App.showToast(`${count}곡이 삭제되었습니다`);
                    Library.clearSelection();
                    await Promise.all([Library.loadSongs(), Library.loadAlbums(), Library.loadArtists()]);
                    App.refreshCurrentView();
                }
                this.hide();
            });
        }

        menu.querySelector('.ctx-header').textContent = `${songs.length}곡 선택됨`;

        // 위치 계산
        let x = e.clientX, y = e.clientY;
        if (x + 200 > window.innerWidth) x = window.innerWidth - 208;
        if (y + 200 > window.innerHeight) y = window.innerHeight - 208;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');
    },

    async _updatePlaylistSubmenu() {
        const submenu = document.getElementById('ctx-playlist-submenu');
        let html = '';

        // 새 플레이리스트 항목
        html += `<li class="submenu-item submenu-new-playlist" id="ctx-new-playlist-add">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>새 플레이리스트...</span>
        </li>`;

        // 기존 플레이리스트
        try {
            const res = await fetch('/api/playlists');
            const playlists = await res.json();

            if (playlists.length > 0) {
                html += '<li class="submenu-divider"></li>';
                playlists.forEach(pl => {
                    html += `<li class="submenu-item" data-playlist-id="${pl.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                        <span>${this._escapeHtml(pl.name)}</span>
                    </li>`;
                });
            }
        } catch (e) {
            console.error('플레이리스트 로딩 오류:', e);
        }

        submenu.innerHTML = html;

        // 이벤트 바인딩
        const newPlBtn = submenu.querySelector('#ctx-new-playlist-add');
        if (newPlBtn) {
            newPlBtn.addEventListener('click', async () => {
                const name = prompt('새 플레이리스트 이름:');
                if (name) {
                    const res = await fetch('/api/playlists', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    });
                    const pl = await res.json();
                    await fetch(`/api/playlists/${pl.id}/songs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ song_id: this.currentSong.id })
                    });
                    App.showToast(`"${name}" 플레이리스트에 추가되었습니다`);
                    await Playlist.loadPlaylists();
                }
                this.hide();
            });
        }

        submenu.querySelectorAll('.submenu-item[data-playlist-id]').forEach(item => {
            item.addEventListener('click', async () => {
                const plId = item.dataset.playlistId;
                await fetch(`/api/playlists/${plId}/songs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ song_id: this.currentSong.id })
                });
                App.showToast(`플레이리스트에 추가되었습니다`);
                this.hide();
            });
        });
    },

    _setActiveNav(viewName) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if (viewName) {
            const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
            if (nav) nav.classList.add('active');
        }
    },

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
