'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  isToggleShortcut,
  isSupportedImportFile,
  preparePreviewHTML
} = require('../Erban-source-editor/lib/editor-utils.js');

function event(overrides) {
  return Object.assign({
    key: 'e',
    code: 'KeyE',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false
  }, overrides);
}

test('recognizes Ctrl+Shift+E and Meta+Shift+E as the editor toggle shortcut', () => {
  assert.equal(isToggleShortcut(event({ ctrlKey: true, shiftKey: true })), true);
  assert.equal(isToggleShortcut(event({ metaKey: true, shiftKey: true, key: 'E' })), true);
});

test('rejects incomplete or unrelated shortcut events', () => {
  assert.equal(isToggleShortcut(event({ ctrlKey: true })), false);
  assert.equal(isToggleShortcut(event({ ctrlKey: true, shiftKey: true, key: 'r', code: 'KeyR' })), false);
  assert.equal(isToggleShortcut(event({ ctrlKey: true, shiftKey: true, altKey: true })), false);
});

test('accepts html, htm, and txt files for import', () => {
  assert.equal(isSupportedImportFile({ name: 'article.html' }), true);
  assert.equal(isSupportedImportFile({ name: 'ARTICLE.HTM' }), true);
  assert.equal(isSupportedImportFile({ name: 'snippet.txt' }), true);
  assert.equal(isSupportedImportFile({ name: 'image.png' }), false);
});

test('prepares preview html by removing active content and preserving layout styles', () => {
  const html = '<section style="display:flex;width:200%;overflow-x:auto" onclick="bad()"><script>alert(1)</script><img data-src="https://example.com/a.png"><a href="javascript:alert(1)">x</a></section>';
  const result = preparePreviewHTML(html);

  assert.match(result, /display:flex/);
  assert.match(result, /width:200%/);
  assert.match(result, /overflow-x:auto/);
  assert.match(result, /src="https:\/\/example\.com\/a\.png"/);
  assert.doesNotMatch(result, /<script/i);
  assert.doesNotMatch(result, /onclick=/i);
  assert.doesNotMatch(result, /javascript:/i);
});

test('keeps real article fixture layout and image markers in preview html', () => {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/example2.html'), 'utf8');
  const result = preparePreviewHTML(fixture);

  assert.match(result, /两头蛇/);
  assert.match(result, /display:\s*flex/);
  assert.match(result, /overflow-x:\s*auto/);
  assert.match(result, /rich_pages wxw-img/);
  assert.match(result, /src="https:\/\/mmbiz\.qpic\.cn/);
});
