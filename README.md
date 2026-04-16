# 🎵 Music Play (Premium Local Music Player)

> "방치된 로컬 음원 폴더에 Spotify의 영혼을 불어넣다."

기존의 데스크톱 로컬(MP3) 플레이어들은 대부분 디자인이 올드하거나 시대에 뒤떨어진 UI를 가지고 있었습니다. 반면, 아름다운 경험을 제공하는 최신 스트리밍 앱(Spotify, Apple Music)들은 내 하드디스크에 있는 노래를 관리해주지 못합니다. 

이 프로젝트는 **"왜 로컬 음원을 들을 때는 최신 웹의 아름다운 UI와 감성적인 경험(UX)을 포기해야 할까?"** 라는 질문에서 출발했습니다. 

단순히 소리를 재생하는 '음악 재생기'가 아닙니다. Web Audio API, Document PiP API 등 브라우저의 최신 기술을 한계까지 끌어올려, 오프라인 음원 파일에 **상용 앱 수준의 프리미엄 감상 경험**을 구축한 **풀스택 커스텀 뮤직 플레이어**입니다.

---

## 📸 스크린샷 및 데모 (Screenshots)

> 💡 **주요 뷰 미리보기** *(아래에 이미지를 추가하여 갤러리 형태로 구성하세요)*

| 메인 플레이어 (Glassmorphism) | 집중 가사 모드 (LRC Sync) |
| :---: | :---: |
| `![Main UI](images/main-ui.png)` | `![Lyrics](images/lyrics.png)` |
| **미니 플레이어 (PiP API)** | **감상 통계 대시보드 (Stats)** |
| `![PiP](images/pip.png)` | `![Stats](images/stats.png)` |

*(데모 영상 링크 추가 예정)*

---

## ✨ 핵심 기능 및 차별점

| 기능 | 설명 |
|------|------|
| 🎵 **고음질 기반 로컬 스트리밍** | Range 헤더를 통한 부드러운 오디오 스트리밍. MP3, FLAC, M4A, OGG 등 전 포맷 지원 |
| 🎛️ **전문가급 10밴드 이퀄라이저** | Web Audio API 기반 오디오 필터링. 10가지 장르 프리셋 및 실시간 사용자 수동 제어 |
| 🎤 **LRC 알고리즘 및 가사 포커스** | Apple Music 감성의 탄성 있는 스크롤 애니메이션과 블러(Blur) 포커스 가사 싱크 지원 |
| 🎨 **Dynamic Color Extraction** | 재생 중인 앨범 아트의 핵심 색상을 실시간 추출하여 앱 전체 테마에 동적으로 랜더링 |
| 🖼️ **아티스트 브랜딩 시스템** | 단순 텍스트가 아닌 사용자 커스텀 아티스트 이미지 업로드 및 Spotify풍 히어로 배너 적용 |
| 📊 **나만의 청취 통계 대시보드** | 외부 라이브러리 없이 순수 CSS로 구현된 가장 많이 들은 곡, 장르 분석 차트 렌더링 |
| 🎬 **시네마틱 오디오 비주얼라이저**| 풀스크린 전환 시 `<canvas>` 기반 실시간 주파수 분석 오디오 스펙트럼 렌더링 |
| 📺 **OS 종속성 없는 미니 플레이어** | Document PiP 신기술 채택. 모니터 구석에 띄우고 모든 탭에서 독립적으로 제어 가능 |
| 🔍 **비동기 스마트 백그라운드 스캔**| 수천 곡 스캔 시 멈춤(Freezing) 방지를 위한 Threading 및 실시간 폴링 API 구축 |
| ✏️ **실시간 메타데이터(ID3) 편집기**| UI 통일성을 유지한 6탭 편집 다이얼로그. 수정 즉시 디스크 내제 파일 태그 완벽 동기화 |
| 📥 **M3U 플레이리스트 내보내기** | 생성된 플레이리스트를 어디서든 호환되는 M3U 포맷으로 즉시 다운로드 |
| ⌨️ **미디어 세션 및 글로벌 단축키** | `navigator.mediaSession`을 통한 OS 물리 키보드 제어 및 직관적인 단축키 관리(`?`) |
| ↔️ **대기열 선언적 렌더링 동기화** | HTML5 Drag & Drop API 기반 재생 대기열 실시간 순서 조작 시스템 완료 |

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
