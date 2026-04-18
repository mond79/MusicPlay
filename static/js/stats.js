/**
 * Mond Play — 강력한 통계 대시보드
 */

const Stats = {
    async render() {
        Library._hideAllViews();
        const view = document.getElementById('view-stats');
        view.classList.remove('hidden');

        const res = await fetch('/api/stats');
        const data = await res.json();
        
        App.pushHistory({ view: 'stats' });

        this._renderSummary(data.summary);
        this._renderTopArtists(data.top_artists);
        this._renderTopSongs(data.top_songs);
        this._renderGenreChart(data.genre_distribution || []);
        this._renderRecentActivity(data.recent_activity || []);
    },

    _renderSummary(summary) {
        const timeH = Math.floor(summary.total_listened_time / 3600);
        const timeM = Math.floor((summary.total_listened_time % 3600) / 60);
        
        document.getElementById('stat-total-plays').textContent = summary.total_plays.toLocaleString() + '회';
        document.getElementById('stat-total-time').textContent = `${timeH}시간 ${timeM}분`;
        document.getElementById('stat-unique-artists').textContent = summary.unique_artists.toLocaleString() + '명';
    },

    _renderTopArtists(artists) {
        const container = document.getElementById('stat-top-artists');
        container.innerHTML = '';
        
        if (artists.length === 0) {
            container.innerHTML = '<div class="empty-state">재생 기록이 없습니다.</div>';
            return;
        }

        const maxPlays = Math.max(...artists.map(a => a.total_plays));

        artists.forEach((artist, idx) => {
            const row = document.createElement('div');
            row.className = 'stat-bar-row';
            
            const percent = Math.max(5, (artist.total_plays / maxPlays) * 100);
            
            row.innerHTML = `
                <div class="stat-meta">
                    <span class="stat-rank">${idx + 1}</span>
                    <span class="stat-name">${Library._escapeHtml(artist.artist || '알 수 없는 아티스트')}</span>
                    <span class="stat-val">${artist.total_plays}회</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${percent}%;"></div>
                </div>
            `;
            
            // 아티스트 클릭 시 해당 아티스트 뷰로 이동
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => Library.showArtistDetail(artist.artist));
            
            container.appendChild(row);
        });
    },

    _renderTopSongs(songs) {
        const container = document.getElementById('stat-top-songs');
        container.innerHTML = '';
        
        if (songs.length === 0) {
            container.innerHTML = '<div class="empty-state">재생 기록이 없습니다.</div>';
            return;
        }

        const maxPlays = Math.max(...songs.map(s => s.play_count));

        songs.forEach((song, idx) => {
            const row = document.createElement('div');
            row.className = 'stat-bar-row';
            
            const percent = Math.max(5, (song.play_count / maxPlays) * 100);
            
            row.innerHTML = `
                <div class="stat-meta">
                    <span class="stat-rank">${idx + 1}</span>
                    <img class="stat-cover" src="/api/songs/${song.id}/cover" onerror="this.src='/static/img/default-cover.png'">
                    <span class="stat-name" style="flex:1;">
                        ${Library._escapeHtml(song.title)} 
                        <span style="font-size:12px; color:var(--text-tertiary)">- ${Library._escapeHtml(song.artist)}</span>
                    </span>
                    <span class="stat-val">${song.play_count}회</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${percent}%;"></div>
                </div>
            `;
            
            // 곡 더블클릭(PC) 및 클릭(모바일) 시 재생
            row.style.cursor = 'pointer';
            
            row.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    Player.play(song, songs, idx);
                }
            });
            
            row.addEventListener('dblclick', () => {
                // PC는 기존처럼 더블클릭
                Player.play(song, songs, idx);
            });
            // 우클릭 메뉴
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ContextMenu.show(e, song, { contextType: 'stats', songs, index: idx });
            });
            
            container.appendChild(row);
        });
    },

    _renderGenreChart(genres) {
        const container = document.getElementById('stat-genre-chart');
        container.innerHTML = '';

        if (genres.length === 0) {
            container.innerHTML = '<div class="empty-state">장르 정보가 있는 곡이 없습니다.</div>';
            return;
        }

        const colors = [
            '#fc3c44', '#ff6b6b', '#ffa94d', '#ffd43b',
            '#69db7c', '#38d9a9', '#4dabf7', '#9775fa'
        ];

        const total = genres.reduce((sum, g) => sum + g.song_count, 0);

        // 도넛 차트 (conic-gradient)
        let gradientParts = [];
        let accumulated = 0;
        genres.forEach((genre, idx) => {
            const pct = (genre.song_count / total) * 100;
            const start = accumulated;
            accumulated += pct;
            gradientParts.push(`${colors[idx % colors.length]} ${start}% ${accumulated}%`);
        });

        const donut = document.createElement('div');
        donut.className = 'genre-donut';
        donut.style.background = `conic-gradient(${gradientParts.join(', ')})`;

        const donutHole = document.createElement('div');
        donutHole.className = 'genre-donut-hole';
        donutHole.innerHTML = `<span class="genre-donut-total">${total}</span><span class="genre-donut-label">곡</span>`;
        donut.appendChild(donutHole);

        // 범례
        const legend = document.createElement('div');
        legend.className = 'genre-legend';
        genres.forEach((genre, idx) => {
            const pct = ((genre.song_count / total) * 100).toFixed(1);
            const item = document.createElement('div');
            item.className = 'genre-legend-item';
            item.innerHTML = `
                <span class="genre-legend-color" style="background:${colors[idx % colors.length]}"></span>
                <span class="genre-legend-name">${Library._escapeHtml(genre.genre)}</span>
                <span class="genre-legend-pct">${pct}%</span>
            `;
            legend.appendChild(item);
        });

        container.appendChild(donut);
        container.appendChild(legend);
    },

    _renderRecentActivity(activity) {
        const container = document.getElementById('stat-recent-activity');
        container.innerHTML = '';

        if (activity.length === 0) {
            container.innerHTML = '<div class="empty-state">최근 재생 기록이 없습니다.</div>';
            return;
        }

        const maxCount = Math.max(...activity.map(a => a.count), 1);

        const chart = document.createElement('div');
        chart.className = 'activity-bars';

        activity.forEach(day => {
            const barWrap = document.createElement('div');
            barWrap.className = 'activity-bar-wrap';

            const height = Math.max(4, (day.count / maxCount) * 100);

            barWrap.innerHTML = `
                <div class="activity-bar-value">${day.count}</div>
                <div class="activity-bar" style="height: ${height}%"></div>
                <div class="activity-bar-label">${day.day}</div>
            `;
            chart.appendChild(barWrap);
        });

        const totalWeek = activity.reduce((s, d) => s + d.count, 0);
        const summary = document.createElement('div');
        summary.className = 'activity-summary';
        summary.textContent = `이번 주 총 ${totalWeek}회 재생`;

        container.appendChild(chart);
        container.appendChild(summary);
    }
};
