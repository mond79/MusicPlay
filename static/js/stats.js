/**
 * Music Play — 강력한 통계 대시보드
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
            
            // 곡 더블클릭 시 재생
            row.style.cursor = 'pointer';
            row.addEventListener('dblclick', () => {
                Player.play(song, songs, idx);
            });
            // 우클릭 메뉴
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                ContextMenu.show(e, song, { contextType: 'stats', songs, index: idx });
            });
            
            container.appendChild(row);
        });
    }
};
