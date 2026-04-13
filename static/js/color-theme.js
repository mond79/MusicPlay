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

        document.documentElement.style.setProperty('--dynamic-color', hexColor);
        document.documentElement.style.setProperty(
            '--dynamic-color-dim',
            this._hexToRgba(hexColor, 0.15)
        );

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
    }
};
