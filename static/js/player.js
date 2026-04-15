/**
 * Music Play — 재생 엔진
 * Web Audio API 기반 음악 재생, 큐, 셔플/반복 관리
 */

const Player = {
    audio: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'none', // 'none' | 'all' | 'one'
    volume: 1,
    isMuted: false,
    isDragging: false,
    playbackRate: 1.0,   // 재생 속도
    speedOptions: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],

    // ─── LRC 싱크 가사 ───
    lrcLines: [],        // [{ time: 초, text: '가사' }, ...]
    isLrcMode: false,    // LRC 타임코드 포함 여부
    currentLrcIndex: -1, // 현재 활성 가사 줄 인덱스

    init() {
        this.audio = document.getElementById('audio-element');
        this._bindEvents();
        this._bindControls();

        // 저장된 볼륨 복원
        const savedVolume = localStorage.getItem('mp-volume');
        if (savedVolume !== null) {
            this.volume = parseFloat(savedVolume);
            this.audio.volume = this.volume;
            this._updateVolumeUI();
        }

        // 저장된 셔플/반복 상태 복원
        const savedShuffle = localStorage.getItem('mp-shuffle');
        if (savedShuffle === 'true') {
            this.isShuffle = true;
            document.getElementById('btn-shuffle').classList.add('active');
        }
        const savedRepeat = localStorage.getItem('mp-repeat');
        if (savedRepeat) {
            this.repeatMode = savedRepeat;
            this._updateRepeatUI();
        }

        // 저장된 재생 속도 복원
        const savedSpeed = localStorage.getItem('mp-speed');
        if (savedSpeed) {
            this.playbackRate = parseFloat(savedSpeed);
            this.audio.playbackRate = this.playbackRate;
            this._updateSpeedUI();
        }
    },

    _bindEvents() {
        const audio = this.audio;

        audio.addEventListener('timeupdate', () => {
            if (!this.isDragging) {
                this._updateProgress();
            }
            // LRC 싱크 가사 업데이트 (화면 전환 지연 보상을 위해 선행 하이라이트 시간 2.2초 적용)
            if (this.isLrcMode && !document.getElementById('lyrics-panel').classList.contains('hidden')) {
                this._syncLyrics(audio.currentTime + 2.2);
            }
        });

        audio.addEventListener('ended', () => {
            this._onTrackEnd();
        });

        audio.addEventListener('loadedmetadata', () => {
            document.getElementById('total-time').textContent = this._formatTime(audio.duration);
        });

        audio.addEventListener('play', () => {
            this.isPlaying = true;
            this._updatePlayButton();
        });

        audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this._updatePlayButton();
        });

        audio.addEventListener('error', (e) => {
            console.error('오디오 재생 오류:', e);
            App.showToast('재생할 수 없는 파일입니다');
        });
    },

    _bindControls() {
        // 재생/일시정지
        document.getElementById('btn-play').addEventListener('click', () => this.togglePlay());

        // 이전/다음
        document.getElementById('btn-prev').addEventListener('click', () => this.prev());
        document.getElementById('btn-next').addEventListener('click', () => this.next());

        // 셔플
        document.getElementById('btn-shuffle').addEventListener('click', () => this.toggleShuffle());

        // 반복
        document.getElementById('btn-repeat').addEventListener('click', () => this.toggleRepeat());

        // 진행 바
        const progressContainer = document.getElementById('progress-container');
        progressContainer.addEventListener('mousedown', (e) => this._onProgressMouseDown(e));

        // 볼륨
        const volumeContainer = document.getElementById('volume-container');
        volumeContainer.addEventListener('mousedown', (e) => this._onVolumeMouseDown(e));
        document.getElementById('btn-volume').addEventListener('click', () => this.toggleMute());

        // 큐 토글
        document.getElementById('btn-queue').addEventListener('click', () => {
            const panel = document.getElementById('queue-panel');
            panel.classList.toggle('hidden');
        });
        document.getElementById('btn-close-queue').addEventListener('click', () => {
            document.getElementById('queue-panel').classList.add('hidden');
        });

        // 가사 토글
        document.getElementById('btn-lyrics').addEventListener('click', () => {
            const panel = document.getElementById('lyrics-panel');
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                this._updateLyricsPanel();
            }
        });
        document.getElementById('btn-close-lyrics').addEventListener('click', () => {
            document.getElementById('lyrics-panel').classList.add('hidden');
        });

        // 좋아요 버튼
        document.getElementById('player-like-btn').addEventListener('click', () => {
            if (this.currentSong()) {
                this._toggleLike(this.currentSong().id);
            }
        });

        // 재생 속도 버튼
        document.getElementById('btn-speed').addEventListener('click', () => this.cycleSpeed());

        // 키보드 단축키
        this._bindKeyboard();
        this._setupMediaSession();
    },

    // ─── 키보드 단축키 ───

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // 입력 필드에 포커스되어 있으면 무시
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            switch (e.code) {
                case 'Space':       // 스페이스: 재생/일시정지
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':   // ←: 5초 되감기
                    e.preventDefault();
                    if (this.audio.src) {
                        this.audio.currentTime = Math.max(0, this.audio.currentTime - 5);
                    }
                    break;
                case 'ArrowRight':  // →: 5초 빨리감기
                    e.preventDefault();
                    if (this.audio.src) {
                        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 5);
                    }
                    break;
                case 'ArrowUp':     // ↑: 볼륨 올리기
                    e.preventDefault();
                    this.setVolume(this.volume + 0.05);
                    break;
                case 'ArrowDown':   // ↓: 볼륨 내리기
                    e.preventDefault();
                    this.setVolume(this.volume - 0.05);
                    break;
                case 'KeyM':        // M: 음소거
                    this.toggleMute();
                    break;
                case 'KeyN':        // N: 다음 곡 (Shift+N)
                    if (e.shiftKey) {
                        this.next();
                    }
                    break;
                case 'KeyP':        // P: 이전 곡 (Shift+P)
                    if (e.shiftKey) {
                        this.prev();
                    }
                    break;
            }
        });
    },

    // ─── OS 미디어 세션 연동 (Media Session API) ───

    _setupMediaSession() {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            if (this.audio.src) this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            if (this.audio.src) this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
        });
    },

    _updateMediaSession(song) {
        if (!('mediaSession' in navigator) || !song) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || '알 수 없는 곡',
            artist: song.artist || '알 수 없는 아티스트',
            album: song.album || '',
            artwork: [
                { src: `/api/songs/${song.id}/cover`, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
    },

    // ─── 재생 제어 ───

    async play(song, queue = null, index = 0) {
        if (queue) {
            this.queue = [...queue];
            this.currentIndex = index;
        }

        if (!song && this.queue.length > 0) {
            song = this.queue[this.currentIndex];
        }

        if (!song) return;

        // 오디오 소스 설정
        this.audio.src = `/api/songs/${song.id}/stream`;
        this.audio.load();

        try {
            if (window.Equalizer) Equalizer.resume();
            await this.audio.play();
        } catch (e) {
            console.error('재생 시작 오류:', e);
        }

        // UI 업데이트
        this._updateNowPlaying(song);
        this._updateQueuePanel();
        Library.highlightPlaying(song.id);

        // 재생 횟수 증가
        fetch(`/api/songs/${song.id}/play`, { method: 'POST' });

        // 동적 색상 변경
        if (song.dominant_color) {
            ColorTheme.setColor(song.dominant_color);
        }

        // OS 미디어 세션 메타데이터 업데이트
        this._updateMediaSession(song);

        // 미니 플레이어 즉시 동기화
        if (window.MiniPlayer && MiniPlayer.pipWindow) {
            MiniPlayer._updateMeta();
            MiniPlayer._updatePlayPause();
        }
    },

    togglePlay() {
        if (!this.audio.src) return;

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play();
        }
    },

    next() {
        if (this.queue.length === 0) return;

        if (this.repeatMode === 'one') {
            this.audio.currentTime = 0;
            this.audio.play();
            return;
        }

        let nextIndex;
        if (this.isShuffle) {
            nextIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.queue.length) {
                if (this.repeatMode === 'all') {
                    nextIndex = 0;
                } else {
                    this.audio.pause();
                    return;
                }
            }
        }

        this.currentIndex = nextIndex;
        this.play(this.queue[nextIndex]);
    },

    prev() {
        if (this.queue.length === 0) return;

        // 3초 이상 재생했으면 처음으로
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }

        let prevIndex;
        if (this.isShuffle) {
            prevIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            prevIndex = this.currentIndex - 1;
            if (prevIndex < 0) {
                if (this.repeatMode === 'all') {
                    prevIndex = this.queue.length - 1;
                } else {
                    prevIndex = 0;
                }
            }
        }

        this.currentIndex = prevIndex;
        this.play(this.queue[prevIndex]);
    },

    // ─── 큐 관리 ───

    playNext(song) {
        const insertIndex = this.currentIndex + 1;
        this.queue.splice(insertIndex, 0, song);
        this._updateQueuePanel();
        App.showToast(`"${song.title}" — 바로 다음에 재생됩니다`);
    },

    playLast(song) {
        this.queue.push(song);
        this._updateQueuePanel();
        App.showToast(`"${song.title}" — 맨 나중에 재생됩니다`);
    },

    currentSong() {
        if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
            return this.queue[this.currentIndex];
        }
        return null;
    },

    // ─── 셔플/반복 ───

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        document.getElementById('btn-shuffle').classList.toggle('active', this.isShuffle);
        localStorage.setItem('mp-shuffle', this.isShuffle);
    },

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIdx = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIdx + 1) % modes.length];
        localStorage.setItem('mp-repeat', this.repeatMode);
        this._updateRepeatUI();
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.audio.muted = this.isMuted;
        document.getElementById('icon-volume-on').classList.toggle('hidden', this.isMuted);
        document.getElementById('icon-volume-off').classList.toggle('hidden', !this.isMuted);
    },

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        this.audio.volume = this.volume;
        localStorage.setItem('mp-volume', this.volume);
        this._updateVolumeUI();

        if (this.volume > 0 && this.isMuted) {
            this.isMuted = false;
            this.audio.muted = false;
            document.getElementById('icon-volume-on').classList.remove('hidden');
            document.getElementById('icon-volume-off').classList.add('hidden');
        }
    },

    // ─── 재생 속도 ───

    cycleSpeed() {
        const currentIdx = this.speedOptions.indexOf(this.playbackRate);
        const nextIdx = (currentIdx + 1) % this.speedOptions.length;
        this.playbackRate = this.speedOptions[nextIdx];
        this.audio.playbackRate = this.playbackRate;
        localStorage.setItem('mp-speed', this.playbackRate);
        this._updateSpeedUI();
        App.showToast(`재생 속도: ${this.playbackRate}x`);
    },

    _updateSpeedUI() {
        const label = document.getElementById('speed-label');
        label.textContent = `${this.playbackRate}x`;
        const btn = document.getElementById('btn-speed');
        btn.classList.toggle('active', this.playbackRate !== 1.0);
    },

    // ─── 내부 함수 ───

    _onTrackEnd() {
        if (this.repeatMode === 'one') {
            this.audio.currentTime = 0;
            this.audio.play();
        } else {
            this.next();
        }
    },

    _updateProgress() {
        const current = this.audio.currentTime;
        const total = this.audio.duration || 0;
        const pct = total > 0 ? (current / total) * 100 : 0;

        document.getElementById('progress-fill').style.width = `${pct}%`;
        document.getElementById('progress-thumb').style.left = `${pct}%`;
        document.getElementById('current-time').textContent = this._formatTime(current);
    },

    _updatePlayButton() {
        document.getElementById('icon-play').classList.toggle('hidden', this.isPlaying);
        document.getElementById('icon-pause').classList.toggle('hidden', !this.isPlaying);
    },

    _updateRepeatUI() {
        const btn = document.getElementById('btn-repeat');
        btn.classList.toggle('active', this.repeatMode !== 'none');
        btn.setAttribute('data-mode', this.repeatMode);

        if (this.repeatMode === 'one') {
            btn.title = '한 곡 반복';
        } else if (this.repeatMode === 'all') {
            btn.title = '전체 반복';
        } else {
            btn.title = '반복 안 함';
        }
    },

    _updateVolumeUI() {
        const pct = this.volume * 100;
        document.getElementById('volume-fill').style.width = `${pct}%`;
        document.getElementById('volume-thumb').style.left = `${pct}%`;
    },

    _updateNowPlaying(song) {
        const cover = document.getElementById('player-cover');
        const noCover = document.querySelector('.player-no-cover');
        const title = document.getElementById('player-title');
        const artist = document.getElementById('player-artist');
        const likeBtn = document.getElementById('player-like-btn');

        title.textContent = song.title || '알 수 없는 곡';
        artist.textContent = song.artist || '알 수 없는 아티스트';

        // 커버
        cover.crossOrigin = "Anonymous";
        cover.src = `/api/songs/${song.id}/cover`;
        cover.onload = () => {
            cover.classList.add('visible');
            noCover.style.display = 'none';
            
            // 다이나믹 컬러 테마 적용 (5단계)
            if (window.ColorTheme) {
                const hexColor = ColorTheme.extractFromImage(cover);
                if (hexColor) {
                    ColorTheme.setColor(hexColor);
                } else {
                    ColorTheme.reset();
                }
            }
        };
        cover.onerror = () => {
            cover.classList.remove('visible');
            noCover.style.display = 'flex';
            if (window.ColorTheme) ColorTheme.reset();
        };

        // 좋아요
        likeBtn.classList.toggle('liked', !!song.liked);
        const svg = likeBtn.querySelector('svg');
        svg.setAttribute('fill', song.liked ? 'var(--accent)' : 'none');

        // 비주얼라이저 연동
        if (window.Visualizer && Visualizer.isActive) {
            Visualizer._updateBackground();
        }

        // 가사 패널 업데이트
        if (!document.getElementById('lyrics-panel').classList.contains('hidden')) {
            this._updateLyricsPanel();
        }

        // 페이지 제목
        document.title = `${song.title} — ${song.artist} | Music Play`;

        // MediaSession API (윈도우 알림 / 미디어 키 연동)
        this._updateMediaSession(song);
    },

    _updateMediaSession(song) {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || '알 수 없는 곡',
            artist: song.artist || '알 수 없는 아티스트',
            album: song.album || '',
            artwork: [{
                src: `/api/songs/${song.id}/cover`,
                sizes: '500x500',
                type: 'image/jpeg'
            }]
        });

        navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekbackward', () => {
            this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
            this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
        });
    },

    // ─── LRC 가사 파싱 ───

    /**
     * LRC 텍스트를 파싱합니다.
     * LRC 형식: [mm:ss.xx]가사텍스트  또는  [mm:ss]가사텍스트
     * 타임코드가 없으면 일반 텍스트로 처리합니다.
     * @returns {boolean} LRC 모드 여부
     */
    _parseLRC(text) {
        if (!text) return false;

        const lines = [];
        const lrcPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
        let hasTimestamp = false;

        text.split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;

            const match = line.match(lrcPattern);
            if (match) {
                hasTimestamp = true;
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
                const time = mins * 60 + secs + ms / 1000;
                const text = match[4].trim();

                // 메타데이터 태그([ti:], [ar:] 등)는 건너뜀
                if (!line.match(/^\[(ti|ar|al|by|offset|re|ve):/i)) {
                    lines.push({ time, text });
                }
            } else if (!hasTimestamp) {
                // 타임코드 없는 일반 텍스트 줄
                lines.push({ time: -1, text: line });
            }
        });

        // 시간순 정렬
        if (hasTimestamp) {
            lines.sort((a, b) => a.time - b.time);
        }

        this.lrcLines = lines;
        this.isLrcMode = hasTimestamp;
        this.currentLrcIndex = -1;
        return hasTimestamp;
    },

    /**
     * 현재 재생 시간에 맞는 가사 줄을 하이라이트합니다.
     */
    _syncLyrics(currentTime) {
        if (!this.lrcLines.length) return;

        // 현재 시간에 해당하는 가사 인덱스 찾기
        let activeIndex = -1;
        for (let i = 0; i < this.lrcLines.length; i++) {
            if (this.lrcLines[i].time <= currentTime) {
                activeIndex = i;
            } else {
                break;
            }
        }

        if (activeIndex === this.currentLrcIndex) return;
        this.currentLrcIndex = activeIndex;

        // 모든 줄 상태 업데이트
        const container = document.getElementById('lyrics-content');
        const lines = container.querySelectorAll('.lrc-line');

        lines.forEach((line, idx) => {
            line.classList.remove('lrc-active', 'lrc-past', 'lrc-future');
            if (idx < activeIndex) {
                line.classList.add('lrc-past');
            } else if (idx === activeIndex) {
                line.classList.add('lrc-active');
            } else {
                line.classList.add('lrc-future');
            }
        });

        // 활성 줄을 중앙으로 부드럽게 스크롤
        if (activeIndex >= 0 && lines[activeIndex]) {
            const activeLine = lines[activeIndex];
            const containerRect = container.getBoundingClientRect();
            const lineRect = activeLine.getBoundingClientRect();
            const scrollTarget = container.scrollTop
                + (lineRect.top - containerRect.top)
                - containerRect.height / 2
                + lineRect.height / 2;

            container.scrollTo({
                top: scrollTarget,
                behavior: 'smooth'
            });
        }
    },

    /**
     * 가사 패널을 렌더링합니다.
     * LRC 포맷이면 줄별 DOM 요소로, 아니면 일반 텍스트로 표시합니다.
     */
    _updateLyricsPanel() {
        const song = this.currentSong();
        const container = document.getElementById('lyrics-content');

        if (!song || !song.lyrics) {
            this.lrcLines = [];
            this.isLrcMode = false;
            container.innerHTML = '<p class="lyrics-placeholder">가사가 없습니다</p>';
            return;
        }

        const isLrc = this._parseLRC(song.lyrics);

        if (isLrc) {
            // LRC 모드: 줄별 요소 생성
            container.innerHTML = '<div class="lrc-lines-wrapper"></div>';
            const wrapper = container.querySelector('.lrc-lines-wrapper');

            // 상단 여백 (첫 줄이 중앙에 오도록)
            const spacer = document.createElement('div');
            spacer.className = 'lrc-spacer';
            wrapper.appendChild(spacer);

            this.lrcLines.forEach((line, idx) => {
                const el = document.createElement('div');
                el.className = 'lrc-line lrc-future';
                el.textContent = line.text || '';
                el.dataset.time = line.time;
                el.dataset.index = idx;

                // 가사 줄 클릭 → 해당 시간으로 탐색
                el.addEventListener('click', () => {
                    if (line.time >= 0) {
                        this.audio.currentTime = line.time;
                        this._syncLyrics(line.time);
                    }
                });

                wrapper.appendChild(el);
            });

            // 하단 여백
            const spacerBottom = document.createElement('div');
            spacerBottom.className = 'lrc-spacer';
            wrapper.appendChild(spacerBottom);

            // 현재 시간 기준으로 즉시 싱크
            this._syncLyrics(this.audio.currentTime);

            // LRC 모드 안내 배지
            const badge = document.createElement('div');
            badge.className = 'lrc-badge';
            badge.textContent = 'LRC 싱크 가사';
            container.appendChild(badge);
        } else {
            // 일반 텍스트 가사
            this.isLrcMode = false;
            const escaped = this._escapeHtml(song.lyrics);
            container.innerHTML = '<div class="plain-lyrics"><pre class="plain-lyrics-pre">' +
                escaped +
                '</pre></div>';
        }
    },

    _updateQueuePanel() {
        const currentEl = document.getElementById('queue-current');
        const listEl = document.getElementById('queue-list');

        // 현재 재생 중
        const song = this.currentSong();
        if (song) {
            currentEl.innerHTML = this._renderQueueItem(song, true);
        } else {
            currentEl.innerHTML = '<p style="color: var(--text-tertiary); font-size: 12px;">재생 중인 곡이 없습니다</p>';
        }

        // 다음 재생 목록
        let html = '';
        for (let i = this.currentIndex + 1; i < this.queue.length && i < this.currentIndex + 51; i++) {
            html += this._renderQueueItem(this.queue[i], false);
        }
        listEl.innerHTML = html || '<p style="color: var(--text-tertiary); font-size: 12px; padding: 8px;">다음에 재생할 곡이 없습니다</p>';
    },

    _renderQueueItem(song, isCurrent) {
        return `
            <div class="queue-item ${isCurrent ? 'current' : ''}" data-id="${song.id}">
                <img src="/api/songs/${song.id}/cover" alt="" onerror="this.style.display='none'">
                <div class="queue-item-info">
                    <div class="queue-item-title">${this._escapeHtml(song.title)}</div>
                    <div class="queue-item-artist">${this._escapeHtml(song.artist)}</div>
                </div>
            </div>
        `;
    },

    async _toggleLike(songId) {
        const res = await fetch(`/api/songs/${songId}/like`, { method: 'POST' });
        const data = await res.json();

        // 큐의 곡 데이터도 업데이트
        const song = this.queue.find(s => s.id === songId);
        if (song) {
            song.liked = data.liked;
            song.disliked = 0;
        }

        // UI 업데이트
        const likeBtn = document.getElementById('player-like-btn');
        likeBtn.classList.toggle('liked', !!data.liked);
        const svg = likeBtn.querySelector('svg');
        svg.setAttribute('fill', data.liked ? 'var(--accent)' : 'none');

        // 리스트 아이템도 업데이트
        Library.updateSongLike(songId, data.liked);
    },

    // ─── 프로그래스 바 드래그 ───

    _onProgressMouseDown(e) {
        this.isDragging = true;
        this._onProgressMove(e);

        const onMove = (e) => this._onProgressMove(e);
        const onUp = () => {
            this.isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },

    _onProgressMove(e) {
        const container = document.getElementById('progress-container');
        const rect = container.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = pct * (this.audio.duration || 0);

        this.audio.currentTime = time;
        document.getElementById('progress-fill').style.width = `${pct * 100}%`;
        document.getElementById('progress-thumb').style.left = `${pct * 100}%`;
        document.getElementById('current-time').textContent = this._formatTime(time);
    },

    // ─── 볼륨 바 드래그 ───

    _onVolumeMouseDown(e) {
        this._onVolumeMove(e);

        const onMove = (e) => this._onVolumeMove(e);
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },

    _onVolumeMove(e) {
        const container = document.getElementById('volume-container');
        const rect = container.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.setVolume(pct);
    },

    // ─── 유틸리티 ───

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
