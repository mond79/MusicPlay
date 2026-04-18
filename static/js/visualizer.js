/**
 * Mond Play — 시네마틱 비주얼라이저
 * Web Audio API AnalyserNode를 시각화합니다.
 */

const Visualizer = {
    canvas: null,
    ctx: null,
    animationId: null,
    isActive: false,

    init() {
        this._bindUI();
    },

    _bindUI() {
        const btn = document.getElementById('btn-visualizer');
        const overlay = document.getElementById('visualizer-overlay');
        const closeBtn = document.getElementById('btn-visualizer-close');
        if (!btn || !overlay) return;

        btn.addEventListener('click', () => {
            this.toggle();
        });

        // 닫기 버튼 클릭 (이벤트 버블링 차단)
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        // 오버레이 클릭 시 닫기
        overlay.addEventListener('click', () => {
            this.close();
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.close();
            }
        });

        window.addEventListener('resize', () => {
            if (this.isActive && this.canvas) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
        });
    },

    toggle() {
        if (this.isActive) this.close();
        else this.open();
    },

    open() {
        // AudioContext가 아직 없으면 초기화
        if (window.Equalizer) {
            Equalizer.resume();
        }
        
        console.log('[Visualizer] open()', {
            hasAnalyser: !!Equalizer.analyser,
            hasAudioCtx: !!Equalizer.audioCtx,
            audioCtxState: Equalizer.audioCtx?.state,
            isPlaying: Player.isPlaying,
            audioSrc: !!Player.audio?.src
        });

        const overlay = document.getElementById('visualizer-overlay');
        overlay.classList.remove('hidden');
        this.isActive = true;

        if (!this.canvas) {
            this.canvas = document.getElementById('visualizer-canvas');
            this.ctx = this.canvas.getContext('2d');
        }

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this._updateBackground();
        this._draw();
    },

    close() {
        const overlay = document.getElementById('visualizer-overlay');
        overlay.classList.add('hidden');
        this.isActive = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    _updateBackground() {
        const song = Player.currentSong();
        const bg = document.getElementById('visualizer-bg');
        if (song) {
            bg.style.backgroundImage = `url('/api/songs/${song.id}/cover')`;
        } else {
            bg.style.backgroundImage = "url('/static/img/default-cover.png')";
        }
    },

    _draw() {
        if (!this.isActive) return;

        this.animationId = requestAnimationFrame(() => this._draw());

        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 캔버스 클리어 (잔상 효과)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.ctx.fillRect(0, 0, width, height);

        // 재생 중이 아니거나 Analyser가 아직 없는 경우 안내 표시
        if (!Equalizer.analyser || !Player.isPlaying) {
            this.ctx.clearRect(0, 0, width, height);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.font = '20px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('음악을 재생하면 비주얼라이저가 시작됩니다', width / 2, height / 2);
            return;
        }

        // 주파수 데이터 가져오기
        const bufferLength = Equalizer.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        Equalizer.analyser.getByteFrequencyData(dataArray);

        // 바 그리기 수치
        const barCount = Math.min(bufferLength, 80); // 최대 80개 바
        const totalBarWidth = width * 0.85;
        const barWidth = totalBarWidth / barCount - 2;
        let x = (width - totalBarWidth) / 2; // 중앙 정렬

        for (let i = 0; i < barCount; i++) {
            const value = dataArray[i];

            // 색상: 주파수 대역별 그라데이션
            const hue = (i / barCount) * 240 + 180; // 청록 → 보라 스펙트럼
            const saturation = 80;
            const lightness = 40 + (value / 255) * 30;

            this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // 바 높이 (화면 높이 최대 65%)
            const h = (value / 255) * (height * 0.65);
            
            // 둥근 모서리 바
            const radius = Math.min(barWidth / 2, 4);
            this._roundRect(x, height - h, barWidth, h, radius);

            x += barWidth + 2;
        }
    },

    _roundRect(x, y, w, h, r) {
        if (h <= 0) return;
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h);
        this.ctx.lineTo(x, y + h);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
        this.ctx.fill();
    }
};
