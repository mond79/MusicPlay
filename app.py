"""
Music Play — Flask 메인 서버
Apple Music / iTunes 스타일 음악 플레이어의 백엔드 API 서버입니다.
"""

import os
import json
import mimetypes
from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_cors import CORS

import database as db
import music_scanner as scanner
import tag_writer

app = Flask(__name__)
CORS(app)

@app.after_request
def add_header(response):
    if request.path.startswith('/api/'):
        response.cache_control.no_store = True
        response.cache_control.max_age = 0
    return response

# MIME 타입 등록
mimetypes.add_type('audio/flac', '.flac')
mimetypes.add_type('audio/mp4', '.m4a')
mimetypes.add_type('audio/aac', '.aac')
mimetypes.add_type('audio/ogg', '.ogg')


# ─── 페이지 ───

@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')


# ─── 곡 API ───

@app.route('/api/songs')
def api_get_songs():
    """모든 곡 목록"""
    songs = db.get_all_songs()
    return jsonify(songs)


@app.route('/api/songs/search')
def api_search_songs():
    """곡 검색"""
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    songs = db.search_songs(query)
    return jsonify(songs)


@app.route('/api/songs/<int:song_id>')
def api_get_song(song_id):
    """곡 상세 정보"""
    song = db.get_song(song_id)
    if song:
        return jsonify(song)
    return jsonify({'error': '곡을 찾을 수 없습니다'}), 404


@app.route('/api/songs/<int:song_id>', methods=['PUT'])
def api_update_song(song_id):
    """곡 메타데이터 업데이트 (DB + 파일 태그)"""
    data = request.get_json()
    song = db.get_song(song_id)
    if not song:
        return jsonify({'error': '곡을 찾을 수 없습니다'}), 404

    # DB 업데이트
    db.update_song(song_id, data)

    # 파일 태그도 업데이트
    tag_writer.write_metadata(song['file_path'], data)

    return jsonify({'success': True, 'song': db.get_song(song_id)})


@app.route('/api/songs/<int:song_id>', methods=['DELETE'])
def api_delete_song(song_id):
    """곡을 보관함에서 삭제하고, 이후 스캔 방지를 위해 .musicignore에 기록"""
    song = db.get_song(song_id)
    if song and song.get('file_path'):
        file_path = song['file_path']
        folder_path = os.path.dirname(file_path)
        file_name = os.path.basename(file_path)
        
        ignore_path = os.path.join(folder_path, '.musicignore')
        try:
            with open(ignore_path, 'a', encoding='utf-8') as f:
                f.write(file_name + '\n')
        except Exception as e:
            print(f".musicignore 쓰기 오류: {e}")

    db.delete_song(song_id)
    return jsonify({'success': True})


@app.route('/api/songs/<int:song_id>/stream')
def api_stream_song(song_id):
    """곡 오디오 스트리밍"""
    song = db.get_song(song_id)
    if not song:
        return jsonify({'error': '곡을 찾을 수 없습니다'}), 404

    file_path = song['file_path']
    if not os.path.exists(file_path):
        return jsonify({'error': '파일을 찾을 수 없습니다'}), 404

    mime_type = mimetypes.guess_type(file_path)[0] or 'audio/mpeg'
    file_size = os.path.getsize(file_path)

    # Range 헤더 지원 (탐색을 위해)
    range_header = request.headers.get('Range')
    if range_header:
        byte_start = 0
        byte_end = file_size - 1

        match = range_header.replace('bytes=', '').split('-')
        byte_start = int(match[0])
        if match[1]:
            byte_end = int(match[1])

        content_length = byte_end - byte_start + 1

        def generate():
            with open(file_path, 'rb') as f:
                f.seek(byte_start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(8192, remaining)
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = Response(
            generate(),
            status=206,
            mimetype=mime_type,
            direct_passthrough=True
        )
        response.headers.add('Content-Range', f'bytes {byte_start}-{byte_end}/{file_size}')
        response.headers.add('Accept-Ranges', 'bytes')
        response.headers.add('Content-Length', str(content_length))
        return response
    else:
        return send_file(file_path, mimetype=mime_type)


@app.route('/api/songs/<int:song_id>/cover')
def api_get_cover(song_id):
    """곡의 앨범 커버 이미지"""
    song = db.get_song(song_id)
    if not song:
        return jsonify({'error': '곡을 찾을 수 없습니다'}), 404

    # 저장된 커버 찾기
    cover_path = scanner.save_cover_art(song['file_path'])
    if cover_path and os.path.exists(cover_path):
        return send_file(cover_path, mimetype='image/jpeg')

    # 기본 커버 없음 → 빈 이미지
    return '', 204


@app.route('/api/songs/<int:song_id>/cover', methods=['PUT'])
def api_update_cover(song_id):
    """앨범 커버 업데이트"""
    song = db.get_song(song_id)
    if not song:
        return jsonify({'error': '곡을 찾을 수 없습니다'}), 404

    if 'cover' not in request.files:
        return jsonify({'error': '이미지 파일이 없습니다'}), 400

    cover_file = request.files['cover']
    image_data = cover_file.read()
    mime_type = cover_file.content_type or 'image/jpeg'

    # 파일에 커버 내장
    tag_writer.write_cover_art(song['file_path'], image_data, mime_type)

    # 캐시 커버 업데이트
    import hashlib
    path_hash = hashlib.md5(song['file_path'].encode('utf-8')).hexdigest()[:16]
    cover_path = os.path.join(scanner.COVER_DIR, f'{path_hash}.jpg')
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(image_data))
    img = img.convert('RGB')
    img.thumbnail((500, 500), Image.Resampling.LANCZOS)
    img.save(cover_path, 'JPEG', quality=90)

    # 색상 재추출
    new_color = scanner.get_dominant_color(cover_path)
    db.update_song(song_id, {'dominant_color': new_color})

    return jsonify({'success': True, 'dominant_color': new_color})


@app.route('/api/songs/<int:song_id>/like', methods=['POST'])
def api_toggle_like(song_id):
    """좋아요 토글"""
    result = db.toggle_like(song_id)
    return jsonify({'liked': result})


@app.route('/api/songs/<int:song_id>/dislike', methods=['POST'])
def api_toggle_dislike(song_id):
    """나빠요 토글"""
    result = db.toggle_dislike(song_id)
    return jsonify({'disliked': result})


@app.route('/api/songs/<int:song_id>/play', methods=['POST'])
def api_increment_play(song_id):
    """재생 횟수 증가"""
    db.increment_play_count(song_id)
    return jsonify({'success': True})


@app.route('/api/songs/<int:song_id>/reset-plays', methods=['POST'])
def api_reset_plays(song_id):
    """재생 횟수 초기화"""
    db.reset_play_count(song_id)
    return jsonify({'success': True})


# ─── 앨범 API ───

@app.route('/api/albums')
def api_get_albums():
    """모든 앨범 목록"""
    albums = db.get_all_albums()
    return jsonify(albums)


@app.route('/api/albums/<path:album_name>')
def api_get_album(album_name):
    """앨범의 곡 목록"""
    artist = request.args.get('artist', '')
    songs = db.get_album_songs(album_name, artist)
    return jsonify(songs)


# ─── 아티스트 API ───

@app.route('/api/artists')
def api_get_artists():
    """모든 아티스트 목록"""
    artists = db.get_all_artists()
    return jsonify(artists)


@app.route('/api/artists/<path:artist_name>')
def api_get_artist(artist_name):
    """아티스트의 곡 목록"""
    songs = db.get_artist_songs(artist_name)
    return jsonify(songs)


# ─── 플레이리스트 API ───

@app.route('/api/playlists')
def api_get_playlists():
    """모든 플레이리스트"""
    playlists = db.get_all_playlists()
    return jsonify(playlists)


@app.route('/api/playlists', methods=['POST'])
def api_create_playlist():
    """플레이리스트 생성"""
    data = request.get_json()
    name = data.get('name', '새 플레이리스트')
    playlist_id = db.create_playlist(name)
    return jsonify({'id': playlist_id, 'name': name})


@app.route('/api/playlists/<int:playlist_id>', methods=['PUT'])
def api_rename_playlist(playlist_id):
    """플레이리스트 이름 변경"""
    data = request.get_json()
    name = data.get('name', '')
    db.rename_playlist(playlist_id, name)
    return jsonify({'success': True})


@app.route('/api/playlists/<int:playlist_id>', methods=['DELETE'])
def api_delete_playlist(playlist_id):
    """플레이리스트 삭제"""
    db.delete_playlist(playlist_id)
    return jsonify({'success': True})


@app.route('/api/playlists/<int:playlist_id>/songs')
def api_get_playlist_songs(playlist_id):
    """플레이리스트의 곡 목록"""
    songs = db.get_playlist_songs(playlist_id)
    return jsonify(songs)


@app.route('/api/playlists/<int:playlist_id>/songs', methods=['POST'])
def api_add_to_playlist(playlist_id):
    """플레이리스트에 곡 추가"""
    data = request.get_json()
    song_id = data.get('song_id')
    if song_id:
        db.add_song_to_playlist(playlist_id, song_id)
        return jsonify({'success': True})
    return jsonify({'error': 'song_id가 필요합니다'}), 400


@app.route('/api/playlists/<int:playlist_id>/songs/<int:song_id>', methods=['DELETE'])
def api_remove_from_playlist(playlist_id, song_id):
    """플레이리스트에서 곡 제거"""
    db.remove_song_from_playlist(playlist_id, song_id)
    return jsonify({'success': True})


@app.route('/api/playlists/<int:playlist_id>/reorder', methods=['PUT'])
def api_reorder_playlist(playlist_id):
    """플레이리스트 순서 변경"""
    data = request.get_json()
    song_ids = data.get('song_ids', [])
    db.reorder_playlist(playlist_id, song_ids)
    return jsonify({'success': True})


# ─── 스캔 API ───

@app.route('/api/scan', methods=['POST'])
def api_scan():
    """음악 폴더 스캔"""
    data = request.get_json() or {}
    folder = data.get('folder', '')

    if folder:
        # 특정 폴더 스캔
        folders = [folder]
    else:
        # 등록된 모든 폴더 스캔
        folders = [f['path'] for f in db.get_music_folders()]

    if not folders:
        return jsonify({'error': '스캔할 폴더가 없습니다', 'scanned': 0})

    total_imported = 0
    for f in folders:
        results, count = scanner.scan_and_import(f)
        for song_data in results:
            db.insert_song(song_data)
            total_imported += 1

    return jsonify({'success': True, 'scanned': total_imported})


# ─── 설정 API ───

@app.route('/api/settings/folders')
def api_get_folders():
    """등록된 음악 폴더 목록"""
    folders = db.get_music_folders()
    return jsonify(folders)


@app.route('/api/settings/folders', methods=['POST'])
def api_add_folder():
    """음악 폴더 추가"""
    data = request.get_json()
    path = data.get('path', '')
    if not path:
        return jsonify({'error': '폴더 경로가 필요합니다'}), 400
    if not os.path.isdir(path):
        return jsonify({'error': '유효하지 않은 폴더 경로입니다'}), 400
    result = db.add_music_folder(path)
    if result:
        return jsonify({'success': True})
    return jsonify({'error': '이미 등록된 폴더입니다'}), 409


@app.route('/api/settings/folders/<int:folder_id>', methods=['DELETE'])
def api_remove_folder(folder_id):
    """음악 폴더 제거 및 해당 곡 삭제"""
    db.remove_music_folder(folder_id)
    return jsonify({'success': True})

@app.route('/api/settings/reset', methods=['POST'])
def api_reset_library():
    """보관함 전체 곡 및 메타데이터 초기화"""
    db.clear_library()
    return jsonify({'success': True})


@app.route('/api/tools/browse-folder')
def api_browse_folder():
    """OS 기본 폴더 선택 창 띄우기"""
    import tkinter as tk
    from tkinter import filedialog
    
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    folder_path = filedialog.askdirectory(parent=root, title="음악 폴더 선택")
    root.destroy()
    
    return jsonify({'path': folder_path or ''})


# ─── 실행 ───

if __name__ == '__main__':
    print("[Music Play] 서버를 시작합니다...")
    print("  http://localhost:5000 에서 접속하세요")
    app.run(debug=True, port=5000)
