"""
Music Play — SQLite 데이터베이스 관리 모듈
곡, 앨범, 아티스트, 플레이리스트, 설정을 관리합니다.
"""

import sqlite3
import os
import json
from datetime import datetime

# 경로 설정: launcher.py가 설정한 환경변수 우선, 없으면 현재 파일 위치의 data 폴더
DB_DIR = os.environ.get(
    'MONDPLAY_DATA_DIR',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
)
DB_PATH = os.path.join(DB_DIR, 'music.db')


def get_db():
    """DB 연결을 반환합니다."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """데이터베이스 테이블을 초기화합니다."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT UNIQUE NOT NULL,
            title TEXT DEFAULT '',
            artist TEXT DEFAULT '',
            album TEXT DEFAULT '',
            album_artist TEXT DEFAULT '',
            composer TEXT DEFAULT '',
            lyricist TEXT DEFAULT '',
            genre TEXT DEFAULT '',
            year INTEGER DEFAULT 0,
            track_number INTEGER DEFAULT 0,
            track_total INTEGER DEFAULT 0,
            disc_number INTEGER DEFAULT 1,
            disc_total INTEGER DEFAULT 1,
            duration REAL DEFAULT 0,
            bitrate INTEGER DEFAULT 0,
            sample_rate INTEGER DEFAULT 0,
            channels INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0,
            file_format TEXT DEFAULT '',
            bpm INTEGER DEFAULT 0,
            rating INTEGER DEFAULT 0,
            liked INTEGER DEFAULT 0,
            disliked INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0,
            last_played TEXT DEFAULT '',
            date_added TEXT DEFAULT '',
            lyrics TEXT DEFAULT '',
            comment TEXT DEFAULT '',
            compilation INTEGER DEFAULT 0,
            grouping TEXT DEFAULT '',
            sort_title TEXT DEFAULT '',
            sort_artist TEXT DEFAULT '',
            sort_album TEXT DEFAULT '',
            sort_album_artist TEXT DEFAULT '',
            dominant_color TEXT DEFAULT '#fc3c44',
            media_kind TEXT DEFAULT '음악',
            start_time REAL DEFAULT 0,
            stop_time REAL DEFAULT 0,
            remember_position INTEGER DEFAULT 0,
            skip_when_shuffling INTEGER DEFAULT 0,
            volume_adjustment INTEGER DEFAULT 0,
            equalizer TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT '',
            updated_at TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            song_id INTEGER NOT NULL,
            position INTEGER DEFAULT 0,
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS music_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS artists_info (
            artist TEXT PRIMARY KEY,
            bio TEXT DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
        CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
        CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
        CREATE INDEX IF NOT EXISTS idx_songs_liked ON songs(liked);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_song ON playlist_songs(song_id);
    ''')

    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN lyricist TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()


# ─── 곡 (Songs) CRUD ───

def get_all_songs():
    """모든 곡을 반환합니다."""
    conn = get_db()
    songs = conn.execute('SELECT * FROM songs ORDER BY artist, album, track_number').fetchall()
    conn.close()
    return [dict(s) for s in songs]


def get_song(song_id):
    """ID로 곡을 조회합니다."""
    conn = get_db()
    song = conn.execute('SELECT * FROM songs WHERE id = ?', (song_id,)).fetchone()
    conn.close()
    return dict(song) if song else None


def search_songs(query):
    """제목, 아티스트, 앨범을 검색합니다."""
    conn = get_db()
    q = f'%{query}%'
    songs = conn.execute('''
        SELECT * FROM songs 
        WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
        ORDER BY title
    ''', (q, q, q, q)).fetchall()
    conn.close()
    return [dict(s) for s in songs]


def insert_song(song_data):
    """새 곡을 DB에 삽입합니다. 이미 존재하면 업데이트합니다."""
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute(
        'SELECT id FROM songs WHERE lower(file_path) = lower(?)', (song_data['file_path'],)
    ).fetchone()

    if existing:
        song_id = existing['id']
        # 기존 곡 업데이트 (메타데이터만)
        fields = [k for k in song_data.keys() if k != 'file_path']
        set_clause = ', '.join(f'{k} = ?' for k in fields)
        values = [song_data[k] for k in fields]
        values.append(song_id)
        cursor.execute(f'UPDATE songs SET {set_clause} WHERE id = ?', values)
    else:
        song_data['date_added'] = datetime.now().isoformat()
        fields = list(song_data.keys())
        placeholders = ', '.join('?' for _ in fields)
        columns = ', '.join(fields)
        values = [song_data[k] for k in fields]
        cursor.execute(f'INSERT INTO songs ({columns}) VALUES ({placeholders})', values)
        song_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return song_id


def update_song(song_id, data):
    """곡 메타데이터를 업데이트합니다."""
    conn = get_db()
    fields = list(data.keys())
    set_clause = ', '.join(f'{k} = ?' for k in fields)
    values = [data[k] for k in fields]
    values.append(song_id)
    conn.execute(f'UPDATE songs SET {set_clause} WHERE id = ?', values)
    conn.commit()
    conn.close()


def delete_song(song_id):
    """곡을 DB에서 삭제합니다."""
    conn = get_db()
    conn.execute('DELETE FROM songs WHERE id = ?', (song_id,))
    conn.commit()
    conn.close()


def get_recent_songs(limit=50):
    """최근 추가된 곡을 반환합니다."""
    conn = get_db()
    songs = conn.execute(
        'SELECT * FROM songs ORDER BY date_added DESC LIMIT ?', (limit,)
    ).fetchall()
    conn.close()
    return [dict(s) for s in songs]


def get_most_played_songs(limit=50):
    """가장 많이 재생한 곡을 반환합니다."""
    conn = get_db()
    songs = conn.execute(
        'SELECT * FROM songs WHERE play_count > 0 ORDER BY play_count DESC LIMIT ?', (limit,)
    ).fetchall()
    conn.close()
    return [dict(s) for s in songs]


def get_recently_played_songs(limit=50):
    """최근 재생한 곡을 반환합니다."""
    conn = get_db()
    songs = conn.execute(
        "SELECT * FROM songs WHERE last_played != '' ORDER BY last_played DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(s) for s in songs]


def get_top_artists(limit=10):
    """가장 많이 들은 아티스트 랭킹을 반환합니다."""
    conn = get_db()
    artists = conn.execute(
        '''SELECT artist, COUNT(id) as song_count, SUM(play_count) as total_plays, SUM(duration) as total_duration
           FROM songs 
           WHERE play_count > 0 
           GROUP BY artist 
           ORDER BY total_plays DESC 
           LIMIT ?''', (limit,)
    ).fetchall()
    conn.close()
    return [dict(a) for a in artists]


def get_total_play_stats():
    """총 청취 통계 요약을 반환합니다."""
    conn = get_db()
    stats = conn.execute(
        '''SELECT SUM(play_count) as total_plays, 
                  SUM(duration * play_count) as total_listened_time,
                  COUNT(DISTINCT artist) as unique_artists
           FROM songs WHERE play_count > 0'''
    ).fetchone()
    conn.close()
    
    result = dict(stats) if stats else {}
    result['total_plays'] = result.get('total_plays') or 0
    result['total_listened_time'] = result.get('total_listened_time') or 0
    result['unique_artists'] = result.get('unique_artists') or 0
    return result


def get_genre_distribution():
    """장르별 곡 수와 총 재생 횟수를 반환합니다."""
    conn = get_db()
    genres = conn.execute('''
        SELECT genre, COUNT(*) as song_count, SUM(play_count) as total_plays
        FROM songs
        WHERE genre != ''
        GROUP BY genre
        ORDER BY song_count DESC
        LIMIT 8
    ''').fetchall()
    conn.close()
    return [dict(g) for g in genres]


def get_recent_activity():
    """최근 7일간 일별 재생 횟수를 반환합니다."""
    conn = get_db()
    rows = conn.execute('''
        SELECT DATE(last_played) as play_date, COUNT(*) as play_count
        FROM songs
        WHERE last_played != '' AND DATE(last_played) >= DATE('now', '-6 days')
        GROUP BY DATE(last_played)
        ORDER BY play_date ASC
    ''').fetchall()
    conn.close()

    # 최근 7일 모두 채우기 (데이터 없는 날은 0)
    from datetime import datetime, timedelta
    result = []
    today = datetime.now().date()
    data_map = {r['play_date']: r['play_count'] for r in rows}

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        date_str = d.isoformat()
        day_label = ['월', '화', '수', '목', '금', '토', '일'][d.weekday()]
        result.append({
            'date': date_str,
            'day': day_label,
            'count': data_map.get(date_str, 0)
        })

    return result


def toggle_like(song_id):
    """좋아요를 토글합니다."""
    conn = get_db()
    song = conn.execute('SELECT liked FROM songs WHERE id = ?', (song_id,)).fetchone()
    if song:
        new_val = 0 if song['liked'] else 1
        conn.execute('UPDATE songs SET liked = ?, disliked = 0 WHERE id = ?', (new_val, song_id))
        conn.commit()
        result = new_val
    else:
        result = 0
    conn.close()
    return result


def toggle_dislike(song_id):
    """나빠요를 토글합니다."""
    conn = get_db()
    song = conn.execute('SELECT disliked FROM songs WHERE id = ?', (song_id,)).fetchone()
    if song:
        new_val = 0 if song['disliked'] else 1
        conn.execute('UPDATE songs SET disliked = ?, liked = 0 WHERE id = ?', (new_val, song_id))
        conn.commit()
        result = new_val
    else:
        result = 0
    conn.close()
    return result


def increment_play_count(song_id):
    """재생 횟수를 증가시킵니다."""
    conn = get_db()
    now = datetime.now().isoformat()
    conn.execute(
        'UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?',
        (now, song_id)
    )
    conn.commit()
    conn.close()


def reset_play_count(song_id):
    """재생 횟수를 초기화합니다."""
    conn = get_db()
    conn.execute(
        'UPDATE songs SET play_count = 0, last_played = "" WHERE id = ?', (song_id,)
    )
    conn.commit()
    conn.close()


# ─── 앨범 (Albums) ───

def get_all_albums():
    """모든 앨범을 반환합니다."""
    conn = get_db()
    albums = conn.execute('''
        SELECT album, album_artist, artist, year, dominant_color,
               COUNT(*) as song_count,
               MIN(id) as first_song_id
        FROM songs 
        WHERE album != ''
        GROUP BY album, album_artist
        ORDER BY album
    ''').fetchall()
    conn.close()
    return [dict(a) for a in albums]


def get_album_songs(album_name, album_artist=''):
    """앨범의 곡 목록을 반환합니다."""
    conn = get_db()
    if album_artist:
        songs = conn.execute(
            'SELECT * FROM songs WHERE album = ? AND (album_artist = ? OR artist = ?) ORDER BY disc_number, track_number',
            (album_name, album_artist, album_artist)
        ).fetchall()
    else:
        songs = conn.execute(
            'SELECT * FROM songs WHERE album = ? ORDER BY disc_number, track_number',
            (album_name,)
        ).fetchall()
    conn.close()
    return [dict(s) for s in songs]


# ─── 아티스트 (Artists) ───

def get_all_artists():
    """모든 아티스트를 반환합니다."""
    conn = get_db()
    artists = conn.execute('''
        SELECT artist, COUNT(*) as song_count, COUNT(DISTINCT album) as album_count
        FROM songs
        WHERE artist != ''
        GROUP BY artist
        ORDER BY artist
    ''').fetchall()
    conn.close()
    return [dict(a) for a in artists]


def get_artist_songs(artist_name):
    """아티스트의 곡 목록을 반환합니다."""
    conn = get_db()
    songs = conn.execute(
        'SELECT * FROM songs WHERE artist = ? OR album_artist = ? ORDER BY album, track_number',
        (artist_name, artist_name)
    ).fetchall()
    conn.close()
    return [dict(s) for s in songs]


# ─── 플레이리스트 (Playlists) ───

def get_all_playlists():
    """모든 플레이리스트를 반환합니다."""
    conn = get_db()
    playlists = conn.execute('SELECT * FROM playlists ORDER BY name').fetchall()
    result = []
    for p in playlists:
        p_dict = dict(p)
        count = conn.execute(
            'SELECT COUNT(*) as c FROM playlist_songs WHERE playlist_id = ?', (p['id'],)
        ).fetchone()
        p_dict['song_count'] = count['c']
        result.append(p_dict)
    conn.close()
    return result


def create_playlist(name):
    """플레이리스트를 생성합니다."""
    conn = get_db()
    now = datetime.now().isoformat()
    cursor = conn.execute(
        'INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?)',
        (name, now, now)
    )
    playlist_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return playlist_id


def rename_playlist(playlist_id, name):
    """플레이리스트 이름을 변경합니다."""
    conn = get_db()
    now = datetime.now().isoformat()
    conn.execute(
        'UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?',
        (name, now, playlist_id)
    )
    conn.commit()
    conn.close()


def delete_playlist(playlist_id):
    """플레이리스트를 삭제합니다."""
    conn = get_db()
    conn.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
    conn.commit()
    conn.close()


def get_playlist_songs(playlist_id):
    """플레이리스트의 곡 목록을 반환합니다."""
    conn = get_db()
    songs = conn.execute('''
        SELECT s.*, ps.position, ps.id as ps_id
        FROM playlist_songs ps
        JOIN songs s ON s.id = ps.song_id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position
    ''', (playlist_id,)).fetchall()
    conn.close()
    return [dict(s) for s in songs]


def add_song_to_playlist(playlist_id, song_id):
    """플레이리스트에 곡을 추가합니다."""
    conn = get_db()
    max_pos = conn.execute(
        'SELECT COALESCE(MAX(position), 0) as m FROM playlist_songs WHERE playlist_id = ?',
        (playlist_id,)
    ).fetchone()['m']
    conn.execute(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
        (playlist_id, song_id, max_pos + 1)
    )
    now = datetime.now().isoformat()
    conn.execute('UPDATE playlists SET updated_at = ? WHERE id = ?', (now, playlist_id))
    conn.commit()
    conn.close()


def reorder_playlist_songs(playlist_id, ps_ids):
    """플레이리스트의 곡 순서를 업데이트합니다. ps_ids는 playlist_songs의 id 배열입니다."""
    conn = get_db()
    # 일괄 업데이트를 위해 Transaction 사용
    for index, ps_id in enumerate(ps_ids):
        conn.execute(
            'UPDATE playlist_songs SET position = ? WHERE id = ? AND playlist_id = ?',
            (index, ps_id, playlist_id)
        )
    now = datetime.now().isoformat()
    conn.execute('UPDATE playlists SET updated_at = ? WHERE id = ?', (now, playlist_id))
    conn.commit()
    conn.close()


def remove_song_from_playlist(playlist_id, song_id):
    """플레이리스트에서 곡을 제거합니다."""
    conn = get_db()
    conn.execute(
        'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
        (playlist_id, song_id)
    )
    conn.commit()
    conn.close()


def reorder_playlist(playlist_id, song_ids):
    """플레이리스트의 곡 순서를 변경합니다."""
    conn = get_db()
    for i, song_id in enumerate(song_ids):
        conn.execute(
            'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?',
            (i + 1, playlist_id, song_id)
        )
    conn.commit()
    conn.close()


# ─── 음악 폴더 (Music Folders) ───

def get_music_folders():
    """등록된 음악 폴더 목록을 반환합니다."""
    conn = get_db()
    folders = conn.execute('SELECT * FROM music_folders').fetchall()
    conn.close()
    return [dict(f) for f in folders]


def add_music_folder(path):
    """음악 폴더를 추가합니다."""
    conn = get_db()
    try:
        conn.execute('INSERT INTO music_folders (path) VALUES (?)', (path,))
        conn.commit()
        result = True
    except sqlite3.IntegrityError:
        result = False
    conn.close()
    return result


def remove_music_folder(folder_id):
    """음악 폴더를 제거하고, 해당 폴더의 모든 곡도 보관함에서 삭제합니다."""
    conn = get_db()
    # 삭제될 폴더 경로 가져오기
    folder = conn.execute('SELECT path FROM music_folders WHERE id = ?', (folder_id,)).fetchone()
    if folder:
        folder_path = folder['path']
        # 역슬래시나 슬래시 등에 대응하기 위해 LIKE 검색 사용
        conn.execute('DELETE FROM songs WHERE file_path LIKE ?', (folder_path + '%',))
        
    conn.execute('DELETE FROM music_folders WHERE id = ?', (folder_id,))
    conn.commit()
    conn.close()

def clear_library():
    """보관함 내의 모든 곡 정보를 초기화(삭제)합니다. 플레이리스트도 비웁니다."""
    conn = get_db()
    conn.execute('DELETE FROM playlist_songs')
    conn.execute('DELETE FROM songs')
    conn.commit()
    conn.close()


# ─── 설정 (Settings) ───

def get_setting(key, default=''):
    """설정 값을 조회합니다."""
    conn = get_db()
    row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    conn.close()
    return row['value'] if row else default


def set_setting(key, value):
    """설정 값을 저장합니다."""
    conn = get_db()
    conn.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        (key, value)
    )
    conn.commit()
    conn.close()

# ─── 아티스트 상세 정보 (Artist Info) ───

def get_artist_bio(artist_name):
    """아티스트의 소개글(Bio)을 반환합니다."""
    conn = get_db()
    row = conn.execute('SELECT bio FROM artists_info WHERE artist = ?', (artist_name,)).fetchone()
    conn.close()
    return row['bio'] if row else ''


def update_artist_bio(artist_name, bio):
    """아티스트의 소개글(Bio)을 업데이트합니다."""
    conn = get_db()
    conn.execute(
        'INSERT OR REPLACE INTO artists_info (artist, bio) VALUES (?, ?)',
        (artist_name, bio)
    )
    conn.commit()
    conn.close()


def update_song_lyrics(song_id, lyrics):
    """특정 곡의 가사를 데이터베이스에 저장합니다."""
    conn = get_db()
    conn.execute(
        'UPDATE songs SET lyrics = ? WHERE id = ?',
        (lyrics, song_id)
    )
    conn.commit()
    conn.close()

# 모듈 로드 시 DB 초기화
init_db()
