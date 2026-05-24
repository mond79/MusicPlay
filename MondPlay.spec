# -*- mode: python ; coding: utf-8 -*-
# Mond Play — PyInstaller 빌드 스펙 파일

import os

block_cipher = None

# 프로젝트 루트 경로
PROJECT_ROOT = os.path.abspath(os.path.dirname(SPEC))

a = Analysis(
    ['launcher.py'],
    pathex=[PROJECT_ROOT],
    binaries=[],
    datas=[
        # (원본 경로, exe 내 배치 경로)
        (os.path.join(PROJECT_ROOT, 'templates'), 'templates'),
        (os.path.join(PROJECT_ROOT, 'static'),    'static'),
        (os.path.join(PROJECT_ROOT, 'app.py'),       '.'),
        (os.path.join(PROJECT_ROOT, 'database.py'),  '.'),
        (os.path.join(PROJECT_ROOT, 'music_scanner.py'), '.'),
        (os.path.join(PROJECT_ROOT, 'tag_writer.py'),    '.'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'mutagen',
        'mutagen.mp3',
        'mutagen.flac',
        'mutagen.mp4',
        'mutagen.id3',
        'colorthief',
        'PIL',
        'PIL.Image',
        'jinja2',
        'jinja2.ext',
        'werkzeug',
        'werkzeug.serving',
        'werkzeug.debug',
        'pkg_resources.py2_warn',
        'engineio.async_drivers.threading',
        'sqlite3',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='MondPlay',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,           # 콘솔 창 숨김 (백그라운드 서버)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='static/img/icon-512.png',  # 아이콘 파일 (ico 변환 후 활성화)
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='MondPlay',
)
