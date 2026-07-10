export const BRAND_NAME = 'Parro';
export const BRAND_NAME_KO = '\uD328\uB85C';
export const BRAND_FULL_NAME = 'Parro AI Live Guide';
export const BRAND_PRODUCT_CATEGORY = 'B2B AI Live Guide for hands-on training';
export const BRAND_TAGLINE = 'AI Live Guide for hands-on training';
export const BRAND_DESCRIPTION =
  'Parro helps instructors and teams turn hands-on software workflows into step-by-step live guidance.';

// Phase 2 operational value: update only after the Parro support domain is ready.
export const BRAND_SUPPORT_EMAIL = 'support@mimic.so';

export const BRAND_VISUAL_DIRECTION = 'Wing Pointer';

export const BRAND_COPY = {
  liveGuide: 'AI Live Guide',
  handsOnTraining: 'hands-on training',
  madeWith: `Made with ${BRAND_NAME}`,
  manualTitle: `${BRAND_NAME} manual`,
  extensionDisplayName: `${BRAND_NAME} Recorder`,
} as const;

// Phase 1 public rebrand keeps these compatibility identifiers unchanged.
export const LEGACY_INTERNAL_IDENTIFIERS = {
  productName: 'MIMIC',
  extensionName: 'MIMIC Recorder',
  packageName: 'mimic-app',
  sdkGlobal: 'MimicSDK',
  sdkAutoRunGlobal: 'MimicAutoRun',
  sdkGuideQueryParam: 'mimic_guide',
  sdkFloatAttribute: 'data-mimic-float',
  shareEmailSecretHeader: 'x-mimic-secret',
  annotationDefaultsKey: 'mimic_annot_defaults_v1',
  dragDataType: 'text/mimic-tutorial',
  botUserAgent: 'MIMICBot/1.0',
} as const;

export const BRAND_COLORS = {
  primary: '#009B8E',
  primaryForeground: '#FFFFFF',
  accent: '#8DD63F',
  accentForeground: '#102033',
  highlight: '#FF7A3D',
  guide: '#12B886',
  guideSoft: '#E8FFF7',
  pointer: '#102033',
  surface: '#FFFFFF',
  border: '#DDE7E4',
  focus: '#17C9B6',
} as const;
