const CACHE_NAME = 'mondplay-v1';

// 서비스 워커 설치: 오프라인 캐시는 PWA 뱃지 조건 충족을 위해 기본적으로 구현
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/static/css/style.css',
                '/static/js/app.js',
                '/static/js/player.js',
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

// 패치: 로컬 호스트 테스트 시 통과 (Pass-through)
self.addEventListener('fetch', (event) => {
    // API 호출이나 미디어 파일은 캐시하지 않고 무조건 네트워크 사용
    if (event.request.url.includes('/api/') || event.request.url.match(/\.(mp3|flac|wav)$/)) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
