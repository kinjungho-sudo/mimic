import type { Marker } from '@/types';

// 마커 번호와 음성 오프셋(ms)을 매핑
export function buildMarkerTimeline(
  markers: Marker[],
  markerPositions: number[]
): Marker[] {
  return markers.map((marker, i) => ({
    ...marker,
    script_offset_ms: markerPositions[i] ?? 0,
  }));
}

// position_x, position_y (0~1) → 픽셀 좌표 변환
export function normalizedToPixel(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): { px: number; py: number } {
  return {
    px: Math.round(x * containerWidth),
    py: Math.round(y * containerHeight),
  };
}
