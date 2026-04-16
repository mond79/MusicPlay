const Wrapped = {
    slideIndex: 0,
    slides: [],
    progressBars: [],
    timer: null,
    SLIDE_DURATION: 5000,
    data: null,

    init() {
        this.slides = document.querySelectorAll('.wrapped-slide');
        this.progressContainer = document.getElementById('wrapped-progress');
        
        // 이벤트 바인딩
        document.getElementById('wrapped-prev').addEventListener('click', () => this.prevSlide());
        document.getElementById('wrapped-next').addEventListener('click', () => this.nextSlide());
        document.getElementById('btn-wrapped-close').addEventListener('click', () => this.close());
        document.querySelector('.btn-wrapped-start').addEventListener('click', () => this.nextSlide());
        document.querySelector('.btn-wrapped-replay').addEventListener('click', () => this.replay());
    },

    async show() {
        try {
            const res = await fetch('/api/stats');
            this.data = await res.json();
            
            // 데이터가 아예 없으면 안내
            if (!this.data.summary || this.data.summary.total_plays === 0) {
                alert("아직 분석할 청취 데이터가 충분하지 않습니다. 음악을 더 들어보세요!");
                return;
            }

            this.populateData();
            this.buildProgressBars();
            
            document.getElementById('view-wrapped').classList.remove('hidden');
            this.slideIndex = 0;
            this.updateSlides();
            
        } catch (error) {
            console.error("Wrapped 데이터 로딩 오류:", error);
        }
    },

    close() {
        document.getElementById('view-wrapped').classList.add('hidden');
        this.clearTimer();
    },

    replay() {
        this.slideIndex = 0;
        this.updateSlides();
    },

    populateData() {
        // 총 청취 시간 (분 단위 변환, 데이터베이스 duration이 초 단위라고 가정)
        // playtime은 sum(duration * play_count) 로 가정
        let totalMinutes = Math.floor((this.data.summary.total_listened_time || 0) / 60);
        document.getElementById('wrapped-total-time').innerText = totalMinutes.toLocaleString();

        // 1위 아티스트
        if (this.data.top_artists && this.data.top_artists.length > 0) {
            const top1 = this.data.top_artists[0];
            document.getElementById('wrapped-top-artist-name').innerText = top1.artist || "Unknown";
            document.getElementById('wrapped-top-artist-plays').innerText = top1.total_plays || 0;
            
            // 이미지 설정
            const safeName = btoa(unescape(encodeURIComponent(top1.artist || ''))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            document.getElementById('wrapped-top-artist-img').src = `/api/artists/${safeName}/image`;
            document.getElementById('wrapped-top-artist-img').onerror = function() {
                this.src = 'data:image/svg+xml;utf8,<svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="1" xmlns="http://www.w3.org/2000/svg"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
            };
        } else {
            document.getElementById('wrapped-top-artist-name').innerText = "없음";
        }

        // Top 5 Songs
        const ul = document.getElementById('wrapped-top-songs-list');
        ul.innerHTML = '';
        const songs = this.data.top_songs || [];
        for (let i = 0; i < Math.min(5, songs.length); i++) {
            const s = songs[i];
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="rank">#${i + 1}</div>
                <div class="song-info-wrap">
                    <span class="song-title">${s.title || 'Unknown Title'}</span>
                    <span class="song-artist">${s.artist || 'Unknown Artist'}</span>
                </div>
            `;
            ul.appendChild(li);
        }

        // 장르 Top 3
        const genres = this.data.genre_distribution || [];
        for (let i = 0; i < 3; i++) {
            const gText = (genres[i] && genres[i].genre) ? genres[i].genre : "-";
            const el = document.getElementById(`wrapped-g${i+1}`);
            if (el) el.innerText = gText;
        }
    },

    buildProgressBars() {
        this.progressContainer.innerHTML = '';
        this.progressBars = [];
        for (let i = 0; i < this.slides.length; i++) {
            const bar = document.createElement('div');
            bar.className = 'wrapped-progress-bar';
            bar.innerHTML = '<div class="fill"></div>';
            this.progressContainer.appendChild(bar);
            this.progressBars.push(bar.querySelector('.fill'));
        }
    },

    updateSlides() {
        this.clearTimer();
        
        // 슬라이드 표시
        this.slides.forEach((sl, idx) => {
            if (idx === this.slideIndex) sl.classList.add('active');
            else sl.classList.remove('active');
        });

        // 프로그레스 바 갱신
        this.progressBars.forEach((fill, idx) => {
            fill.style.transition = 'none';
            if (idx < this.slideIndex) fill.style.width = '100%';
            else if (idx > this.slideIndex) fill.style.width = '0%';
            else fill.style.width = '0%'; // 현재
        });

        // 애니메이션 시작 (약간의 지연 후)
        setTimeout(() => {
            if(window.getComputedStyle(document.getElementById('view-wrapped')).display !== 'none') {
                 const currentFill = this.progressBars[this.slideIndex];
                 currentFill.style.transition = `width ${this.SLIDE_DURATION}ms linear`;
                 currentFill.style.width = '100%';
                 
                 // 아웃트로가 아니면 다음 슬라이드 타이머 작동
                 if (this.slideIndex < this.slides.length - 1) {
                     this.timer = setTimeout(() => this.nextSlide(), this.SLIDE_DURATION);
                 }
            }
        }, 50);
    },

    nextSlide() {
        if (this.slideIndex < this.slides.length - 1) {
            this.slideIndex++;
            this.updateSlides();
        }
    },

    prevSlide() {
        if (this.slideIndex > 0) {
            this.slideIndex--;
            this.updateSlides();
        }
    },

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    Wrapped.init();
});
