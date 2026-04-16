# 🎵 Music Play

> **로컬 음원 파일을 위한 프리미엄 뮤직 플레이어**  
> Spotify · Apple Music 감성의 웹 기반 음악 플레이어를 직접 설계하고 구축한 프로젝트입니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|------|------|
| 🎵 **고음질 스트리밍** | Range 헤더 지원으로 탐색 가능한 오디오 스트리밍. MP3 / FLAC / M4A / AAC / WAV / OGG 전 포맷 지원 |
| 🎛️ **10밴드 이퀄라이저** | Web Audio API 기반. 팝·록·힙합 등 10가지 프리셋 + 수동 조절 |
| 🎤 **LRC 실시간 가사 싱크** | Apple Music 스타일의 노래방 가사. 타임코드 없으면 일반 텍스트로 자동 전환 |
| 🎨 **Dynamic Color Theme** | 앨범 아트의 주요 색상을 자동 추출하여 앱 전체의 분위기를 실시간으로 변경 |
| 🖼️ **아티스트 히어로 배너** | 사용자가 직접 아티스트 이미지를 업로드. Spotify 스타일의 대형 배너로 표시 |
| 📊 **감상 통계 대시보드** | 재생 횟수·최애 아티스트·자주 들은 곡을 순수 CSS 차트로 시각화 |
| 🎬 **시네마틱 비주얼라이저** | 풀스크린 전환 시 앨범 아트 블러 배경 + 실시간 오디오 스펙트럼 애니메이션 |
| 📺 **PiP 미니 플레이어** | Document PiP API를 활용, 모니터 구석에 띄워두는 독립형 미니 플레이어 |
| 🔍 **스마트 라이브러리** | 노래·앨범·아티스트·플레이리스트 뷰 + 실시간 검색 |
| ✏️ **메타데이터 직접 편집** | iTunes 스타일 6탭 편집 다이얼로그. 수정 즉시 실제 파일 태그에 영구 저장 |
| 🔗 **하이퍼링크 내비게이션** | 노래 목록에서 아티스트·앨범 이름 클릭 → 해당 상세 페이지로 즉시 이동 |
| 📥 **M3U 플레이리스트 내보내기** | 생성된 플레이리스트를 어디서든 호환되는 M3U 포맷으로 즉시 다운로드 |
| ⌨️ **글로벌 시스템 단축키** | Space(재생), 방향키(볼륨/탐색) 및 `?` 키를 통한 직관적인 단축키 도움말 팝업 제공 |

---

## 🖥️ 스크린샷

> *(스크린샷은 추후 추가 예정)*

---

## 🛠️ 기술 스택

**Backend**
- `Python 3.11+` + `Flask 3.0`
- `SQLite3` — 라이브러리·플레이리스트·통계 관리
- `Mutagen` — 음악 파일 메타데이터 읽기/쓰기
- `Pillow` — 앨범 아트 추출 및 리사이징

**Frontend**
- Vanilla `JavaScript` (ES6+) — 11개 모듈로 역할 분리
- `Web Audio API` — 이퀄라이저 + 오디오 비주얼라이저
- `Document Picture-in-Picture API` — 미니 플레이어
- Vanilla `CSS` — Glassmorphism + Dynamic Color System

---

## 🚀 설치 및 실행

### 요구사항
- Python 3.11 이상
- pip

### 1. 저장소 클론

```bash
git clone https://github.com/mond79/MusicPlay.git
cd MusicPlay
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 실행

**Windows (간편 실행)**
```
run.bat 파일을 더블클릭
```

**또는 터미널에서 직접 실행**
```bash
python app.py
```

### 4. 브라우저에서 열기

```
http://localhost:5000
```

> 💡 같은 Wi-Fi 네트워크의 스마트폰이나 태블릿에서도 접속 가능합니다.

---

## 📁 프로젝트 구조

```
MusicPlay/
├── app.py              # Flask 서버 & REST API 라우트
├── database.py         # SQLite3 데이터베이스 관리
├── music_scanner.py    # 음악 파일 스캐너 & 메타데이터 파서
├── tag_writer.py       # 음악 파일 태그 직접 쓰기 엔진
├── requirements.txt
├── run.bat             # Windows 원클릭 실행 스크립트
├── static/
│   ├── css/
│   │   ├── style.css           # 메인 디자인 시스템
│   │   ├── player.css          # 플레이어 바 스타일
│   │   ├── dialog.css          # 모달 다이얼로그 스타일
│   │   └── context-menu.css    # 우클릭 메뉴 스타일
│   └── js/
│       ├── app.js          # 앱 초기화 & 라우팅
│       ├── player.js       # 재생 엔진 (LRC 싱크 포함)
│       ├── library.js      # 라이브러리 뷰 & 아티스트 프로필
│       ├── equalizer.js    # Web Audio API 이퀄라이저
│       ├── visualizer.js   # 시네마틱 오디오 비주얼라이저
│       ├── mini-player.js  # PiP 미니 플레이어
│       ├── color-theme.js  # 동적 컬러 테마 엔진
│       ├── playlist.js     # 플레이리스트 관리
│       ├── song-info.js    # 노래 정보 편집 다이얼로그
│       ├── stats.js        # 감상 통계 대시보드
│       └── context-menu.js # 우클릭 컨텍스트 메뉴
├── templates/
│   └── index.html      # 단일 페이지 앱 (SPA)
├── data/               # 앨범 아트 캐시 & 아티스트 이미지 (자동 생성)
└── WHITEPAPER.md       # 프로젝트 개발 백서
```

---

## 🎵 지원 포맷

| 포맷 | 재생 | 태그 편집 | 앨범 아트 내장 |
|------|:----:|:---------:|:--------------:|
| MP3  | ✅   | ✅         | ✅              |
| FLAC | ✅   | ✅         | ✅              |
| M4A / AAC | ✅ | ✅      | ✅              |
| WAV  | ✅   | ✅         | ➖              |
| OGG  | ✅   | ✅         | ➖              |

---

## 📜 개발 백서

이 프로젝트의 기획 배경, 5단계 진화 과정, 그리고 AudioContext 보안 샌드박스 우회부터 PiP 동기화까지 실제로 부딪힌 기술적 도전과 해결 과정을 상세히 기록한 문서입니다.

👉 [WHITEPAPER.md](./WHITEPAPER.md) 에서 확인하세요.

---

## 📄 라이선스

This project is for personal and educational use.

---

<div align="center">
  <sub>Built with ❤️ — Flask · SQLite · Web Audio API · Vanilla JS</sub>
</div>
