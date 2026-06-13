# Erban Source Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the editor shortcut, add mobile-style WeChat article preview, add HTML file import, and establish lightweight tests for the browser extension.

**Architecture:** Keep the current no-build Manifest V3 extension. Add one UMD-style utility file loaded before `content-isolated.js` and required by Node tests. Keep page lifecycle and WeChat bridge behavior in `content-isolated.js`.

**Tech Stack:** Chrome/Edge Manifest V3, plain JavaScript, CSS, Node built-in `node:test`.

---

## File Structure

- Create `.gitignore` to ignore local temp assets and generated files.
- Create `package.json` with `npm test` pointing to Node's built-in test runner.
- Create `Erban-source-editor/lib/editor-utils.js` for pure helpers:
  - `isToggleShortcut(event)`
  - `isSupportedImportFile(fileLike)`
  - `preparePreviewHTML(html)`
- Modify `Erban-source-editor/manifest.json` to load `lib/editor-utils.js` before `content-isolated.js`.
- Modify `Erban-source-editor/content-isolated.js` to use helpers, add file import UI, and render mobile preview.
- Modify `Erban-source-editor/editor.css` to style the import control and phone preview canvas.
- Create `tests/editor-utils.test.js`.
- Create `tests/fixtures/example1.html` and `tests/fixtures/example2.html` by copying from `USER-temp/`.

### Task 1: Test Harness and Fixtures

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tests/fixtures/example1.html`
- Create: `tests/fixtures/example2.html`
- Create: `tests/editor-utils.test.js`

- [ ] **Step 1: Copy fixtures**

Run:

```bash
mkdir -p tests/fixtures
cp USER-temp/example1.html tests/fixtures/example1.html
cp USER-temp/example2.html tests/fixtures/example2.html
```

Expected: both fixture files exist under `tests/fixtures/`.

- [ ] **Step 2: Add `.gitignore`**

Create:

```gitignore
node_modules/
npm-debug.log*
yarn-error.log*
pnpm-debug.log*
coverage/
dist/
build/
.DS_Store
Thumbs.db
USER-temp/
```

- [ ] **Step 3: Add `package.json`**

Create:

```json
{
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

- [ ] **Step 4: Write the first failing utility tests**

Create `tests/editor-utils.test.js`:

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
```

- [ ] **Step 5: Run tests to verify RED**

Run:

```bash
npm test
```

Expected: fails because `Erban-source-editor/lib/editor-utils.js` does not exist.

### Task 2: Utility Module

**Files:**
- Create: `Erban-source-editor/lib/editor-utils.js`
- Test: `tests/editor-utils.test.js`

- [ ] **Step 1: Implement minimal UMD utility module**

Create `Erban-source-editor/lib/editor-utils.js` with:

```javascript
(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.ErbanEditorUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var REMOVED_PREVIEW_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'select',
    'textarea', 'link', 'meta', 'base', 'applet'
  ];

  function isToggleShortcut(event) {
    if (!event || event.altKey || !event.shiftKey) return false;
    if (!event.ctrlKey && !event.metaKey) return false;
    var key = String(event.key || '').toLowerCase();
    var code = String(event.code || '').toLowerCase();
    return key === 'e' || code === 'keye';
  }

  function isSupportedImportFile(file) {
    var name = String((file && file.name) || '').toLowerCase();
    return /\.(html|htm|txt)$/.test(name);
  }

  function sanitizeUrlAttribute(value) {
    return /^\s*javascript:/i.test(String(value || '')) ? '' : value;
  }

  function preparePreviewWithDOM(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString('<!doctype html><html><body><div id="erban-preview-root">' + html + '</div></body></html>', 'text/html');
    var root = doc.getElementById('erban-preview-root');
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
    var removeList = [];

    while (walker.nextNode()) {
      var el = walker.currentNode;
      var tag = el.tagName.toLowerCase();
      if (REMOVED_PREVIEW_TAGS.indexOf(tag) !== -1) {
        removeList.push(el);
        continue;
      }

      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (/^on/i.test(name)) {
          el.removeAttribute(attr.name);
          return;
        }
        if (sanitizeUrlAttribute(attr.value) === '') {
          el.removeAttribute(attr.name);
        }
      });

      if (tag === 'img' && !el.getAttribute('src') && el.getAttribute('data-src')) {
        el.setAttribute('src', el.getAttribute('data-src'));
      }
    }

    removeList.forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    return root.innerHTML;
  }

  function preparePreviewWithStrings(html) {
    var result = String(html || '');
    REMOVED_PREVIEW_TAGS.forEach(function (tag) {
      var paired = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
      var single = new RegExp('<' + tag + '\\b[^>]*\\/?>', 'gi');
      result = result.replace(paired, '').replace(single, '');
    });
    result = result.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '');
    result = result.replace(/\s+(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '');
    result = result.replace(/<img\b([^>]*?)>/gi, function (match, attrs) {
      if (/\ssrc\s*=/i.test(attrs) || !/\sdata-src\s*=/i.test(attrs)) return match;
      var dataSrcMatch = attrs.match(/\sdata-src\s*=\s*(["'])(.*?)\1/i);
      if (!dataSrcMatch) return match;
      return '<img' + attrs + ' src="' + dataSrcMatch[2] + '">';
    });
    return result;
  }

  function preparePreviewHTML(html) {
    if (!html) return '';
    if (typeof DOMParser !== 'undefined' && typeof NodeFilter !== 'undefined') {
      return preparePreviewWithDOM(String(html));
    }
    return preparePreviewWithStrings(String(html));
  }

  return {
    isToggleShortcut: isToggleShortcut,
    isSupportedImportFile: isSupportedImportFile,
    preparePreviewHTML: preparePreviewHTML
  };
});
```

- [ ] **Step 2: Run tests to verify GREEN**

Run:

```bash
npm test
```

Expected: all utility tests pass.

- [ ] **Step 3: Commit**

Run:

```bash
git add .gitignore package.json tests Erban-source-editor/lib/editor-utils.js
git commit -m "chore: add test harness and editor utilities"
```

### Task 3: Wire Shortcut and Utility Script

**Files:**
- Modify: `Erban-source-editor/manifest.json`
- Modify: `Erban-source-editor/content-isolated.js`
- Test: `tests/editor-utils.test.js`

- [ ] **Step 1: Update manifest content script order**

Change content scripts from:

```json
"js": ["content-isolated.js"]
```

to:

```json
"js": ["lib/editor-utils.js", "content-isolated.js"]
```

- [ ] **Step 2: Add shortcut listener in `content-isolated.js`**

Near existing state variables, add:

```javascript
var utils = window.ErbanEditorUtils || {};
```

Before initialization, add:

```javascript
window.addEventListener('keydown', function (e) {
  if (utils.isToggleShortcut && utils.isToggleShortcut(e)) {
    e.preventDefault();
    e.stopPropagation();
    toggleEditor();
  }
}, true);
```

- [ ] **Step 3: Verify syntax and tests**

Run:

```bash
npm test
node --check Erban-source-editor/content-isolated.js
```

Expected: tests pass and syntax check exits with code 0.

- [ ] **Step 4: Commit**

Run:

```bash
git add Erban-source-editor/manifest.json Erban-source-editor/content-isolated.js
git commit -m "fix: support editor toggle shortcut"
```

### Task 4: Mobile Preview Rendering

**Files:**
- Modify: `Erban-source-editor/content-isolated.js`
- Modify: `Erban-source-editor/editor.css`
- Test: `tests/editor-utils.test.js`

- [ ] **Step 1: Update preview markup**

In `createEditorDialog()`, replace the preview panel markup with:

```javascript
' <div class="wx-source-preview-panel" id="wsrc-preview-panel"><div class="wx-source-preview-note">手机预览按微信公众号正文阅读态模拟，实际发布效果以微信客户端为准。</div><div class="wx-source-preview-stage"><div class="wx-source-phone-frame"><div class="wx-source-preview-content" id="wsrc-preview-content"></div></div></div></div>'
```

- [ ] **Step 2: Use `preparePreviewHTML()`**

Replace:

```javascript
function updatePrev() { previewContent.innerHTML = sanitizeForWeChat(textarea.value); }
```

with:

```javascript
function updatePrev() {
  try {
    previewContent.innerHTML = utils.preparePreviewHTML ? utils.preparePreviewHTML(textarea.value) : sanitizeForWeChat(textarea.value);
  } catch (err) {
    previewContent.textContent = '预览渲染失败: ' + err.message;
  }
}
```

- [ ] **Step 3: Add phone preview CSS**

Replace the current preview CSS block with selectors for `.wx-source-preview-stage`, `.wx-source-phone-frame`, and `.wx-source-preview-content`. The phone frame must be `width: min(390px, calc(100% - 32px))`, have white background, and contain WeChat-like body defaults: `font-size: 16px`, `line-height: 1.75`, `letter-spacing: 0.034em`, `word-break: break-word`.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
node --check Erban-source-editor/content-isolated.js
```

Expected: tests pass and syntax check exits with code 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add Erban-source-editor/content-isolated.js Erban-source-editor/editor.css
git commit -m "feat: add mobile-style preview rendering"
```

### Task 5: File Import

**Files:**
- Modify: `Erban-source-editor/content-isolated.js`
- Modify: `Erban-source-editor/editor.css`
- Test: `tests/editor-utils.test.js`

- [ ] **Step 1: Update toolbar markup**

Add an import button and hidden input in the header:

```javascript
' <div class="wx-source-header"><div class="wx-source-header-left"><span class="wx-source-title">贰伴 · HTML 源代码</span></div><div class="wx-source-header-right"><button class="wx-source-btn" id="wsrc-btn-import">导入 HTML</button><input class="wx-source-file-input" id="wsrc-import-input" type="file" accept=".html,.htm,.txt,text/html,text/plain"><button class="wx-source-btn" id="wsrc-btn-format">格式化</button><label class="wx-source-check-label"><input type="checkbox" id="wsrc-toggle-preview"> 实时预览</label><button class="wx-source-btn-close" id="wsrc-btn-close">&times;</button></div></div>'
```

- [ ] **Step 2: Add import binding**

In `bindDialogEvents()`, fetch:

```javascript
var importBtn = getEl('wsrc-btn-import');
var importInput = getEl('wsrc-import-input');
```

Bind:

```javascript
if (importBtn && importInput) {
  importBtn.onclick = function (e) {
    e.preventDefault();
    importInput.value = '';
    importInput.click();
  };
  importInput.onchange = function () {
    var file = importInput.files && importInput.files[0];
    if (!file) return;
    if (utils.isSupportedImportFile && !utils.isSupportedImportFile(file)) {
      setStat('error', '请选择 HTML 或文本文件');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      textarea.value = String(reader.result || '');
      isDirty = textarea.value !== lastSavedContent;
      updateLines();
      if (previewToggle.checked) updatePrev();
      setStat('success', '已导入 ' + file.name + ' — ' + textarea.value.length + ' 个字符');
    };
    reader.onerror = function () {
      setStat('error', '读取失败: ' + file.name);
    };
    reader.readAsText(file, 'utf-8');
  };
}
```

- [ ] **Step 3: Add hidden input CSS**

Add:

```css
.wx-source-file-input {
  display: none !important;
}
```

- [ ] **Step 4: Verify**

Run:

```bash
npm test
node --check Erban-source-editor/content-isolated.js
node --check Erban-source-editor/background.js
node --check Erban-source-editor/lib/editor-utils.js
```

Expected: all commands exit with code 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add Erban-source-editor/content-isolated.js Erban-source-editor/editor.css
git commit -m "feat: import html into source editor"
```

### Task 6: Final Verification

**Files:**
- Review all changed files.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
node --check Erban-source-editor/content-isolated.js
node --check Erban-source-editor/background.js
node --check Erban-source-editor/content-main.js
node --check Erban-source-editor/lib/editor-utils.js
git status --short --branch
```

Expected: tests pass, syntax checks pass, and git status shows only intentional committed changes plus ignored `USER-temp/`.

- [ ] **Step 2: Inspect final diff**

Run:

```bash
git log --oneline --decorate -5
git diff --stat main...HEAD
```

Expected: commits are focused and diff matches the planned files.
