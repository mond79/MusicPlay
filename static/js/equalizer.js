/**
 * Mond Play — 이퀄라이저 (10-Band EQ)
 */

const Equalizer = {
    audioCtx: null,
    source: null,
    analyser: null,
    compressor: null,
    filters: [],
    isEnabled: false,
    isNormEnabled: false,
    
    // 10 밴드 주파수
    frequencies: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    
    presets: {
        'Flat':       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        'Acoustic':   [5, 5, 4, 1, 2, 2, 3, 4, 3, 2],
        'Bass Boost': [6, 5, 4, 2, 1, 0, 0, 0, 0, 0],
        'Classical':  [5, 4, 3, 2, -2, -2, 0, 2, 4, 5],
        'Dance':      [7, 6, 3, 0, 0, -2, -4, -4, 0, 0],
        'Electronic': [4, 3, 1, 0, -2, 2, 1, 2, 3, 4],
        'Hip-Hop':    [5, 4, 2, 3, -1, -2, 1, 2, -1, 1],
        'Pop':        [-2, -1, 2, 3, 4, 4, 2, 0, -1, -2],
        'R&B':        [3, 2, -1, 1, 3, 2, 1, 2, 1, 2],
        'Rock':       [5, 4, 3, 1, -1, -2, 1, 3, 4, 5]
    },

    init() {
        this._bindUI();

        // 저장된 EQ 상태 복원
        const saved = localStorage.getItem('mp-eq');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.isEnabled = data.enabled || false;
                
                // AudioContext는 사용자 상호작용 후 생성/초기화되므로 UI만 먼저 세팅
                document.getElementById('eq-toggle').checked = this.isEnabled;
                if (data.gains) {
                    this._updateSlidersTo(data.gains);
                }
            } catch(e) {}
        }

        // 저장된 노멀라이제이션 상태 복원
        const savedNorm = localStorage.getItem('mp-norm');
        this.isNormEnabled = savedNorm === 'true';
    },

    // 실제 Web Audio API 초기화 (최초 재생 시 호출됨)
    _initAudioContext() {
        if (this.audioCtx) return;

        const audioEl = Player.audio;
        if (!audioEl) {
            console.warn('[EQ] Player.audio가 없습니다');
            return;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            console.log('[EQ] AudioContext 생성 완료, state:', this.audioCtx.state);

            // 10 밴드 필터 생성
            this.filters = this.frequencies.map(freq => {
                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1;
                filter.gain.value = 0;
                return filter;
            });

            // AnalyserNode 생성
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;

            // DynamicsCompressor (볼륨 노멀라이제이션)
            this.compressor = this.audioCtx.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            // 소스 연결 체인
            this.source = this.audioCtx.createMediaElementSource(audioEl);
            
            // 체인 연결: source → filters → compressor → analyser → destination
            this._rebuildChain();

            // 초기 게인 적용
            this._applyCurrentGains();

            console.log('[EQ] 오디오 체인 연결 완료, analyser:', !!this.analyser, ', compressor:', !!this.compressor);
        } catch (e) {
            console.error('[EQ] AudioContext 초기화 실패:', e);
            // 실패 시 상태 정리
            this.audioCtx = null;
            this.analyser = null;
            this.source = null;
        }
    },

    _bindUI() {
        const modal = document.getElementById('eq-modal');
        const btnOpen = document.getElementById('btn-eq');
        const btnClose = document.getElementById('eq-close');
        
        if (btnOpen) btnOpen.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
        
        if (btnClose) btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // 배경 클릭 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        // 켜기/끄기 토글
        const toggle = document.getElementById('eq-toggle');
        toggle.addEventListener('change', (e) => {
            this.isEnabled = e.target.checked;
            this._saveState();
            
            if (!this.audioCtx) this._initAudioContext();
            this._rebuildChain();
            
            if (this.isEnabled) {
                document.getElementById('eq-sliders').classList.remove('disabled');
            } else {
                document.getElementById('eq-sliders').classList.add('disabled');
            }
        });

        // 슬라이더 변경 이벤트
        const sliders = document.querySelectorAll('.eq-slider');
        sliders.forEach((slider, idx) => {
            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (this.filters[idx]) {
                    this.filters[idx].gain.value = val;
                }
                this._saveState();
            });
        });

        // 프리셋 선택
        const presetSelect = document.getElementById('eq-preset');
        
        // 프리셋 옵션 채우기
        for (let key in this.presets) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            presetSelect.appendChild(opt);
        }

        presetSelect.addEventListener('change', (e) => {
            const p = e.target.value;
            if (this.presets[p]) {
                this._updateSlidersTo(this.presets[p]);
                this._applyCurrentGains();
                this._saveState();
            }
        });
    },

    // 오디오 체인 재구성: source → [filters] → [compressor] → analyser → destination
    _rebuildChain() {
        if (!this.audioCtx || !this.source) return;
        
        // 기존 연결 해제
        this.source.disconnect();
        this.filters.forEach(f => f.disconnect());
        if (this.compressor) this.compressor.disconnect();
        if (this.analyser) this.analyser.disconnect();
        
        let prevNode = this.source;
        
        // EQ 필터 체인 (켜져있을 때만)
        if (this.isEnabled) {
            this.filters.forEach(filter => {
                prevNode.connect(filter);
                prevNode = filter;
            });
        }
        
        // 노멀라이제이션 (켜져있을 때만)
        if (this.isNormEnabled && this.compressor) {
            prevNode.connect(this.compressor);
            prevNode = this.compressor;
        }
        
        // 항상 analyser → destination
        prevNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
    },

    toggleNormalization(enabled) {
        this.isNormEnabled = enabled;
        localStorage.setItem('mp-norm', enabled ? 'true' : 'false');
        if (this.audioCtx) {
            this._rebuildChain();
        }
    },

    _updateSlidersTo(gainsArray) {
        const sliders = document.querySelectorAll('.eq-slider');
        sliders.forEach((slider, idx) => {
            if (gainsArray[idx] !== undefined) {
                slider.value = gainsArray[idx];
            }
        });
    },

    _applyCurrentGains() {
        const sliders = document.querySelectorAll('.eq-slider');
        sliders.forEach((slider, idx) => {
            if (this.filters[idx]) {
                this.filters[idx].gain.value = parseFloat(slider.value);
            }
        });
    },

    _saveState() {
        const sliders = document.querySelectorAll('.eq-slider');
        const gains = Array.from(sliders).map(s => parseFloat(s.value));
        localStorage.setItem('mp-eq', JSON.stringify({
            enabled: this.isEnabled,
            gains: gains
        }));
    },

    // Player의 play 이벤트 시 호출하여 중지된 AudioContext를 깨움
    resume() {
        if (!this.audioCtx) {
            this._initAudioContext();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }
};
