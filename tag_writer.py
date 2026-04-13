"""
Music Play — 파일 태그 쓰기 모듈
mutagen을 사용하여 음악 파일의 메타데이터를 직접 수정합니다.
"""

import os
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.flac import FLAC, Picture as FLACPicture
from mutagen.mp4 import MP4, MP4Cover
from mutagen.oggvorbis import OggVorbis
from mutagen.id3 import (
    ID3, TIT2, TPE1, TALB, TPE2, TCOM, TCON, TDRC, TRCK, TPOS,
    TBPM, TCMP, TIT1, USLT, COMM, APIC, ID3NoHeaderError
)


def write_metadata(file_path, data):
    """
    파일 태그에 메타데이터를 씁니다.
    data: dict — 쓸 필드들 (title, artist, album 등)
    """
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.mp3':
            _write_mp3(file_path, data)
        elif ext == '.flac':
            _write_flac(file_path, data)
        elif ext in ('.m4a', '.aac'):
            _write_m4a(file_path, data)
        elif ext == '.ogg':
            _write_ogg(file_path, data)
        elif ext == '.wav':
            _write_wav(file_path, data)
        return True
    except Exception as e:
        print(f"태그 쓰기 오류 [{file_path}]: {e}")
        return False


def _write_mp3(file_path, data):
    """MP3 파일에 ID3 태그를 씁니다."""
    try:
        tags = ID3(file_path)
    except ID3NoHeaderError:
        tags = ID3()

    field_map = {
        'title': lambda v: TIT2(encoding=3, text=[v]),
        'artist': lambda v: TPE1(encoding=3, text=[v]),
        'album': lambda v: TALB(encoding=3, text=[v]),
        'album_artist': lambda v: TPE2(encoding=3, text=[v]),
        'composer': lambda v: TCOM(encoding=3, text=[v]),
        'genre': lambda v: TCON(encoding=3, text=[v]),
        'grouping': lambda v: TIT1(encoding=3, text=[v]),
        'year': lambda v: TDRC(encoding=3, text=[str(v)]),
        'bpm': lambda v: TBPM(encoding=3, text=[str(v)]),
    }

    for field, factory in field_map.items():
        if field in data:
            tag_key = {
                'title': 'TIT2', 'artist': 'TPE1', 'album': 'TALB',
                'album_artist': 'TPE2', 'composer': 'TCOM', 'genre': 'TCON',
                'grouping': 'TIT1', 'year': 'TDRC', 'bpm': 'TBPM',
            }[field]
            tags.delall(tag_key)
            if data[field]:
                tags.add(factory(data[field]))

    # 트랙 번호
    if 'track_number' in data:
        tags.delall('TRCK')
        tn = data.get('track_number', 0)
        tt = data.get('track_total', 0)
        if tt:
            tags.add(TRCK(encoding=3, text=[f'{tn}/{tt}']))
        else:
            tags.add(TRCK(encoding=3, text=[str(tn)]))

    # 디스크 번호
    if 'disc_number' in data:
        tags.delall('TPOS')
        dn = data.get('disc_number', 1)
        dt = data.get('disc_total', 1)
        if dt:
            tags.add(TPOS(encoding=3, text=[f'{dn}/{dt}']))
        else:
            tags.add(TPOS(encoding=3, text=[str(dn)]))

    # 컴필레이션
    if 'compilation' in data:
        tags.delall('TCMP')
        tags.add(TCMP(encoding=3, text=['1' if data['compilation'] else '0']))

    # 가사
    if 'lyrics' in data:
        # 기존 가사 삭제
        for key in list(tags.keys()):
            if key.startswith('USLT'):
                del tags[key]
        if data['lyrics']:
            tags.add(USLT(encoding=3, lang='kor', desc='', text=data['lyrics']))

    # 코멘트
    if 'comment' in data:
        for key in list(tags.keys()):
            if key.startswith('COMM'):
                del tags[key]
        if data['comment']:
            tags.add(COMM(encoding=3, lang='eng', desc='', text=[data['comment']]))

    tags.save(file_path)


def _write_flac(file_path, data):
    """FLAC 파일에 VorbisComment를 씁니다."""
    audio = FLAC(file_path)
    if audio.tags is None:
        audio.add_tags()

    vorbis_map = {
        'title': 'title', 'artist': 'artist', 'album': 'album',
        'album_artist': 'albumartist', 'composer': 'composer',
        'genre': 'genre', 'comment': 'comment', 'grouping': 'grouping',
        'lyrics': 'lyrics',
    }

    for field, tag_name in vorbis_map.items():
        if field in data:
            audio.tags[tag_name] = [str(data[field])]

    if 'year' in data:
        audio.tags['date'] = [str(data['year'])]
    if 'track_number' in data:
        audio.tags['tracknumber'] = [str(data['track_number'])]
    if 'track_total' in data:
        audio.tags['tracktotal'] = [str(data['track_total'])]
    if 'disc_number' in data:
        audio.tags['discnumber'] = [str(data['disc_number'])]
    if 'disc_total' in data:
        audio.tags['disctotal'] = [str(data['disc_total'])]
    if 'bpm' in data:
        audio.tags['bpm'] = [str(data['bpm'])]
    if 'compilation' in data:
        audio.tags['compilation'] = ['1' if data['compilation'] else '0']

    audio.save()


def _write_m4a(file_path, data):
    """M4A/AAC 파일에 MP4 태그를 씁니다."""
    audio = MP4(file_path)
    if audio.tags is None:
        audio.add_tags()

    mp4_map = {
        'title': '\xa9nam', 'artist': '\xa9ART', 'album': '\xa9alb',
        'album_artist': 'aART', 'composer': '\xa9wrt', 'genre': '\xa9gen',
        'comment': '\xa9cmt', 'grouping': '\xa9grp', 'lyrics': '\xa9lyr',
    }

    for field, tag_name in mp4_map.items():
        if field in data:
            audio.tags[tag_name] = [str(data[field])]

    if 'year' in data:
        audio.tags['\xa9day'] = [str(data['year'])]
    if 'track_number' in data:
        tn = data.get('track_number', 0)
        tt = data.get('track_total', 0)
        audio.tags['trkn'] = [(tn, tt)]
    if 'disc_number' in data:
        dn = data.get('disc_number', 1)
        dt = data.get('disc_total', 1)
        audio.tags['disk'] = [(dn, dt)]
    if 'bpm' in data:
        audio.tags['tmpo'] = [int(data['bpm'])]
    if 'compilation' in data:
        audio.tags['cpil'] = bool(data['compilation'])

    audio.save()


def _write_ogg(file_path, data):
    """OGG 파일에 VorbisComment를 씁니다. (FLAC과 유사)"""
    audio = OggVorbis(file_path)
    if audio.tags is None:
        audio.add_tags()

    vorbis_map = {
        'title': 'title', 'artist': 'artist', 'album': 'album',
        'album_artist': 'albumartist', 'composer': 'composer',
        'genre': 'genre', 'comment': 'comment', 'grouping': 'grouping',
        'lyrics': 'lyrics',
    }

    for field, tag_name in vorbis_map.items():
        if field in data:
            audio.tags[tag_name] = [str(data[field])]

    if 'year' in data:
        audio.tags['date'] = [str(data['year'])]
    if 'track_number' in data:
        audio.tags['tracknumber'] = [str(data['track_number'])]
    if 'track_total' in data:
        audio.tags['tracktotal'] = [str(data['track_total'])]
    if 'disc_number' in data:
        audio.tags['discnumber'] = [str(data['disc_number'])]
    if 'disc_total' in data:
        audio.tags['disctotal'] = [str(data['disc_total'])]
    if 'bpm' in data:
        audio.tags['bpm'] = [str(data['bpm'])]
    if 'compilation' in data:
        audio.tags['compilation'] = ['1' if data['compilation'] else '0']

    audio.save()


def _write_wav(file_path, data):
    """WAV 파일에 ID3 태그를 씁니다."""
    # WAV에 ID3 태그 쓰기 (지원 범위 제한)
    try:
        _write_mp3(file_path, data)
    except Exception:
        print(f"WAV 태그 쓰기 미지원: {file_path}")


def write_cover_art(file_path, image_data, mime_type='image/jpeg'):
    """음악 파일에 앨범 커버를 내장합니다."""
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.mp3':
            try:
                tags = ID3(file_path)
            except ID3NoHeaderError:
                tags = ID3()
            # 기존 커버 삭제
            for key in list(tags.keys()):
                if key.startswith('APIC'):
                    del tags[key]
            tags.add(APIC(
                encoding=3, mime=mime_type, type=3,
                desc='Cover', data=image_data
            ))
            tags.save(file_path)

        elif ext == '.flac':
            audio = FLAC(file_path)
            audio.clear_pictures()
            pic = FLACPicture()
            pic.type = 3
            pic.mime = mime_type
            pic.desc = 'Cover'
            pic.data = image_data
            audio.add_picture(pic)
            audio.save()

        elif ext in ('.m4a', '.aac'):
            audio = MP4(file_path)
            if audio.tags is None:
                audio.add_tags()
            fmt = MP4Cover.FORMAT_JPEG if 'jpeg' in mime_type else MP4Cover.FORMAT_PNG
            audio.tags['covr'] = [MP4Cover(image_data, imageformat=fmt)]
            audio.save()

        return True
    except Exception as e:
        print(f"커버 쓰기 오류 [{file_path}]: {e}")
        return False
