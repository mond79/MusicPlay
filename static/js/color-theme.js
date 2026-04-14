/**
 * Music Play — 동적 색상 테마 모듈
 * 앨범 커버에서 추출된 색상으로 배경 그라데이션을 동적으로 변경합니다.
 */

const ColorTheme = {
    currentColor: '#fc3c44',

    /**
     * 동적 배경 색상을 업데이트합니다.
     * @param {string} hexColor - 16진수 색상 코드
     */
    setColor(hexColor) {
        if (!hexColor || hexColor === this.currentColor) return;
        this.currentColor = hexColor;

        // 배경 그라데이션용 변수
        document.documentElement.style.setProperty('--dynamic-color', hexColor);
        document.documentElement.style.setProperty(
            '--dynamic-color-dim',
            this._hexToRgba(hexColor, 0.15)
        );

        // UI 버튼/텍스트 강조색 변수 (--accent)도 함께 변경하여 앱 전체의 분위기를 일치시킴
        document.documentElement.style.setProperty('--accent', hexColor);
        document.documentElement.style.setProperty('--accent-hover', this.adjustBrightness(hexColor, 1.1));
        document.documentElement.style.setProperty('--accent-glow', this._hexToRgba(hexColor, 0.3));
        document.documentElement.style.setProperty('--accent-subtle', this._hexToRgba(hexColor, 0.15));

        const bg = document.getElementById('dynamic-bg');
        if (bg) {
            bg.style.background = `radial-gradient(ellipse at 30% 0%, ${hexColor} 0%, transparent 70%)`;
        }
    },

    /**
     * 색상을 기본값으로 초기화합니다.
     */
    reset() {
        this.setColor('#fc3c44');
    },

    /**
     * HEX 색상을 RGBA 문자열로 변환합니다.
     */
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * 색상의 밝기를 조정합니다.
     */
    adjustBrightness(hex, factor) {
        const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) * factor));
        const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) * factor));
        const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) * factor));
        return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    },

    /**
     * 이미지 객체에서 화면에 잘 띄는 컬러(채도가 높은 색 위주)를 추출합니다.
     */
    extractFromImage(imgEl) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            // 해상도를 64x64로 대폭 낮추어 성능 향상
            canvas.width = 64; 
            canvas.height = 64;

            ctx.drawImage(imgEl, 0, 0, 64, 64);
            const data = ctx.getImageData(0, 0, 64, 64).data;

            let r = 0, g = 0, b = 0, count = 0;
            let fallbackR = 0, fallbackG = 0, fallbackB = 0, fallbackCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const pr = data[i], pg = data[i+1], pb = data[i+2];
                // 투명 픽셀 무시
                if (data[i+3] < 128) continue;
                
                fallbackR += pr; fallbackG += pg; fallbackB += pb; fallbackCount++;

                // 무채색(회색/흑/백 등) 필터링
                const max = Math.max(pr, pg, pb);
                const min = Math.min(pr, pg, pb);
                // 명암 치우침 제한
                if (max > 240 || min < 15) continue; 
                // 채도가 너무 낮으면 건너뜀
                if (max - min < 30) continue; 

                r += pr;
                g += pg;
                b += pb;
                count++;
            }

            // 만약 컬러풀한 픽셀이 하나도 없었다면 일반 평균색 사용
            if (count === 0 && fallbackCount > 0) {
                r = fallbackR; g = fallbackG; b = fallbackB; count = fallbackCount;
            }

            if (count > 0) {
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);
                return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            console.warn('[Theme] 색상 추출 실패:', e);
        }
        return null;
    }
};
