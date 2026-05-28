import type { ViewEvent, SurveyData, ProSignupData } from '@/types';

export async function logEvent(event: ViewEvent): Promise<void> {
  await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

export async function submitSurvey(survey: SurveyData): Promise<void> {
  await fetch('/api/survey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(survey),
  });
}

export async function signupForPro(data: ProSignupData): Promise<void> {
  const res = await fetch('/api/pro-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Pro signup failed');
  }
}
