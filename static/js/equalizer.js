/**
 * Music Play — 이퀄라이저 (10-Band EQ)
 */

const Equalizer = {
    audioCtx: null,
    source: null,
    filters: [],
    isEnabled: false,
    
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
    },

    // 실제 Web Audio API 초기화 (최초 재생 시 호출됨)
    _initAudioContext() {
        if (this.audioCtx) return;

        const audioEl = Player.audio;
        if (!audioEl) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        // 10 밴드 필터 생성
        this.filters = this.frequencies.map(freq => {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });

        // 양 끝 주파수는 쉘빙 필터(shelving)로 변경하면 더 자연스럽지만 일반성을 위해 peaking 유지

        // 소스 연결: audio -> filter[0] -> filter[1] ... -> destination
        this.source = this.audioCtx.createMediaElementSource(audioEl);
        
        let prevNode = this.source;
        this.filters.forEach(filter => {
            prevNode.connect(filter);
            prevNode = filter;
        });
        prevNode.connect(this.audioCtx.destination);

        // 초기 게인 적용
        this._applyCurrentGains();
        
        // 끄기 상태면 바이패스
        if (!this.isEnabled) {
            this._bypass();
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
            
            if (this.isEnabled) {
                if (this.audioCtx && this.source) {
                    this.source.disconnect();
                    let prevNode = this.source;
                    this.filters.forEach(filter => {
                        prevNode.connect(filter);
                        prevNode = filter;
                    });
                    prevNode.connect(this.audioCtx.destination);
                }
                document.getElementById('eq-sliders').classList.remove('disabled');
            } else {
                this._bypass();
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

    _bypass() {
        if (!this.audioCtx || !this.source) return;
        this.source.disconnect();
        this.filters.forEach(f => f.disconnect());
        this.source.connect(this.audioCtx.destination);
        document.getElementById('eq-sliders').classList.add('disabled');
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
