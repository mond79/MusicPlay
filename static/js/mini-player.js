/**
 * Mond Play — 미니 플레이어
 * Document Picture-in-Picture API 기반의 독립 창 음악 위젯
 */

const MiniPlayer = {
    pipWindow: null,
    syncInterval: null,
    
    init() {
        const btn = document.getElementById('btn-mini-player');
        if (!btn) return;

        // 브라우저 지원 여부 확인 (Chrome 111+)
        if (!('documentPictureInPicture' in window)) {
            // 미지원 브라우저의 경우 버튼 클릭시 경고
            btn.addEventListener('click', () => {
                App.showToast('이 브라우저는 미니 플레이어를 (Document PiP) 지원하지 않습니다. 최신 Chrome 기반 브라우저를 사용해주세요.', 4000);
            });
            return;
        }

        btn.addEventListener('click', async () => {
            if (this.pipWindow) {
                this.close();
            } else {
                await this.open();
            }
        });
    },

    async open() {
        try {
            // 창 크기
            this.pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 300,
                height: 380
            });
            
            this.pipWindow.addEventListener('pagehide', () => {
                this.pipWindow = null;
                if (this.syncInterval) clearInterval(this.syncInterval);
            });
            
            // 기존 스타일 복사
            [...document.styleSheets].forEach((sheet) => {
                try {
                    const cssRules = [...sheet.cssRules].map((rule) => rule.cssText).join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    this.pipWindow.document.head.appendChild(style);
                } catch (e) {
                    if (sheet.href) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = sheet.href;
                        this.pipWindow.document.head.appendChild(link);
                    }
                }
            });
            
            // 미니 플레이어용 특수 스타일 (직접 주입)
            const miniStyle = document.createElement('style');
            miniStyle.textContent = `
                body { margin: 0; padding: 0; background: var(--bg-primary); overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
                .mp-wrapper { width: 100%; height: 100%; display: flex; flex-direction: column; position: relative; }
                .mp-bg { position: absolute; inset: -50px; background-size: cover; background-position: center; filter: blur(30px) brightness(0.4); z-index: 1; transition: background-image 0.5s ease; }
                .mp-content { position: relative; z-index: 2; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 100%; box-sizing: border-box; }
                .mp-cover { width: 180px; height: 180px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); object-fit: cover; transition: opacity 0.3s ease; }
                .mp-info { text-align: center; width: 100%; display: flex; flex-direction: column; gap: 4px; overflow: hidden; margin-top: 16px; }
                .mp-title { font-size: 18px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .mp-artist { font-size: 14px; color: rgba(255,255,255,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .mp-progress-wrapper { width: 100%; margin-top: 20px; }
                .mp-progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; }
                .mp-progress-fill { height: 100%; background: #fff; border-radius: 2px; position: absolute; top: 0; left: 0; pointer-events: none; }
                .mp-time-row { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
                .mp-controls { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: auto; }
                .mp-btn { background: none; border: none; padding: 0; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s; }
                .mp-btn:hover { transform: scale(1.1); color: var(--accent); }
                .mp-btn-main { background: #fff; color: #000; width: 48px; height: 48px; border-radius: 50%; }
                .mp-btn-main:hover { transform: scale(1.05); background: #f0f0f0; color: #000; }
            `;
            this.pipWindow.document.head.appendChild(miniStyle);

            this._renderUI();
            this._startSync();
            
        } catch (error) {
            console.error('팝업 플레이어를 여는 데 실패:', error);
        }
    },
    
    close() {
        if (this.pipWindow) {
            this.pipWindow.close();
            this.pipWindow = null;
        }
    },
    
    _renderUI() {
        const doc = this.pipWindow.document;
        
        doc.body.innerHTML = `
            <div class="mp-wrapper">
                <div class="mp-bg" id="mp-bg"></div>
                <div class="mp-content">
                    <img id="mp-cover" class="mp-cover" src="/static/img/default-cover.png" />
                    
                    <div class="mp-info">
                        <div class="mp-title" id="mp-title">재생 중인 곡 없음</div>
                        <div class="mp-artist" id="mp-artist">-</div>
                    </div>
                    
                    <div class="mp-progress-wrapper">
                        <div class="mp-progress-bar" id="mp-progress-bar">
                            <div class="mp-progress-fill" id="mp-progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="mp-time-row">
                            <span id="mp-time-curr">0:00</span>
                            <span id="mp-time-tot">0:00</span>
                        </div>
                    </div>
                    
                    <div class="mp-controls">
                        <button class="mp-btn" id="mp-btn-prev">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                        <button class="mp-btn mp-btn-main" id="mp-btn-play">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <button class="mp-btn" id="mp-btn-next">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 버튼 이벤트 바인딩 (메인 창의 Player 조작)
        doc.getElementById('mp-btn-play').addEventListener('click', () => {
            Player.togglePlay();
            this._updatePlayPause();
        });
        doc.getElementById('mp-btn-prev').addEventListener('click', () => Player.prev());
        doc.getElementById('mp-btn-next').addEventListener('click', () => Player.next());
        
        // 탐색 바 클릭 연동
        const pBar = doc.getElementById('mp-progress-bar');
        pBar.addEventListener('click', (e) => {
            if (!Player.audio.duration) return;
            const rect = pBar.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            Player.audio.currentTime = pos * Player.audio.duration;
            this._updateProgress();
        });
        
        this._updateMeta();
        this._updatePlayPause();
        this._updateProgress();
        this._bindKeyboard();
    },

    _bindKeyboard() {
        if (!this.pipWindow) return;
        this.pipWindow.document.addEventListener('keydown', (e) => {
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    Player.togglePlay();
                    this._updatePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (Player.audio.src) {
                        Player.audio.currentTime = Math.max(0, Player.audio.currentTime - 5);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (Player.audio.src) {
                        Player.audio.currentTime = Math.min(Player.audio.duration, Player.audio.currentTime + 5);
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    Player.setVolume(Player.volume + 0.05);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    Player.setVolume(Player.volume - 0.05);
                    break;
                case 'KeyM':
                    Player.toggleMute();
                    break;
                case 'KeyN':
                    if (e.shiftKey) Player.next();
                    break;
                case 'KeyP':
                    if (e.shiftKey) Player.prev();
                    break;
            }
        });
    },
    
    _startSync() {
        let lastSongId = null;
        let lastPlayState = null;
        
        this.syncInterval = setInterval(() => {
            if (!this.pipWindow) {
                clearInterval(this.syncInterval);
                return;
            }
            
            const song = Player.currentSong();
            const songId = song ? song.id : null;
            if (songId !== lastSongId) {
                this._updateMeta();
                lastSongId = songId;
            }
            
            const playing = Player.isPlaying;
            if (playing !== lastPlayState) {
                this._updatePlayPause();
                lastPlayState = playing;
            }
            
            this._updateProgress();
        }, 500);
    },
    
    _updateMeta() {
        if (!this.pipWindow) return;
        const doc = this.pipWindow.document;
        const song = Player.currentSong();
        const cover = doc.getElementById('mp-cover');
        const bg = doc.getElementById('mp-bg');

        if (song) {
            const coverUrl = `/api/songs/${song.id}/cover`;

            // 이전 커버와 다를 때만 페이드 전환
            if (cover.src !== location.origin + coverUrl) {
                cover.style.opacity = '0';
                const img = new Image();
                img.onload = () => {
                    cover.src = coverUrl;
                    bg.style.backgroundImage = `url('${coverUrl}')`;
                    requestAnimationFrame(() => { cover.style.opacity = '1'; });
                };
                img.src = coverUrl;
            }

            doc.getElementById('mp-title').textContent = song.title || '알 수 없는 곡';
            doc.getElementById('mp-artist').textContent = song.artist || '알 수 없는 아티스트';
        } else {
            cover.style.opacity = '1';
            doc.getElementById('mp-title').textContent = '재생 중인 곡 없음';
            doc.getElementById('mp-artist').textContent = '-';
            cover.src = '/static/img/default-cover.png';
            bg.style.backgroundImage = 'none';
        }
    },
    
    _updatePlayPause() {
        if (!this.pipWindow) return;
        const btn = this.pipWindow.document.getElementById('mp-btn-play');
        if (Player.isPlaying) {
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
        } else {
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        }
    },
    
    _updateProgress() {
        if (!this.pipWindow) return;
        const doc = this.pipWindow.document;
        const audio = Player.audio;
        if (!audio.duration) return;
        
        const curr = audio.currentTime;
        const tot = audio.duration;
        const percent = (curr / tot) * 100;
        
        doc.getElementById('mp-progress-fill').style.width = `${percent}%`;
        doc.getElementById('mp-time-curr').textContent = this._formatTime(curr);
        doc.getElementById('mp-time-tot').textContent = this._formatTime(tot);
    },

    _formatTime(sec) {
        if (isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
};
