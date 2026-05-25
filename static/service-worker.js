const CACHE_NAME = 'mondplay-v2';

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

// 패치: 무조건 네트워크에서 최신 파일 가져오기 (개발 및 캐시 무력화용)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
