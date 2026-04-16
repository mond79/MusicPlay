/**
 * Music Play — 라이브러리 UI 모듈
 * 노래, 앨범, 아티스트 뷰를 렌더링합니다.
 */

const Library = {
    songs: [],
    albums: [],
    artists: [],

    async loadSongs() {
        try {
            const res = await fetch('/api/songs');
            this.songs = await res.json();
            return this.songs;
        } catch (e) {
            console.error('노래 로딩 오류:', e);
            return [];
        }
    },

    async loadAlbums() {
        try {
            const res = await fetch('/api/albums');
            this.albums = await res.json();
            return this.albums;
        } catch (e) {
            console.error('앨범 로딩 오류:', e);
            return [];
        }
    },

    async loadArtists() {
        try {
            const res = await fetch('/api/artists');
            this.artists = await res.json();
            return this.artists;
        } catch (e) {
            console.error('아티스트 로딩 오류:', e);
            return [];
        }
    },

    // ─── 노래 뷰 ───

    renderSongs(songs, container, options = {}) {
        const { showArtist = true, showAlbum = true, showGenre = true, showYear = true,
                showPlays = true, playlistId = null, contextType = 'library' } = options;

        if (!container) return;
        container.innerHTML = '';

        songs.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'song-item';
            item.dataset.songId = song.id;
            item.dataset.index = index;

            if (contextType === 'playlist') {
                item.dataset.psId = song.ps_id;
                item.draggable = true;
            }

            if (Player.currentSong() && Player.currentSong().id === song.id) {
                item.classList.add('playing');
            }

            let cols = '';

            // 번호
            cols += `<div class="song-num">${index + 1}</div>`;

            // 제목 + 미니 커버
            cols += `
                <div class="song-title-cell">
                    <img class="song-mini-cover" src="/api/songs/${song.id}/cover" alt=""
                         onerror="this.style.background='var(--surface)'; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23555%22 stroke-width=%221.5%22><path d=%22M9 18V5l12-2v13%22/><circle cx=%226%22 cy=%2218%22 r=%223%22/><circle cx=%2218%22 cy=%2216%22 r=%223%22/></svg>'">
                    <span class="song-title">${this._escapeHtml(song.title || '알 수 없는 곡')}</span>
                </div>
            `;

            // 아티스트 (조건부)
            if (showArtist) {
                cols += `<div class="song-cell clickable-link artist-link">${this._escapeHtml(song.artist)}</div>`;
            }

            // 앨범 (조건부)
            if (showAlbum) {
                cols += `<div class="song-cell clickable-link album-link">${this._escapeHtml(song.album)}</div>`;
            }

            // 장르 (조건부)
            if (showGenre) {
                cols += `<div class="song-cell">${this._escapeHtml(song.genre)}</div>`;
            }

            // 연도 (조건부)
            if (showYear) {
                cols += `<div class="song-cell">${song.year || ''}</div>`;
            }

            // 시간
            cols += `<div class="song-duration">${this._formatTime(song.duration)}</div>`;

            // 재생횟수 (조건부)
            if (showPlays) {
                cols += `<div class="song-plays">${song.play_count || ''}</div>`;
            }

            // 좋아요
            const likeClass = song.liked ? 'liked' : '';
            const likeFill = song.liked ? 'var(--accent)' : 'none';
            cols += `
                <button class="song-like-btn ${likeClass}" data-song-id="${song.id}" title="좋아요">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${likeFill}" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            `;

            item.innerHTML = cols;

            // 아티스트/앨범 링크 클릭 이벤트
            const artistLink = item.querySelector('.artist-link');
            if (artistLink) {
                artistLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showArtistDetail(song.artist);
                });
            }
            const albumLink = item.querySelector('.album-link');
            if (albumLink) {
                albumLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showAlbumDetail(song.album, song.album_artist || song.artist);
                });
            }

            // 더블클릭으로 재생
            item.addEventListener('dblclick', () => {
                Player.play(song, songs, index);
            });

            // 우클릭 메뉴
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ContextMenu.show(e, song, { playlistId, contextType, songs, index });
            });

            // 좋아요 버튼 클릭
            const likeBtn = item.querySelector('.song-like-btn');
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const res = await fetch(`/api/songs/${song.id}/like`, { method: 'POST' });
                const data = await res.json();
                song.liked = data.liked;
                song.disliked = 0;
                this.updateSongLike(song.id, data.liked);
            });

            // 플레이리스트 드래그 앤 드롭 정렬 로직
            if (contextType === 'playlist') {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', index);
                    e.dataTransfer.effectAllowed = 'move';
                    item.classList.add('dragging');
                });
                
                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    container.querySelectorAll('.song-item').forEach(el => el.classList.remove('drag-over', 'drag-over-bottom'));
                });
                
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.classList.add('drag-over');
                        item.classList.remove('drag-over-bottom');
                    } else {
                        item.classList.remove('drag-over');
                        item.classList.add('drag-over-bottom');
                    }
                });
                
                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over', 'drag-over-bottom');
                });
                
                item.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over', 'drag-over-bottom');
                    
                    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (dragIndex === index) return;
                    
                    const draggedSong = songs.splice(dragIndex, 1)[0];
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    // 드롭할 인덱스 계산
                    let insertIndex = e.clientY < midY ? index : index + 1;
                    if (dragIndex < insertIndex) insertIndex--; // 배열이 하나 빠졌으므로 보정
                    
                    songs.splice(insertIndex, 0, draggedSong);
                    
                    // 리렌더링
                    this.renderSongs(songs, container, { playlistId, contextType, showAlbum, showGenre, showYear, showPlays });
                    
                    // 서버에 새 순서 저장 (ps_id 배열 전송)
                    const psIds = songs.map(s => s.ps_id);
                    await fetch(`/api/playlists/${playlistId}/reorder`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ps_ids: psIds })
                    });
                });
            }

            container.appendChild(item);
        });
    },

    showSongsView() {
        this._hideAllViews();
        const view = document.getElementById('view-songs');
        view.classList.remove('hidden');
        document.getElementById('songs-count').textContent = `${this.songs.length}곡`;

        const sortSelect = document.getElementById('songs-sort');
        const render = () => {
            const sorted = this._sortSongs([...this.songs], sortSelect.value);
            const container = document.getElementById('songs-list');
            this.renderSongs(sorted, container);
        };

        sortSelect.onchange = render;
        render();
    },

    _sortSongs(songs, key) {
        switch (key) {
            case 'title':
                return songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
            case 'artist':
                return songs.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'ko'));
            case 'album':
                return songs.sort((a, b) => (a.album || '').localeCompare(b.album || '', 'ko'));
            case 'recent':
                return songs.sort((a, b) => (b.id || 0) - (a.id || 0));
            case 'year-desc':
                return songs.sort((a, b) => (b.year || 0) - (a.year || 0));
            case 'year-asc':
                return songs.sort((a, b) => (a.year || 0) - (b.year || 0));
            case 'plays':
                return songs.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
            case 'duration':
                return songs.sort((a, b) => (b.duration || 0) - (a.duration || 0));
            default:
                return songs;
        }
    },

    // ─── 앨범 뷰 ───

    renderAlbums() {
        this._hideAllViews();
        const view = document.getElementById('view-albums');
        view.classList.remove('hidden');
        document.getElementById('albums-count').textContent = `${this.albums.length}개`;

        const grid = document.getElementById('albums-grid');
        grid.innerHTML = '';

        this.albums.forEach(album => {
            const card = document.createElement('div');
            card.className = 'album-card';

            card.innerHTML = `
                <div class="album-cover">
                    <img src="/api/songs/${album.first_song_id}/cover" alt="${this._escapeHtml(album.album)}"
                         onerror="this.parentElement.innerHTML='<div class=\\'album-no-cover\\'><svg width=\\'48\\' height=\\'48\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%23555\\' stroke-width=\\'1\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'4\\'/><circle cx=\\'12\\' cy=\\'12\\' r=\\'1\\'/></svg></div>'">
                    <div class="play-overlay">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    </div>
                </div>
                <div class="album-info">
                    <div class="album-name">${this._escapeHtml(album.album)}</div>
                    <div class="album-artist-name">${this._escapeHtml(album.album_artist || album.artist)}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.showAlbumDetail(album.album, album.album_artist || album.artist);
            });

            grid.appendChild(card);
        });
    },

    async showAlbumDetail(albumName, artistName) {
        this._hideAllViews();
        const view = document.getElementById('view-album-detail');
        view.classList.remove('hidden');

        // 앨범 정보
        const res = await fetch(`/api/albums/${encodeURIComponent(albumName)}?artist=${encodeURIComponent(artistName)}`);
        const songs = await res.json();

        if (songs.length === 0) return;

        const firstSong = songs[0];

        document.getElementById('album-detail-name').textContent = albumName;
        document.getElementById('album-detail-artist').textContent = artistName;

        const totalDuration = songs.reduce((s, song) => s + (song.duration || 0), 0);
        const year = firstSong.year || '';
        document.getElementById('album-detail-meta').textContent =
            `${year ? year + ' · ' : ''}${songs.length}곡 · ${this._formatTime(totalDuration)}`;

        const img = document.getElementById('album-detail-img');
        img.src = `/api/songs/${firstSong.id}/cover`;
        img.onerror = () => { img.style.display = 'none'; };

        // 앨범 색상
        if (firstSong.dominant_color) {
            ColorTheme.setColor(firstSong.dominant_color);
        }

        // 곡 목록
        const container = document.getElementById('album-detail-songs');
        this.renderSongs(songs, container, {
            showAlbum: false, showGenre: false, showYear: false
        });

        // 재생 버튼
        document.getElementById('btn-play-album').onclick = () => {
            Player.play(songs[0], songs, 0);
        };
        document.getElementById('btn-shuffle-album').onclick = () => {
            const shuffled = [...songs].sort(() => Math.random() - 0.5);
            Player.play(shuffled[0], shuffled, 0);
        };

        // 네비게이션 히스토리
        App.pushHistory({ view: 'album-detail', album: albumName, artist: artistName });
    },

    // ─── 아티스트 뷰 ───

    renderArtists() {
        this._hideAllViews();
        const view = document.getElementById('view-artists');
        view.classList.remove('hidden');
        document.getElementById('artists-count').textContent = `${this.artists.length}명`;

        const grid = document.getElementById('artists-grid');
        grid.innerHTML = '';

        this.artists.forEach(artist => {
            const card = document.createElement('div');
            card.className = 'artist-card';
            const imageUrl = `/api/artists/${encodeURIComponent(artist.artist)}/image?t=${window.artistImageCache || 0}`;

            card.innerHTML = `
                <div class="artist-avatar-card">
                    <img src="${imageUrl}" alt="${this._escapeHtml(artist.artist)}" 
                         onerror="this.parentElement.innerHTML='<svg width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#666\\' stroke-width=\\'1.5\\'><path d=\\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\\'/><circle cx=\\'12\\' cy=\\'7\\' r=\\'4\\'/></svg>'">
                </div>
                <div class="artist-name">${this._escapeHtml(artist.artist)}</div>
                <div class="artist-meta">${artist.album_count}개 앨범 · ${artist.song_count}곡</div>
            `;

            card.addEventListener('click', () => {
                this.showArtistDetail(artist.artist);
            });

            grid.appendChild(card);
        });
    },

    async showArtistDetail(artistName) {
        this._hideAllViews();
        const view = document.getElementById('view-artist-detail');
        view.classList.remove('hidden');

        document.getElementById('artist-detail-name').textContent = artistName;

        // 이미지 및 배너 설정
        const imageUrl = `/api/artists/${encodeURIComponent(artistName)}/image?t=${window.artistImageCache || 0}`;
        const heroBg = document.getElementById('artist-hero-bg');
        heroBg.style.backgroundImage = `url('${imageUrl}')`;

        const res = await fetch(`/api/artists/${encodeURIComponent(artistName)}`);
        const songs = await res.json();

        document.getElementById('artist-detail-meta').textContent = `${songs.length}곡`;
        
        // 재생 버튼 바인딩
        document.getElementById('btn-play-artist').onclick = () => {
            if (songs.length > 0) Player.play(songs[0], songs, 0);
        };
        document.getElementById('btn-shuffle-artist').onclick = () => {
            if (songs.length > 0) {
                const shuffled = [...songs].sort(() => Math.random() - 0.5);
                Player.play(shuffled[0], shuffled, 0);
            }
        };

        // 이미지 업로드 로직 (중복 바인딩을 피하기 위해 요소 복제/교체)
        const uploadBtn = document.getElementById('artist-hero-banner');
        const newUploadBtn = uploadBtn.cloneNode(true);
        uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
        const newFileInput = document.getElementById('artist-image-upload');

        newUploadBtn.onclick = () => newFileInput.click();

        newFileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('image', file);

            try {
                const uploadRes = await fetch(`/api/artists/${encodeURIComponent(artistName)}/image`, {
                    method: 'PUT',
                    body: formData
                });

                if (uploadRes.ok) {
                    window.artistImageCache = Date.now();
                    const newImageUrl = `/api/artists/${encodeURIComponent(artistName)}/image?t=${window.artistImageCache}`;
                    document.getElementById('artist-hero-bg').style.backgroundImage = `url('${newImageUrl}')`;
                    ColorTheme.extractFromImage(newImageUrl); // 배경색도 연동 동기화
                } else {
                    alert('사진 업로드에 실패했습니다.');
                }
            } catch (err) {
                console.error(err);
                alert('업로드 오류가 발생했습니다.');
            }
            newFileInput.value = ''; // 초기화
        };

        const container = document.getElementById('artist-detail-songs');
        this.renderSongs(songs, container, {
            showArtist: false, showGenre: false, showYear: false
        });

        // --- 아티스트 상세패널 (Bio/Credits/Stats) 로직 ---
        document.getElementById('bio-artist-name').textContent = artistName;
        
        let totalPlays = 0;
        const composers = new Set();
        const lyricists = new Set();
        
        songs.forEach(song => {
            totalPlays += song.play_count || 0;
            if (song.composer) {
                song.composer.split(/[,&/]/).map(s => s.trim()).filter(s => s).forEach(c => composers.add(c));
            }
            if (song.lyricist) {
                song.lyricist.split(/[,&/]/).map(s => s.trim()).filter(s => s).forEach(l => lyricists.add(l));
            }
        });
        
        document.getElementById('bio-play-count').textContent = totalPlays.toLocaleString();
        
        const compEl = document.getElementById('bio-composers-row');
        if (composers.size > 0) {
            compEl.classList.remove('hidden');
            document.getElementById('bio-composers').textContent = Array.from(composers).join(', ');
        } else {
            compEl.classList.add('hidden');
        }

        const lyrEl = document.getElementById('bio-lyricists-row');
        if (lyricists.size > 0) {
            lyrEl.classList.remove('hidden');
            document.getElementById('bio-lyricists').textContent = Array.from(lyricists).join(', ');
        } else {
            lyrEl.classList.add('hidden');
        }

        // Bio fetch API
        try {
            const bioRes = await fetch(`/api/artists/${encodeURIComponent(artistName)}/bio`);
            if (bioRes.ok) {
                const bioData = await bioRes.json();
                const display = document.getElementById('bio-display-content');
                const textarea = document.getElementById('bio-edit-textarea');
                
                const bioText = bioData.bio || '';
                display.textContent = bioText || '등록된 소개글이 없어요. ✏️버튼을 눌러 추가해보세요.';
                textarea.value = bioText;
            }
        } catch (err) {
            console.error("Bio 로딩 실패", err);
        }

        // Bio Edit Handlers (clone to avoid duplicate listeners)
        const btnEdit = document.getElementById('btn-edit-bio');
        const newBtnEdit = btnEdit.cloneNode(true);
        btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
        
        const btnSave = document.getElementById('btn-save-bio');
        const newBtnSave = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtnSave, btnSave);
        
        const btnCancel = document.getElementById('btn-cancel-bio');
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        const actionsDiv = document.getElementById('bio-edit-actions');
        const displayDiv = document.getElementById('bio-display-content');
        const textareaDiv = document.getElementById('bio-edit-textarea');

        const toggleEditMode = (isEdit) => {
            if (isEdit) {
                displayDiv.classList.add('hidden');
                textareaDiv.classList.remove('hidden');
                actionsDiv.classList.remove('hidden');
                textareaDiv.focus();
            } else {
                displayDiv.classList.remove('hidden');
                textareaDiv.classList.add('hidden');
                actionsDiv.classList.add('hidden');
            }
        };
        
        // Reset state
        toggleEditMode(false);

        newBtnEdit.onclick = () => toggleEditMode(true);
        newBtnCancel.onclick = () => {
            // Restore previous value
            textareaDiv.value = displayDiv.textContent === '등록된 소개글이 없어요. ✏️버튼을 눌러 추가해보세요.' ? '' : displayDiv.textContent;
            toggleEditMode(false);
        };

        newBtnSave.onclick = async () => {
            const newBio = textareaDiv.value.trim();
            try {
                const res = await fetch(`/api/artists/${encodeURIComponent(artistName)}/bio`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio: newBio })
                });
                if (res.ok) {
                    displayDiv.textContent = newBio || '등록된 소개글이 없어요. ✏️버튼을 눌러 추가해보세요.';
                    toggleEditMode(false);
                    if (window.App) App.showToast('아티스트 소개가 저장되었습니다.');
                }
            } catch (err) {
                console.error("Bio 저장 실패", err);
            }
        };

        App.pushHistory({ view: 'artist-detail', artist: artistName });
    },

    // ─── 좋아하는 노래 ───

    showLikedSongs() {
        this._hideAllViews();
        const view = document.getElementById('view-liked');
        view.classList.remove('hidden');

        const liked = this.songs.filter(s => s.liked);
        document.getElementById('liked-count').textContent = `${liked.length}곡`;

        const container = document.getElementById('liked-songs-list');
        this.renderSongs(liked, container, {
            showGenre: false, showYear: false, showPlays: false
        });
    },

    // ─── 검색 ───

    async showSearchResults(query) {
        if (!query.trim()) return;

        this._hideAllViews();
        const view = document.getElementById('view-search');
        view.classList.remove('hidden');

        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}`);
        const results = await res.json();

        document.getElementById('search-count').textContent = `${results.length}개 결과`;

        const container = document.getElementById('search-results');
        this.renderSongs(results, container, {
            showGenre: false, showYear: false, showPlays: false
        });
    },

    // ─── 현재 재생 곡 하이라이트 ───

    highlightPlaying(songId) {
        document.querySelectorAll('.song-item').forEach(item => {
            item.classList.toggle('playing', item.dataset.songId == songId);
        });
    },

    updateSongLike(songId, liked) {
        document.querySelectorAll(`.song-like-btn[data-song-id="${songId}"]`).forEach(btn => {
            btn.classList.toggle('liked', !!liked);
            const svg = btn.querySelector('svg');
            svg.setAttribute('fill', liked ? 'var(--accent)' : 'none');
        });

        // songs 배열도 업데이트
        const song = this.songs.find(s => s.id === songId);
        if (song) {
            song.liked = liked;
            song.disliked = 0;
        }
    },

    // ─── 유틸리티 ───

    _hideAllViews() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
    },

    _formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
