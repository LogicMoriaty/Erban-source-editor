'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  isToggleShortcut,
  isSupportedImportFile,
  mergeParagraphStyle,
  prepareLoadedHTML,
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

test('keeps loaded editor html unchanged until the user explicitly formats it', () => {
  const raw = '<p style="line-height:2.5;text-align:center"><span>你相信吗 ?</span></p>\n<section data-pm-slice="1 1 []">正文</section>';

  assert.equal(prepareLoadedHTML(raw), raw);
  assert.match(prepareLoadedHTML(raw), /line-height:2\.5/);
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

test('preserves paragraph text alignment while adding WeChat paragraph defaults', () => {
  const result = mergeParagraphStyle(
    'text-align: center;color: rgb(255, 76, 65);',
    'margin:0;font-size:16px;line-height:1.75;'
  );

  assert.match(result, /margin:\s*0/);
  assert.match(result, /font-size:\s*16px/);
  assert.match(result, /line-height:\s*1\.75/);
  assert.match(result, /text-align:\s*center/);
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

test('preview stylesheet supports WeChat links and does not collapse swipe tracks', () => {
  const css = fs.readFileSync(path.join(__dirname, '../Erban-source-editor/editor.css'), 'utf8');

  assert.doesNotMatch(css, /\.wx-source-preview-content\s*\{[^}]*text-align:\s*justify\s*!important/s);
  assert.doesNotMatch(css, /\.wx-source-preview-content\s+\*\s*\{[^}]*max-width:\s*100%\s*!important/s);
  assert.match(css, /\.wx-source-preview-content\s+a\.normal_text_link::before/);
  assert.match(css, /\.wx-source-preview-content\s+\[style\*="width: 200%"\]/);
  assert.match(css, /\.wx-source-preview-content\s+\[style\*="width: 300%"\]/);
});
