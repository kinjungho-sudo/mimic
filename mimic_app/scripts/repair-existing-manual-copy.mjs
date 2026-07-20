import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

import {
  buildCaptureFallbackDraft,
  buildCaptureFallbackTutorialTitle,
  isLowQualityCaptureScript,
  isLowQualityCaptureTitle,
  isLowQualityCaptureTutorialTitle,
} from '../lib/ai/capture-fallback.ts';
import { validateRegeneratedStepSet } from '../lib/ai/regeneration-quality.ts';
import { assessManualQuality, maskManualCopy } from '../lib/manual-quality.ts';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
nextEnv.loadEnvConfig(appRoot);

const apply = process.argv.includes('--apply');
const copyIssueCodes = new Set(['tutorial_title', 'step_title', 'step_script', 'duplicate_title']);
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ownerEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

assert.ok(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');
assert.ok(ownerEmail, 'ADMIN_EMAIL is required');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: owner, error: ownerError } = await supabase
  .from('mm_users')
  .select('id')
  .eq('email', ownerEmail)
  .single();
if (ownerError || !owner?.id) throw new Error(ownerError?.message || 'owner_not_found');

const { data: tutorials, error: tutorialsError } = await supabase
  .from('mm_tutorials')
  .select('id, title')
  .eq('user_id', owner.id)
  .is('deleted_at', null)
  .order('updated_at', { ascending: false });
if (tutorialsError) throw new Error(tutorialsError.message);

const tutorialIds = (tutorials || []).map(tutorial => tutorial.id);
const { data: rawSteps, error: stepsError } = tutorialIds.length
  ? await supabase
      .from('mm_steps')
      .select('*')
      .in('tutorial_id', tutorialIds)
      .order('order_index')
      .order('step_number')
  : { data: [], error: null };
if (stepsError) throw new Error(stepsError.message);

const stepsByTutorial = new Map();
for (const step of rawSteps || []) {
  const steps = stepsByTutorial.get(step.tutorial_id) || [];
  steps.push(step);
  stepsByTutorial.set(step.tutorial_id, steps);
}

const results = [];
for (const tutorial of tutorials || []) {
  const steps = stepsByTutorial.get(tutorial.id) || [];
  if (!steps.length) continue;
  const beforeIssues = assessManualQuality(tutorial.title, steps);
  const copyIssues = beforeIssues.filter(issue => copyIssueCodes.has(issue.code));
  if (!copyIssues.length) continue;

  const duplicateTitles = new Set();
  const titleCounts = new Map();
  for (const step of steps) {
    const title = maskManualCopy(step.user_title || step.ai_title).toLowerCase();
    if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  }
  for (const [title, count] of titleCounts) if (count > 1) duplicateTitles.add(title);

  const drafts = steps.map(step => {
    const actionInfo = step.action_info && typeof step.action_info === 'object' ? step.action_info : null;
    const fallback = buildCaptureFallbackDraft({
      id: step.id,
      ai_title: maskManualCopy(step.ai_title),
      ai_description: maskManualCopy(step.ai_description),
      page_url: step.page_url,
      step_number: step.step_number,
      domain_name: step.domain_name,
      type_text: step.type_text,
    }, {
      actionInfo,
      elementText: maskManualCopy(step.element_text || actionInfo?.targetContext?.accessibleName),
      noAction: step.step_type === 'manual_capture_step' || step.follow_config?.kind === 'none',
    });
    const currentTitle = maskManualCopy(step.user_title || step.ai_title);
    const currentScript = maskManualCopy(step.user_script || step.ai_description);
    const replaceTitle = isLowQualityCaptureTitle(currentTitle) || duplicateTitles.has(currentTitle.toLowerCase());
    const replaceScript = isLowQualityCaptureScript(currentScript);
    return {
      id: step.id,
      user_title: replaceTitle ? fallback.user_title : currentTitle || fallback.user_title,
      user_script: replaceScript ? fallback.user_script : currentScript || fallback.user_script,
    };
  });

  const setQuality = validateRegeneratedStepSet(steps.map(step => step.id), drafts);
  if (!setQuality.ok) {
    results.push({ tutorialId: tutorial.id, status: 'skipped', reason: setQuality.reason, beforeIssues: copyIssues.length });
    continue;
  }

  let nextTitle = maskManualCopy(tutorial.title);
  if (isLowQualityCaptureTutorialTitle(nextTitle, { stepTitles: drafts.map(draft => draft.user_title) })) {
    nextTitle = buildCaptureFallbackTutorialTitle(drafts, {
      serviceNames: steps.map(step => step.domain_name),
    });
  }
  if (isLowQualityCaptureTutorialTitle(nextTitle, { stepTitles: drafts.map(draft => draft.user_title) })) {
    results.push({ tutorialId: tutorial.id, status: 'skipped', reason: 'tutorial_title', beforeIssues: copyIssues.length });
    continue;
  }

  const repairedSteps = steps.map(step => {
    const draft = drafts.find(candidate => candidate.id === step.id);
    return { ...step, user_title: draft.user_title, user_script: draft.user_script };
  });
  const afterCopyIssues = assessManualQuality(nextTitle, repairedSteps).filter(issue => copyIssueCodes.has(issue.code));
  if (afterCopyIssues.length) {
    results.push({ tutorialId: tutorial.id, status: 'skipped', reason: 'quality_remaining', beforeIssues: copyIssues.length, afterIssues: afterCopyIssues.length });
    continue;
  }

  const changedDrafts = drafts.filter((draft, index) =>
    draft.user_title !== maskManualCopy(steps[index].user_title || steps[index].ai_title)
    || draft.user_script !== maskManualCopy(steps[index].user_script || steps[index].ai_description)
  );
  if (apply) {
    for (const draft of changedDrafts) {
      const { error } = await supabase
        .from('mm_steps')
        .update({ user_title: draft.user_title, user_script: draft.user_script })
        .eq('id', draft.id)
        .eq('tutorial_id', tutorial.id);
      if (error) throw new Error(`step_update_failed:${draft.id}:${error.message}`);
    }
    if (nextTitle !== maskManualCopy(tutorial.title)) {
      const { error } = await supabase.from('mm_tutorials').update({ title: nextTitle }).eq('id', tutorial.id);
      if (error) throw new Error(`tutorial_update_failed:${tutorial.id}:${error.message}`);
    }
  }
  results.push({
    tutorialId: tutorial.id,
    status: apply ? 'updated' : 'ready',
    beforeIssues: copyIssues.length,
    afterIssues: 0,
    changedSteps: changedDrafts.length,
    changedTitle: nextTitle !== maskManualCopy(tutorial.title),
  });
}

console.log(JSON.stringify({
  ok: true,
  mode: apply ? 'apply' : 'dry-run',
  scanned: tutorials?.length || 0,
  candidates: results.length,
  ready: results.filter(result => result.status === 'ready' || result.status === 'updated').length,
  skipped: results.filter(result => result.status === 'skipped').length,
  results,
}, null, 2));
