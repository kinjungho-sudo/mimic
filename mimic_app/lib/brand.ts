export const BRAND_NAME = 'Parro';
export const BRAND_NAME_KO = '\uD328\uB85C';
export const BRAND_FULL_NAME = 'Parro AI Live Guide';
export const BRAND_PRODUCT_CATEGORY = 'B2B AI Live Guide for hands-on training';
export const BRAND_TAGLINE = 'AI Live Guide for hands-on training';
export const BRAND_DESCRIPTION =
  'Parro helps instructors and teams turn hands-on software workflows into step-by-step live guidance.';

// Interim public contact until a verified Parro mailbox is provisioned.
export const BRAND_SUPPORT_EMAIL = 'kinjungho@gmail.com';
export const BRAND_APP_URL_FALLBACK = 'https://mimic-nine-ashen.vercel.app';
export const BRAND_LOGO_IMAGE_PATH = '/brand/parro-mark.png';
// The Parro listing is the approved public Recorder. Keep the legacy MIMIC ID
// in the compatibility set while existing installations complete the cutover.
export const BRAND_EXTENSION_ID = 'lefkpmfgdbhckcemfghpegleknaepekm';
export const BRAND_LEGACY_EXTENSION_ID = 'ehbhcdkapcbfehinjapabgoegcjmmbgd';
export const BRAND_EXTENSION_IDS = [BRAND_EXTENSION_ID, BRAND_LEGACY_EXTENSION_ID] as const;
export const BRAND_EXTENSION_STORE_URL =
  `https://chromewebstore.google.com/detail/parro-recorder/${BRAND_EXTENSION_ID}`;
export const BRAND_BOT_USER_AGENT = 'ParroBot/1.0';

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
  packageName: 'mimic-app',
  sdkGlobal: 'MimicSDK',
  sdkAutoRunGlobal: 'MimicAutoRun',
  sdkGuideQueryParam: 'mimic_guide',
  sdkFloatAttribute: 'data-mimic-float',
  shareEmailSecretHeader: 'x-mimic-secret',
  annotationDefaultsKey: 'mimic_annot_defaults_v1',
  surveyManualCreatedPrefix: 'mimic:survey:manual_created',
  surveyManualViewerPrefix: 'mimic:survey:manual_viewer',
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

export function getBrandAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? BRAND_APP_URL_FALLBACK).replace(/^\uFEFF/, '').trim();
}
