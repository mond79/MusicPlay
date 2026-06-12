const CACHE_NAME = 'mondplay-v3';

// 서비스 워커 설치: 오프라인 캐시는 PWA 뱃지 조건 충족을 위해 기본적으로 구현
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/static/css/style.css',
                '/static/css/player.css',
                '/static/css/dialog.css',
                '/static/css/context-menu.css',
                '/static/js/app.js',
                '/static/js/player.js',
                '/static/js/library.js',
                '/static/js/mini-player.js',
                '/static/js/playlist.js',
                '/static/js/song-info.js',
                '/static/js/stats.js',
                '/static/js/visualizer.js',
                '/static/js/color-theme.js',
                '/static/js/context-menu.js',
                '/static/js/equalizer.js',
                '/static/js/wrapped.js',
                '/static/img/icon-192.png',
                '/static/img/icon-512.png'
            ]).catch(err => {
                // 오프라인 캐시 실패해도 진행
                console.warn("일부 파일이 캐시되지 않았습니다.", err);
            });
        })
    );
    self.skipWaiting();
});

// 서비스 워커 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 패치: Network First 전략 (최신 파일 우선, 실패 시 오프라인 캐시 제공)
self.addEventListener('fetch', (event) => {
    // API 호출이나 미디어 파일은 캐시하지 않음
    if (event.request.url.includes('/api/') || event.request.url.match(/\.(mp3|flac|wav)$/)) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            // 네트워크 요청 성공 시 캐시에 최신 파일 덮어쓰기
            return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            // 네트워크 실패(서버 꺼짐 등 오프라인 상태) 시 기존 캐시 반환
            return caches.match(event.request, { ignoreSearch: true });
        })
    );
});
