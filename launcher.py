"""
Mond Play — Windows 실행 런처
exe로 패키징될 때 경로 문제를 처리하고, 브라우저를 자동으로 열어줍니다.
"""

import sys
import os
import threading
import webbrowser
import time
import socket


def get_base_dir():
    """
    PyInstaller로 패키징된 경우: sys._MEIPASS (임시 압축 해제 폴더)
    일반 실행의 경우: 현재 파일 위치
    """
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def find_free_port(start=5000):
    """사용 가능한 포트 찾기 (5000번이 사용 중이면 다음 번호로)"""
    for port in range(start, start + 100):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    return start


def open_browser(port, delay=1.5):
    """서버가 준비된 후 브라우저 자동 오픈"""
    time.sleep(delay)
    webbrowser.open(f'http://localhost:{port}')


def main():
    # 베이스 디렉토리를 Flask가 찾을 수 있도록 환경변수에 설정
    base_dir = get_base_dir()
    os.environ['MONDPLAY_BASE_DIR'] = base_dir

    # 데이터 디렉토리:
    #   - exe 설치 버전: %APPDATA%\MondPlay  (C:\Users\사용자\AppData\Roaming\MondPlay)
    #   - 개발 모드:      프로젝트 루트의 data/ 폴더
    if getattr(sys, 'frozen', False):
        appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
        data_dir = os.path.join(appdata, 'MondPlay')
    else:
        data_dir = os.path.join(base_dir, 'data')
    os.environ['MONDPLAY_DATA_DIR'] = data_dir
    os.makedirs(data_dir, exist_ok=True)

    port = find_free_port(5000)

    # 브라우저 오픈을 별도 스레드에서 (서버 시작 후 1.5초 뒤)
    browser_thread = threading.Thread(target=open_browser, args=(port,), daemon=True)
    browser_thread.start()

    # Flask 앱 임포트 및 실행
    # 경로 설정 후에 임포트해야 함
    sys.path.insert(0, base_dir)

    try:
        import app as flask_app
        print(f"[Mond Play] 서버 시작 — http://localhost:{port}")
        flask_app.app.run(host='127.0.0.1', port=port, debug=False, use_reloader=False)
    except Exception as e:
        print(f"[Mond Play] 오류 발생: {e}")
        input("엔터를 누르면 종료합니다...")


if __name__ == '__main__':
    main()
