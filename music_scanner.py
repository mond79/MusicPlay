"""
Music Play — 음악 파일 스캐너 & 메타데이터 파서
MP3, FLAC, M4A, WAV, OGG 파일을 스캔하고 메타데이터를 추출합니다.
"""

import os
import io
import hashlib
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis
from mutagen.wave import WAVE
from mutagen.id3 import ID3
from PIL import Image

SUPPORTED_EXTENSIONS = {'.mp3', '.flac', '.m4a', '.aac', '.wav', '.ogg'}
COVER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'covers')


def ensure_cover_dir():
    """커버 아트 저장 디렉토리를 생성합니다."""
    os.makedirs(COVER_DIR, exist_ok=True)


def scan_folder(folder_path):
    """폴더를 재귀적으로 스캔하여 음악 파일 경로 목록을 반환합니다."""
    music_files = []
    if not os.path.isdir(folder_path):
        return music_files

    for root, dirs, files in os.walk(folder_path):
        # 제외될 파일 목록 읽기 (.musicignore)
        ignored_files = set()
        ignore_path = os.path.join(root, '.musicignore')
        if os.path.exists(ignore_path):
            try:
                with open(ignore_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        name = line.strip()
                        if name:
                            ignored_files.add(name)
            except Exception:
                pass

        for filename in files:
            if filename in ignored_files:
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.join(root, filename)
                music_files.append(full_path)

    return music_files


def _get_first(tag_value, default=''):
    """태그 값에서 첫 번째 요소를 추출합니다."""
    if tag_value is None:
        return default
    if isinstance(tag_value, list):
        return str(tag_value[0]) if tag_value else default
    return str(tag_value) if tag_value else default


def _safe_int(value, default=0):
    """안전하게 정수로 변환합니다."""
    try:
        if isinstance(value, list):
            value = value[0]
        return int(value)
    except (ValueError, TypeError, IndexError):
        return default


def _parse_track(value):
    """트랙 번호를 (번호, 전체) 튜플로 파싱합니다."""
    try:
        if isinstance(value, list):
            value = value[0]
        value = str(value)
        if '/' in value:
            parts = value.split('/')
            return int(parts[0]), int(parts[1])
        return int(value), 0
    except (ValueError, TypeError, IndexError):
        return 0, 0


def extract_metadata(file_path):
    """음악 파일에서 메타데이터를 추출합니다."""
    ext = os.path.splitext(file_path)[1].lower()
    metadata = {
        'file_path': file_path,
        'title': os.path.splitext(os.path.basename(file_path))[0],
        'artist': '',
        'album': '',
        'album_artist': '',
        'composer': '',
        'genre': '',
        'year': 0,
        'track_number': 0,
        'track_total': 0,
        'disc_number': 1,
        'disc_total': 1,
        'duration': 0,
        'bitrate': 0,
        'sample_rate': 0,
        'channels': 0,
        'file_size': os.path.getsize(file_path),
        'file_format': ext.upper().replace('.', ''),
        'bpm': 0,
        'lyrics': '',
        'comment': '',
        'compilation': 0,
        'grouping': '',
    }

    try:
        audio = MutagenFile(file_path)
        if audio is None:
            return metadata

        # 공통: 재생 시간
        if hasattr(audio, 'info') and audio.info:
            metadata['duration'] = getattr(audio.info, 'length', 0) or 0
            metadata['bitrate'] = getattr(audio.info, 'bitrate', 0) or 0
            metadata['sample_rate'] = getattr(audio.info, 'sample_rate', 0) or 0
            metadata['channels'] = getattr(audio.info, 'channels', 0) or 0

        if ext == '.mp3':
            metadata = _parse_mp3(file_path, audio, metadata)
        elif ext == '.flac':
            metadata = _parse_flac(file_path, audio, metadata)
        elif ext in ('.m4a', '.aac'):
            metadata = _parse_m4a(file_path, audio, metadata)
        elif ext == '.ogg':
            metadata = _parse_ogg(file_path, audio, metadata)
        elif ext == '.wav':
            metadata = _parse_wav(file_path, audio, metadata)

    except Exception as e:
        print(f"메타데이터 추출 오류 [{file_path}]: {e}")

    return metadata


def _parse_mp3(file_path, audio, metadata):
    """MP3 파일의 ID3 태그를 파싱합니다."""
    try:
        tags = ID3(file_path)
    except Exception:
        return metadata

    metadata['title'] = _get_first(tags.get('TIT2'), metadata['title'])
    metadata['artist'] = _get_first(tags.get('TPE1'), '')
    metadata['album'] = _get_first(tags.get('TALB'), '')
    metadata['album_artist'] = _get_first(tags.get('TPE2'), '')
    metadata['composer'] = _get_first(tags.get('TCOM'), '')
    metadata['genre'] = _get_first(tags.get('TCON'), '')
    metadata['grouping'] = _get_first(tags.get('TIT1'), '')
    metadata['comment'] = _get_first(tags.get('COMM::eng'), _get_first(tags.get('COMM'), ''))

    # 연도
    year_tag = tags.get('TDRC') or tags.get('TYER')
    if year_tag:
        try:
            metadata['year'] = int(str(year_tag))
        except (ValueError, TypeError):
            pass

    # 트랙 번호
    trck = tags.get('TRCK')
    if trck:
        metadata['track_number'], metadata['track_total'] = _parse_track(trck)

    # 디스크 번호
    tpos = tags.get('TPOS')
    if tpos:
        metadata['disc_number'], metadata['disc_total'] = _parse_track(tpos)

    # BPM
    tbpm = tags.get('TBPM')
    if tbpm:
        metadata['bpm'] = _safe_int(tbpm)

    # 컴필레이션
    tcmp = tags.get('TCMP')
    if tcmp:
        metadata['compilation'] = 1 if str(tcmp) == '1' else 0

    # 가사
    for key in tags.keys():
        if key.startswith('USLT'):
            metadata['lyrics'] = str(tags[key])
            break

    return metadata


def _parse_flac(file_path, audio, metadata):
    """FLAC 파일의 VorbisComment를 파싱합니다."""
    tags = audio.tags
    if not tags:
        return metadata

    metadata['title'] = _get_first(tags.get('title'), metadata['title'])
    metadata['artist'] = _get_first(tags.get('artist'), '')
    metadata['album'] = _get_first(tags.get('album'), '')
    metadata['album_artist'] = _get_first(tags.get('albumartist'), '')
    metadata['composer'] = _get_first(tags.get('composer'), '')
    metadata['genre'] = _get_first(tags.get('genre'), '')
    metadata['year'] = _safe_int(tags.get('date', [0]))
    metadata['comment'] = _get_first(tags.get('comment'), '')
    metadata['grouping'] = _get_first(tags.get('grouping'), '')
    metadata['lyrics'] = _get_first(tags.get('lyrics'), '')
    metadata['bpm'] = _safe_int(tags.get('bpm', [0]))

    tn = tags.get('tracknumber', ['0'])
    tt = tags.get('tracktotal', tags.get('totaltracks', ['0']))
    metadata['track_number'] = _safe_int(tn)
    metadata['track_total'] = _safe_int(tt)

    dn = tags.get('discnumber', ['1'])
    dt = tags.get('disctotal', tags.get('totaldiscs', ['1']))
    metadata['disc_number'] = _safe_int(dn) or 1
    metadata['disc_total'] = _safe_int(dt) or 1

    comp = tags.get('compilation', ['0'])
    metadata['compilation'] = 1 if _get_first(comp) == '1' else 0

    return metadata


def _parse_m4a(file_path, audio, metadata):
    """M4A/AAC 파일의 MP4 태그를 파싱합니다."""
    tags = audio.tags
    if not tags:
        return metadata

    metadata['title'] = _get_first(tags.get('\xa9nam'), metadata['title'])
    metadata['artist'] = _get_first(tags.get('\xa9ART'), '')
    metadata['album'] = _get_first(tags.get('\xa9alb'), '')
    metadata['album_artist'] = _get_first(tags.get('aART'), '')
    metadata['composer'] = _get_first(tags.get('\xa9wrt'), '')
    metadata['genre'] = _get_first(tags.get('\xa9gen'), '')
    metadata['comment'] = _get_first(tags.get('\xa9cmt'), '')
    metadata['grouping'] = _get_first(tags.get('\xa9grp'), '')
    metadata['lyrics'] = _get_first(tags.get('\xa9lyr'), '')

    year = tags.get('\xa9day')
    if year:
        try:
            metadata['year'] = int(str(year[0])[:4])
        except (ValueError, TypeError, IndexError):
            pass

    trkn = tags.get('trkn')
    if trkn and isinstance(trkn[0], tuple):
        metadata['track_number'] = trkn[0][0]
        metadata['track_total'] = trkn[0][1]

    disk = tags.get('disk')
    if disk and isinstance(disk[0], tuple):
        metadata['disc_number'] = disk[0][0] or 1
        metadata['disc_total'] = disk[0][1] or 1

    tmpo = tags.get('tmpo')
    if tmpo:
        metadata['bpm'] = _safe_int(tmpo)

    cpil = tags.get('cpil')
    if cpil:
        metadata['compilation'] = 1 if cpil else 0

    return metadata


def _parse_ogg(file_path, audio, metadata):
    """OGG 파일의 VorbisComment를 파싱합니다 (FLAC과 동일 형식)."""
    return _parse_flac(file_path, audio, metadata)


def _parse_wav(file_path, audio, metadata):
    """WAV 파일의 태그를 파싱합니다."""
    # WAV에는 보통 ID3 태그가 있을 수 있음
    try:
        tags = ID3(file_path)
        metadata['title'] = _get_first(tags.get('TIT2'), metadata['title'])
        metadata['artist'] = _get_first(tags.get('TPE1'), '')
        metadata['album'] = _get_first(tags.get('TALB'), '')
        metadata['album_artist'] = _get_first(tags.get('TPE2'), '')
        metadata['genre'] = _get_first(tags.get('TCON'), '')
    except Exception:
        pass
    return metadata


def extract_cover_art(file_path):
    """음악 파일에서 앨범 커버를 추출합니다. (바이트 데이터 반환)"""
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.mp3':
            tags = ID3(file_path)
            for key in tags.keys():
                if key.startswith('APIC'):
                    return tags[key].data
        elif ext == '.flac':
            audio = FLAC(file_path)
            if audio.pictures:
                return audio.pictures[0].data
        elif ext in ('.m4a', '.aac'):
            audio = MP4(file_path)
            covr = audio.tags.get('covr')
            if covr:
                return bytes(covr[0])
        elif ext == '.ogg':
            audio = OggVorbis(file_path)
            import base64
            pics = audio.get('metadata_block_picture')
            if pics:
                from mutagen.flac import Picture
                pic = Picture(base64.b64decode(pics[0]))
                return pic.data
    except Exception as e:
        print(f"커버 추출 오류 [{file_path}]: {e}")

    return None


def save_cover_art(file_path, cover_data=None):
    """앨범 커버를 파일로 저장합니다. 경로를 반환합니다."""
    ensure_cover_dir()

    if cover_data is None:
        cover_data = extract_cover_art(file_path)

    if cover_data is None:
        return None

    # 파일 경로를 해시하여 고유 파일명 생성
    path_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()[:16]
    cover_path = os.path.join(COVER_DIR, f'{path_hash}.jpg')

    if os.path.exists(cover_path):
        return cover_path

    try:
        img = Image.open(io.BytesIO(cover_data))
        img = img.convert('RGB')
        # 최대 500x500으로 리사이즈
        img.thumbnail((500, 500), Image.Resampling.LANCZOS)
        img.save(cover_path, 'JPEG', quality=90)
        return cover_path
    except Exception as e:
        print(f"커버 저장 오류: {e}")
        # 원본 바이너리를 직접 저장
        try:
            with open(cover_path, 'wb') as f:
                f.write(cover_data)
            return cover_path
        except Exception:
            return None


def get_dominant_color(cover_path):
    """앨범 커버에서 주요 색상을 추출합니다."""
    if not cover_path or not os.path.exists(cover_path):
        return '#fc3c44'

    try:
        from colorthief import ColorThief
        ct = ColorThief(cover_path)
        color = ct.get_color(quality=10)
        return '#{:02x}{:02x}{:02x}'.format(*color)
    except Exception:
        return '#fc3c44'


def scan_and_import(folder_path, progress_callback=None):
    """
    폴더를 스캔하고 모든 음악 파일의 메타데이터를 추출합니다.
    반환: (song_data_list, total_count)
    """
    files = scan_folder(folder_path)
    total = len(files)
    results = []

    for i, file_path in enumerate(files):
        metadata = extract_metadata(file_path)

        # 커버 아트 저장 & 색상 추출
        cover_path = save_cover_art(file_path)
        if cover_path:
            metadata['dominant_color'] = get_dominant_color(cover_path)

        results.append(metadata)

        if progress_callback:
            progress_callback(i + 1, total, metadata.get('title', ''))

    return results, total
