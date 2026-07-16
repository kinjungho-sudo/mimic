'use strict';

const assert = require('node:assert/strict');
const { buildStepData } = require('../desktop-import.js');

const click = buildStepData({
  step_number: 7,
  event_type: 'click',
  captured_at: '2026-07-16T00:00:00.000Z',
  click_x: -640,
  click_y: 400,
  normalized_x: 0.5,
  normalized_y: 0.4,
  screen: { left: -1280, top: 0, width: 1280, height: 1000, mode: 'window' },
  window_title: '설정',
  process_name: 'SystemSettings',
  ui_element: {
    name: '네트워크 저장',
    automation_id: 'SaveNetworkButton',
    control_type: 'Button',
    left: -690,
    top: 350,
    width: 100,
    height: 60,
  },
}, 0);

assert.equal(click.stepNumber, 1);
assert.equal(click.clickX, 640, 'virtual-screen coordinates must become capture-relative coordinates');
assert.equal(click.clickY, 400);
assert.equal(click.actionInfo.type, 'click');
assert.equal(click.actionInfo.targetContext.captureSurface, 'desktop');
assert.equal(click.actionInfo.targetContext.captureApp, 'SystemSettings');
assert.equal(click.actionInfo.label, '네트워크 저장');
assert.equal(click.actionInfo.role, 'button');
assert.equal(click.elementSelector, 'uia:SaveNetworkButton');
assert.deepEqual(click.elementRect, { x: 0.4609375, y: 0.35, width: 0.078125, height: 0.06 });
assert.deepEqual(click.actionInfo.targetContext.localRect, { x: 590, y: 350, width: 100, height: 60 });

const manual = buildStepData({
  event_type: 'manual',
  normalized_x: 0.99,
  normalized_y: 0.01,
  screen: { left: 1920, top: 0, width: 1920, height: 1080, mode: 'monitor' },
}, 2);
assert.equal(manual.stepNumber, 3);
assert.equal(manual.actionInfo.type, 'navigate');
assert.equal(manual.actionInfo.label, 'Windows 데스크톱 화면 확인');
assert.equal(manual.elementRect, null);

console.log(JSON.stringify({ ok: true, checks: 15, clickApp: click.actionInfo.targetContext.captureApp }));
