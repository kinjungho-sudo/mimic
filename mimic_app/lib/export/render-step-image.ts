import { Resvg } from '@resvg/resvg-js';
import { annotationsBox, fitFramingToBox } from '@/lib/framing';
import { buildAnnotatedSvg } from './annotate-svg';
import { getImageDims, type ExportAnnotation } from './annotations-shared';

export interface StepImageFrame {
  image_zoom?: number | null;
  image_offset_x?: number | null;
  image_offset_y?: number | null;
}

interface RenderOptions {
  imageBytes: Buffer;
  contentType: string;
  annotations?: ExportAnnotation[] | null;
  frame?: StepImageFrame | null;
  fontFiles?: string[] | null;
}

export interface RenderedStepImage {
  data: Buffer;
  type: 'png' | 'jpg';
  width: number;
  height: number;
}

export function renderStepImage({
  imageBytes,
  contentType,
  annotations,
  frame,
  fontFiles,
}: RenderOptions): RenderedStepImage {
  const dim = getImageDims(imageBytes);
  const isPng = contentType.includes('png');
  const fallback: RenderedStepImage = {
    data: imageBytes,
    type: isPng ? 'png' : 'jpg',
    width: dim?.w ?? 1600,
    height: dim?.h ?? 900,
  };

  if (!dim || dim.w <= 0 || dim.h <= 0) return fallback;

  const anns = annotations ?? [];
  const fitted = fitFramingToBox(
    {
      zoom: frame?.image_zoom ?? 1,
      offsetX: frame?.image_offset_x ?? 0,
      offsetY: frame?.image_offset_y ?? 0,
    },
    annotationsBox(anns),
  );
  const needsRender = anns.length > 0 || fitted.zoom > 1.001;
  if (!needsRender || !fontFiles?.length) return fallback;

  const dataUri = `data:image/${isPng ? 'png' : 'jpeg'};base64,${imageBytes.toString('base64')}`;
  const svg = buildAnnotatedSvg(dataUri, dim.w, dim.h, anns, {
    zoom: fitted.zoom,
    offsetX: fitted.offsetX,
    offsetY: fitted.offsetY,
  });
  const png = new Resvg(svg, {
    font: { fontFiles, defaultFontFamily: 'Noto Sans KR', loadSystemFonts: false },
  }).render().asPng();

  return { data: Buffer.from(png), type: 'png', width: dim.w, height: dim.h };
}
