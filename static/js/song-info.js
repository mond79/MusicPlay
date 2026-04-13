/**
 * Music Play — 노래 정보 다이얼로그 (6탭)
 * iTunes 스타일의 상세 노래 정보 편집/표시 모달
 */

const SongInfo = {
    currentSong: null,
    overlay: null,

    init() {
        this.overlay = document.getElementById('song-info-overlay');
        this._bindTabs();
        this._bindFooter();
        this._bindArtwork();
        this._bindOptions();
        this._bindRating();
    },

    async open(songId) {
        const res = await fetch(`/api/songs/${songId}`);
        this.currentSong = await res.json();

        this._populateFields();
        this.overlay.classList.remove('hidden');

        // 첫 번째 탭 활성화
        this._switchTab('details');
    },

    close() {
        this.overlay.classList.add('hidden');
        this.currentSong = null;
    },

    // ─── 탭 ───

    _bindTabs() {
        document.querySelectorAll('.dialog-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this._switchTab(tab.dataset.tab);
            });
        });
    },

    _switchTab(tabName) {
        document.querySelectorAll('.dialog-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        document.querySelectorAll('.dialog-tab-content').forEach(c => {
            c.classList.toggle('active', c.dataset.tab === tabName);
        });
    },

    // ─── 푸터 ───

    _bindFooter() {
        // 취소
        document.getElementById('dialog-cancel').addEventListener('click', () => this.close());

        // 오버레이 클릭으로 닫기
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // 확인 (저장)
        document.getElementById('dialog-save').addEventListener('click', () => this._save());

        // 이전/다음 네비게이션
        document.getElementById('dialog-prev').addEventListener('click', () => {
            // 현재 곡이 리스트에 있다면 이전 곡으로
            const songs = Library.songs;
            const idx = songs.findIndex(s => s.id === this.currentSong.id);
            if (idx > 0) {
                this._saveQuiet();
                this.open(songs[idx - 1].id);
            }
        });

        document.getElementById('dialog-next').addEventListener('click', () => {
            const songs = Library.songs;
            const idx = songs.findIndex(s => s.id === this.currentSong.id);
            if (idx < songs.length - 1) {
                this._saveQuiet();
                this.open(songs[idx + 1].id);
            }
        });

        // 재생 횟수 재설정
        document.getElementById('info-reset-plays').addEventListener('click', async () => {
            if (this.currentSong) {
                await fetch(`/api/songs/${this.currentSong.id}/reset-plays`, { method: 'POST' });
                document.getElementById('info-play-count').textContent = '0';
                document.getElementById('info-last-played').textContent = '';
                this.currentSong.play_count = 0;
                this.currentSong.last_played = '';
            }
        });

        // ESC로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
                this.close();
            }
        });
    },

    // ─── 앨범 표지 ───

    _bindArtwork() {
        const addBtn = document.getElementById('btn-add-artwork');
        const fileInput = document.getElementById('artwork-file-input');

        addBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !this.currentSong) return;

            const formData = new FormData();
            formData.append('cover', file);

            const res = await fetch(`/api/songs/${this.currentSong.id}/cover`, {
                method: 'PUT',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                // 미리보기 업데이트
                const img = document.getElementById('info-artwork');
                img.src = `/api/songs/${this.currentSong.id}/cover?t=${Date.now()}`;
                img.classList.add('visible');
                document.getElementById('artwork-no-cover').style.display = 'none';

                // 헤더 커버도 업데이트
                const headerImg = document.getElementById('dialog-cover');
                headerImg.src = img.src;

                this.currentSong.dominant_color = data.dominant_color;
                App.showToast('앨범 표지가 업데이트되었습니다');
            }

            fileInput.value = '';
        });
    },

    // ─── 옵션 체크박스 ───

    _bindOptions() {
        document.getElementById('info-start-check').addEventListener('change', (e) => {
            document.getElementById('info-start-time').disabled = !e.target.checked;
        });
        document.getElementById('info-stop-check').addEventListener('change', (e) => {
            document.getElementById('info-stop-time').disabled = !e.target.checked;
        });
    },

    // ─── 별점 ───

    _bindRating() {
        // 초기 렌더링은 _populateFields에서 수행
    },

    _renderRating(rating) {
        const container = document.getElementById('info-rating');
        container.innerHTML = '';

        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = `rating-star ${i <= rating ? 'filled' : ''}`;
            star.textContent = i <= rating ? '★' : '☆';
            star.addEventListener('click', () => {
                // 같은 별점을 다시 클릭하면 0으로
                const newRating = (i === this.currentSong.rating) ? 0 : i;
                this.currentSong.rating = newRating;
                this._renderRating(newRating);
            });
            container.appendChild(star);
        }

        // 좋아요 하트
        const heart = document.createElement('span');
        heart.className = `rating-heart ${this.currentSong.liked ? 'liked' : ''}`;
        heart.innerHTML = this.currentSong.liked ? '♥' : '♡';
        heart.addEventListener('click', async () => {
            const res = await fetch(`/api/songs/${this.currentSong.id}/like`, { method: 'POST' });
            const data = await res.json();
            this.currentSong.liked = data.liked;
            heart.className = `rating-heart ${data.liked ? 'liked' : ''}`;
            heart.innerHTML = data.liked ? '♥' : '♡';
            Library.updateSongLike(this.currentSong.id, data.liked);
        });
        container.appendChild(heart);
    },

    // ─── 필드 채우기 ───

    _populateFields() {
        const s = this.currentSong;
        if (!s) return;

        // 헤더
        document.getElementById('dialog-title').textContent = s.title || '알 수 없는 곡';
        document.getElementById('dialog-artist').textContent = s.artist || '';
        document.getElementById('dialog-album').textContent = s.album || '';

        const headerImg = document.getElementById('dialog-cover');
        const headerNoCover = document.querySelector('.dialog-no-cover');
        headerImg.src = `/api/songs/${s.id}/cover`;
        headerImg.onload = () => { headerImg.classList.add('visible'); headerNoCover.style.display = 'none'; };
        headerImg.onerror = () => { headerImg.classList.remove('visible'); headerNoCover.style.display = 'flex'; };

        // 탭 1: 세부사항
        document.getElementById('info-title').value = s.title || '';
        document.getElementById('info-artist').value = s.artist || '';
        document.getElementById('info-album').value = s.album || '';
        document.getElementById('info-album-artist').value = s.album_artist || '';
        document.getElementById('info-composer').value = s.composer || '';
        document.getElementById('info-grouping').value = s.grouping || '';
        document.getElementById('info-year').value = s.year || '';
        document.getElementById('info-track-num').value = s.track_number || '';
        document.getElementById('info-track-total').value = s.track_total || '';
        document.getElementById('info-disc-num').value = s.disc_number || '';
        document.getElementById('info-disc-total').value = s.disc_total || '';
        document.getElementById('info-compilation').checked = !!s.compilation;
        document.getElementById('info-bpm').value = s.bpm || '';
        document.getElementById('info-comment').value = s.comment || '';

        // 장르 드롭다운
        const genreSelect = document.getElementById('info-genre');
        genreSelect.value = s.genre || '';
        if (!genreSelect.value && s.genre) {
            // 목록에 없는 장르면 옵션 추가
            const opt = document.createElement('option');
            opt.value = s.genre;
            opt.textContent = s.genre;
            genreSelect.appendChild(opt);
            genreSelect.value = s.genre;
        }

        // 재생 횟수
        document.getElementById('info-play-count').textContent = s.play_count || '0';
        if (s.last_played) {
            const d = new Date(s.last_played);
            document.getElementById('info-last-played').textContent =
                `(최근 재생 날짜: ${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`;
        } else {
            document.getElementById('info-last-played').textContent = '';
        }

        // 별점
        this._renderRating(s.rating || 0);

        // 탭 2: 앨범 표지
        const artworkImg = document.getElementById('info-artwork');
        const artworkNoCover = document.getElementById('artwork-no-cover');
        artworkImg.src = `/api/songs/${s.id}/cover`;
        artworkImg.onload = () => { artworkImg.classList.add('visible'); artworkNoCover.style.display = 'none'; };
        artworkImg.onerror = () => { artworkImg.classList.remove('visible'); artworkNoCover.style.display = 'flex'; };

        // 탭 3: 가사
        document.getElementById('info-lyrics').value = s.lyrics || '';

        // 탭 4: 옵션
        document.getElementById('info-media-kind').value = s.media_kind || '음악';
        document.getElementById('info-start-time').value = s.start_time ?
            Player._formatTime(s.start_time) : '0:00';
        document.getElementById('info-stop-time').value = s.stop_time ?
            Player._formatTime(s.stop_time) : Player._formatTime(s.duration);
        document.getElementById('info-start-check').checked = !!s.start_time;
        document.getElementById('info-stop-check').checked = !!s.stop_time;
        document.getElementById('info-start-time').disabled = !s.start_time;
        document.getElementById('info-stop-time').disabled = !s.stop_time;
        document.getElementById('info-remember-pos').checked = !!s.remember_position;
        document.getElementById('info-skip-shuffle').checked = !!s.skip_when_shuffling;
        document.getElementById('info-volume-adj').value = s.volume_adjustment || 0;
        document.getElementById('info-equalizer').value = s.equalizer || '';

        // 탭 5: 정렬
        document.getElementById('info-sort-title').value = s.sort_title || '';
        document.getElementById('info-sort-artist').value = s.sort_artist || '';
        document.getElementById('info-sort-album').value = s.sort_album || '';
        document.getElementById('info-sort-album-artist').value = s.sort_album_artist || '';

        // 탭 6: 파일
        document.getElementById('info-file-path').textContent = s.file_path || '';
        document.getElementById('info-file-size').textContent = this._formatFileSize(s.file_size);
        document.getElementById('info-file-format').textContent = s.file_format || '';
        document.getElementById('info-file-bitrate').textContent = s.bitrate ?
            `${Math.round(s.bitrate / 1000)} kbps` : '';
        document.getElementById('info-file-samplerate').textContent = s.sample_rate ?
            `${s.sample_rate} Hz` : '';
        document.getElementById('info-file-channels').textContent = s.channels === 2 ?
            '스테레오' : s.channels === 1 ? '모노' : `${s.channels}ch`;
        document.getElementById('info-file-duration').textContent = Player._formatTime(s.duration);
    },

    // ─── 저장 ───

    async _save() {
        if (!this.currentSong) return;

        const data = this._collectFormData();

        try {
            await fetch(`/api/songs/${this.currentSong.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            App.showToast('노래 정보가 저장되었습니다');

            // 라이브러리 새로고침
            await Library.loadSongs();
            App.refreshCurrentView();

            this.close();
        } catch (e) {
            console.error('저장 오류:', e);
            App.showToast('저장 중 오류가 발생했습니다');
        }
    },

    async _saveQuiet() {
        if (!this.currentSong) return;
        const data = this._collectFormData();
        try {
            await fetch(`/api/songs/${this.currentSong.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error('자동 저장 오류:', e);
        }
    },

    _collectFormData() {
        return {
            title: document.getElementById('info-title').value,
            artist: document.getElementById('info-artist').value,
            album: document.getElementById('info-album').value,
            album_artist: document.getElementById('info-album-artist').value,
            composer: document.getElementById('info-composer').value,
            grouping: document.getElementById('info-grouping').value,
            genre: document.getElementById('info-genre').value,
            year: parseInt(document.getElementById('info-year').value) || 0,
            track_number: parseInt(document.getElementById('info-track-num').value) || 0,
            track_total: parseInt(document.getElementById('info-track-total').value) || 0,
            disc_number: parseInt(document.getElementById('info-disc-num').value) || 1,
            disc_total: parseInt(document.getElementById('info-disc-total').value) || 1,
            compilation: document.getElementById('info-compilation').checked ? 1 : 0,
            bpm: parseInt(document.getElementById('info-bpm').value) || 0,
            rating: this.currentSong.rating || 0,
            comment: document.getElementById('info-comment').value,
            lyrics: document.getElementById('info-lyrics').value,
            media_kind: document.getElementById('info-media-kind').value,
            remember_position: document.getElementById('info-remember-pos').checked ? 1 : 0,
            skip_when_shuffling: document.getElementById('info-skip-shuffle').checked ? 1 : 0,
            volume_adjustment: parseInt(document.getElementById('info-volume-adj').value) || 0,
            equalizer: document.getElementById('info-equalizer').value,
            sort_title: document.getElementById('info-sort-title').value,
            sort_artist: document.getElementById('info-sort-artist').value,
            sort_album: document.getElementById('info-sort-album').value,
            sort_album_artist: document.getElementById('info-sort-album-artist').value,
        };
    },

    // ─── 유틸리티 ───

    _formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};
