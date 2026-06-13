/**
 * 贰伴 ErBan — ISOLATED world script
 * Injects MAIN world bridge, UI dialog, and toolbar button.
 * Communicates with content-main.js via CustomEvent.
 */
(function () {
  'use strict';

  // Only inject UI in top frame
  if (window.self !== window.top) return;

  // Only activate on article editor pages
  if (!/appmsg_edit/.test(window.location.href)) return;

  // ============================================================
  //  Inject MAIN world bridge via <script> tag
  // ============================================================
  var bridgeScript = document.createElement('script');
  bridgeScript.src = chrome.runtime.getURL('content-main.js');
  bridgeScript.onload = function () { bridgeScript.remove(); };
  (document.head || document.documentElement).appendChild(bridgeScript);

  // ============================================================
  //  State
  // ============================================================
  var REQ_EVENT = 'wx-source-editor-req';
  var RES_EVENT = 'wx-source-editor-resp';
  var dialogEl = null;
  var isDirty = false;
  var isDialogOpen = false;
  var lastSavedContent = '';
  var pendingRequests = {};
  var buttonInjected = false;
  var utils = window.ErbanEditorUtils || {};

  // Expose handlers on window for inline onclick (more robust than addEventListener)
  function exposeHandlers() {
    window.__erban_close = function () { console.log('[贰伴] close btn clicked'); closeEditor(); };
    window.__erban_apply = function () { console.log('[贰伴] apply btn clicked'); applyChanges(); };
    window.__erban_format = function () {
      var ta = document.getElementById('wsrc-textarea');
      if (!ta) return;
      try { var f = formatHTML(ta.value); if (f) { ta.value = f; ta.dispatchEvent(new Event('input',{bubbles:true})); showToast('info','已格式化'); } } catch (e) { showToast('error','格式化失败'); }
    };
    window.__erban_togglePreview = function (cb) {
      var panel = document.getElementById('wsrc-preview-panel');
      var content = document.getElementById('wsrc-preview-content');
      var ta = document.getElementById('wsrc-textarea');
      if (cb.checked) {
        if (panel) panel.classList.add('visible');
        if (content && ta) content.innerHTML = utils.preparePreviewHTML ? utils.preparePreviewHTML(ta.value) : sanitizeForWeChat(ta.value);
      }
      else { if (panel) panel.classList.remove('visible'); }
    };
  }

  // ============================================================
  //  Communication with MAIN world
  // ============================================================
  function guid() {
    return 'erban_' + Math.random().toString(36).slice(2, 10);
  }

  function sendRequest(type, extra) {
    return new Promise(function (resolve, reject) {
      var requestId = guid();
      pendingRequests[requestId] = { resolve: resolve, reject: reject };
      var detail = { type: type, requestId: requestId };
      if (extra) Object.assign(detail, extra);
      window.dispatchEvent(new CustomEvent(REQ_EVENT, { detail: detail }));
      setTimeout(function () {
        if (pendingRequests[requestId]) {
          delete pendingRequests[requestId];
          reject(new Error('请求超时 — 编辑器API未响应'));
        }
      }, 5000);
    });
  }

  function clearPendingRequests() {
    var keys = Object.keys(pendingRequests);
    for (var i = 0; i < keys.length; i++) {
      pendingRequests[keys[i]].reject(new Error('对话框已关闭'));
      delete pendingRequests[keys[i]];
    }
  }

  window.addEventListener(RES_EVENT, function (e) {
    var detail = e.detail;
    if (!detail || !detail.requestId) return;
    var handler = pendingRequests[detail.requestId];
    if (!handler) return;
    delete pendingRequests[detail.requestId];
    if (detail.type === 'CONTENT_RESULT') {
      if (detail.data && detail.data.success) {
        handler.resolve(detail.data.html || '');
      } else {
        handler.reject(new Error((detail.data && detail.data.error) || '无法获取编辑器内容'));
      }
    } else if (detail.type === 'SET_RESULT') {
      if (detail.data && detail.data.success) {
        handler.resolve(detail.data);
      } else {
        handler.reject(new Error((detail.data && detail.data.error) || '写入编辑器失败'));
      }
    } else if (detail.type === 'PONG') {
      handler.resolve(detail.data);
    }
  });

  // ============================================================
  //  HTML Sanitization
  // ============================================================
  var REMOVED_TAGS = {
    'script': true, 'iframe': true, 'object': true, 'embed': true,
    'form': true, 'input': true, 'select': true, 'textarea': true,
    'style': true, 'link': true, 'meta': true, 'base': true,
    'applet': true, 'audio': true
  };

  var BANNED_CSS_PROPS = [
    'position', 'display', 'flex', 'flex-direction', 'flex-wrap',
    'justify-content', 'align-items', 'align-content', 'align-self',
    'order', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-flow',
    'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
    'grid-template-areas', 'grid-column', 'grid-row', 'grid-area',
    'grid-gap', 'grid-column-gap', 'grid-row-gap', 'gap',
    'animation', 'animation-name', 'animation-duration', 'animation-delay',
    'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
    'animation-play-state', 'animation-timing-function',
    'transition', 'transition-property', 'transition-duration',
    'transition-delay', 'transition-timing-function',
    'transform', 'transform-origin', 'transform-style',
    'opacity', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
    'cursor', 'pointer-events', 'user-select',
    'filter', 'backdrop-filter', 'perspective',
    'visibility', 'clip', 'clip-path',
    'float', 'clear', 'top', 'right', 'bottom', 'left'
  ];

  function sanitizeCSS(cssText) {
    if (!cssText) return '';
    return cssText.split(';').filter(function (prop) {
      var name = prop.split(':')[0];
      if (!name) return false;
      name = name.trim().toLowerCase();
      for (var i = 0; i < BANNED_CSS_PROPS.length; i++) {
        if (name === BANNED_CSS_PROPS[i] || name.indexOf(BANNED_CSS_PROPS[i] + '-') === 0) return false;
      }
      return true;
    }).join(';');
  }

  function sanitizeForWeChat(html) {
    if (!html) return '';
    var parser = new DOMParser();
    var doc = parser.parseFromString('<!DOCTYPE html><html><body><div id="sn-root">' + html + '</div></body></html>', 'text/html');
    var root = doc.getElementById('sn-root');
    if (!root) return html;
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
    var removeList = [];
    while (walker.nextNode()) {
      var el = walker.currentNode;
      var tag = el.tagName.toLowerCase();
      if (REMOVED_TAGS[tag]) { removeList.push(el); continue; }
      var attrs = Array.from(el.attributes);
      for (var i = 0; i < attrs.length; i++) {
        var an = attrs[i].name.toLowerCase();
        if (/^on/i.test(an)) el.removeAttribute(an);
        if (attrs[i].value && /^\s*javascript:/i.test(attrs[i].value)) el.removeAttribute(an);
      }
      if (el.hasAttribute('style')) {
        var c = sanitizeCSS(el.getAttribute('style'));
        if (c) el.setAttribute('style', c); else el.removeAttribute('style');
      }
    }
    for (var j = 0; j < removeList.length; j++) {
      var p = removeList[j].parentNode;
      if (p) p.removeChild(removeList[j]);
    }
    return root.innerHTML;
  }

  function formatHTML(html) {
    return utils.formatSourceHTML ? utils.formatSourceHTML(html) : String(html || '');
  }

  // ============================================================
  //  Editor Dialog
  // ============================================================
  function createEditorDialog() {
    if (dialogEl) return;
    dialogEl = document.createElement('div');
    dialogEl.className = 'wx-source-overlay';
    dialogEl.innerHTML = [
      '<div class="wx-source-dialog">',
      ' <div class="wx-source-header"><div class="wx-source-header-left"><span class="wx-source-title">贰伴 · HTML 源代码</span></div><div class="wx-source-header-right"><button class="wx-source-btn" id="wsrc-btn-import">导入 HTML</button><input class="wx-source-file-input" id="wsrc-import-input" type="file" accept=".html,.htm,.txt,text/html,text/plain"><button class="wx-source-btn" id="wsrc-btn-format">格式化</button><label class="wx-source-check-label"><input type="checkbox" id="wsrc-toggle-preview"> 实时预览</label><button class="wx-source-btn-close" id="wsrc-btn-close">&times;</button></div></div>',
      ' <div class="wx-source-body"><div class="wx-source-code-panel"><div class="wx-source-line-numbers" id="wsrc-line-numbers">1</div><textarea class="wx-source-textarea" id="wsrc-textarea" placeholder="在此编辑 HTML 源代码..." spellcheck="false" wrap="off"></textarea></div><div class="wx-source-preview-panel" id="wsrc-preview-panel"><div class="wx-source-preview-note">手机预览按微信公众号正文阅读态模拟，实际发布效果以微信客户端为准。</div><div class="wx-source-preview-stage"><div class="wx-source-phone-frame"><div class="wx-source-preview-content" id="wsrc-preview-content"></div></div></div></div></div>',
      ' <div class="wx-source-footer"><span class="wx-source-status" id="wsrc-status">就绪</span><div class="wx-source-footer-right"><button class="wx-source-btn wx-source-btn-cancel" id="wsrc-btn-cancel">取消</button><button class="wx-source-btn wx-source-btn-apply" id="wsrc-btn-apply">应用</button></div></div>',
      '</div>'
    ].join('');
    document.body.appendChild(dialogEl);
    try { bindDialogEvents(); } catch (e) { console.error('[贰伴] bindDialogEvents error:', e); }
  }

  function getEl(id) { return document.getElementById(id); }

  function bindDialogEvents() {
    try {
      var textarea = getEl('wsrc-textarea');
      var lineNumbers = getEl('wsrc-line-numbers');
      var previewPanel = getEl('wsrc-preview-panel');
      var previewContent = getEl('wsrc-preview-content');
      var previewToggle = getEl('wsrc-toggle-preview');
      var statusEl = getEl('wsrc-status');

      // Use .onclick (DOM property, NOT HTML attribute) to bypass WeChat's CSP
      var closeBtn = getEl('wsrc-btn-close');
      var cancelBtn = getEl('wsrc-btn-cancel');
      var applyBtn = getEl('wsrc-btn-apply');
      var importBtn = getEl('wsrc-btn-import');
      var importInput = getEl('wsrc-import-input');
      var formatBtn = getEl('wsrc-btn-format');

      if (closeBtn) closeBtn.onclick = function (e) { e.preventDefault(); closeEditor(); };
      if (cancelBtn) cancelBtn.onclick = function (e) { e.preventDefault(); closeEditor(); };
      if (applyBtn) applyBtn.onclick = function (e) { e.preventDefault(); applyChanges(); };
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
            isDirty = (textarea.value !== lastSavedContent);
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
      if (formatBtn) formatBtn.onclick = function (e) { e.preventDefault();
        try { var f = formatHTML(textarea.value); if (f) { textarea.value = f; updateLines(); updatePrev(); setStat('info','已格式化'); } } catch (err) { setStat('error','格式化失败: '+err.message); }
      };

      if (previewToggle) previewToggle.onchange = function () {
        if (this.checked) { previewPanel.classList.add('visible'); updatePrev(); } else { previewPanel.classList.remove('visible'); }
      };

      textarea.addEventListener('input', function () {
        isDirty = (textarea.value !== lastSavedContent);
        updateLines();
        if (previewToggle.checked) updatePrev();
      });
      textarea.addEventListener('scroll', function () { lineNumbers.scrollTop = textarea.scrollTop; });
      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') { e.preventDefault(); var s=textarea.selectionStart,ed=textarea.selectionEnd; textarea.value=textarea.value.substring(0,s)+'  '+textarea.value.substring(ed); textarea.selectionStart=textarea.selectionEnd=s+2; isDirty=true; updateLines(); }
        if (e.key === 'Enter' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); applyChanges(); }
        if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
      });
      dialogEl.onclick = function (e) { if (e.target === dialogEl) closeEditor(); };

      function updateLines() { var lines=textarea.value.split('\n'),n=''; for(var i=1;i<=Math.max(lines.length,1);i++)n+=i+'\n'; lineNumbers.textContent=n; }
      function updatePrev() {
        try {
          previewContent.innerHTML = utils.preparePreviewHTML ? utils.preparePreviewHTML(textarea.value) : sanitizeForWeChat(textarea.value);
        } catch (err) {
          previewContent.textContent = '预览渲染失败: ' + err.message;
        }
      }
      function setStat(t,m){ statusEl.textContent=m; statusEl.className='wx-source-status '+t; }
    } catch (e) {
      console.error('[贰伴] bindDialogEvents error:', e);
    }
  }

  // ============================================================
  //  Open / Close / Apply
  // ============================================================
  function openEditor() {
    if (isDialogOpen) return;
    if (!dialogEl) createEditorDialog();
    dialogEl.style.setProperty('display', 'flex', 'important');
    isDialogOpen = true;
    var textarea = getEl('wsrc-textarea');
    var statusEl = getEl('wsrc-status');
    textarea.value = '';
    getEl('wsrc-line-numbers').textContent = '1';
    if (statusEl) { statusEl.textContent = '正在读取编辑器内容...'; statusEl.className = 'wx-source-status'; }
    sendRequest('GET_CONTENT').then(
      function (html) {
        var loaded = utils.prepareLoadedHTML ? utils.prepareLoadedHTML(html) : String(html || '');
        textarea.value = loaded;
        lastSavedContent = loaded;
        isDirty = false;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if (statusEl) { statusEl.textContent = '就绪 — 已格式化, ' + loaded.length + ' 个字符'; statusEl.className = 'wx-source-status'; }
        textarea.focus();
      },
      function (err) {
        textarea.value = '';
        textarea.placeholder = '无法读取编辑器内容。请确认页面已加载完成，并刷新后重试。';
        lastSavedContent = ''; isDirty = false;
        if (statusEl) { statusEl.textContent = '读取失败: ' + err.message; statusEl.className = 'wx-source-status error'; }
      }
    );
  }

  function closeEditor() {
    console.log('[贰伴] closeEditor called, isDialogOpen=' + isDialogOpen + ' isDirty=' + isDirty + ' dialogEl=' + !!dialogEl);
    if (!isDialogOpen) { console.log('[贰伴] closeEditor: not open, forcing close anyway'); }
    if (isDirty) {
      if (!confirm('确定关闭？未应用的修改将丢失。')) return;
    }
    clearPendingRequests();
    if (dialogEl) dialogEl.style.setProperty('display', 'none', 'important');
    isDialogOpen = false;
    isDirty = false;
    console.log('[贰伴] closeEditor: dialog hidden');
  }

  function applyChanges() {
    if (!isDialogOpen) return;
    var textarea = getEl('wsrc-textarea');
    var html = textarea.value;
    var statusEl = getEl('wsrc-status');
    statusEl.textContent = '正在应用...'; statusEl.className = 'wx-source-status';
    sendRequest('SET_CONTENT', { html: html }).then(
      function () {
        lastSavedContent = html; isDirty = false;
        statusEl.textContent = '已应用 — ' + html.length + ' 个字符';
        statusEl.className = 'wx-source-status success';
        showToast('success', '内容已写入编辑器');
      },
      function (err) {
        statusEl.textContent = '应用失败: ' + err.message;
        statusEl.className = 'wx-source-status error';
        showToast('error', '写入失败: ' + err.message);
      }
    );
  }

  function toggleEditor() { isDialogOpen ? closeEditor() : openEditor(); }

  window.addEventListener('keydown', function (e) {
    if (utils.isToggleShortcut && utils.isToggleShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      toggleEditor();
    }
  }, true);

  // ============================================================
  //  Toast
  // ============================================================
  function showToast(type, msg) {
    var toast = document.createElement('div');
    toast.className = 'wx-source-toast ' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s ease';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 2000);
  }

  // ============================================================
  //  Page leave protection
  // ============================================================
  window.addEventListener('beforeunload', function (e) {
    if (isDialogOpen && isDirty) { e.preventDefault(); e.returnValue = '有未应用的修改，确定离开吗？'; return e.returnValue; }
  });

  // ============================================================
  //  Toolbar Button Injection (MutationObserver on #js_appmsg_editor)
  // ============================================================
  function createButton() {
    var btn = document.createElement('span');
    btn.className = 'wx-edit-source-btn';
    btn.textContent = '贰伴 · 源代码';
    btn.title = '编辑 HTML 源代码 (Ctrl+Shift+E)';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openEditor(); });
    return btn;
  }

  function tryInjectToolbarButton() {
    if (buttonInjected) return true;

    // Strategy A: 壹伴-style — create our own toolbar row inside #edui1
    var edui1 = document.getElementById('edui1');
    if (edui1 && edui1.offsetParent !== null) {
      // Check if we already created our container
      var existing = document.getElementById('erban-extra-tools');
      if (existing) {
        existing.appendChild(createButton());
        buttonInjected = true;
        console.log('[贰伴] 按钮追加到已有 erban-extra-tools');
        return true;
      }

      // Create our toolbar container (same approach as 壹伴's #mpa-extra-tools)
      var container = document.createElement('div');
      container.id = 'erban-extra-tools';
      container.className = 'mpa-view';
      container.innerHTML = '<div class="mpa-extra-tools-placeholder"></div><div id="erban-extra-tools-container-wrapper"><div id="erban-extra-tools-container"></div></div>';
      container.querySelector('#erban-extra-tools-container').appendChild(createButton());

      // Insert before #imageMenu_root (same position 壹伴 uses)
      var imageMenu = document.getElementById('imageMenu_root');
      if (imageMenu) {
        edui1.insertBefore(container, imageMenu);
      } else {
        edui1.appendChild(container);
      }
      buttonInjected = true;
      console.log('[贰伴] 新工具栏行注入 #edui1 (壹伴风格)');
      return true;
    }

    // Strategy B: native toolbar #js_toolbar_0
    var toolbar = document.getElementById('js_toolbar_0');
    if (toolbar && toolbar.offsetParent !== null) {
      toolbar.appendChild(createButton());
      buttonInjected = true;
      console.log('[贰伴] 按钮注入: #js_toolbar_0');
      return true;
    }

    return false;
  }

  function injectButtonViaObserver() {
    console.log('[贰伴] 开始等待编辑器加载...');

    // Try immediate injection
    if (tryInjectToolbarButton()) return;

    // Watch for #edui1 appearing (UEditor container)
    var appmsgEditor = document.getElementById('js_appmsg_editor');
    if (appmsgEditor) {
      var editorObserver = new MutationObserver(function () {
        if (tryInjectToolbarButton()) {
          editorObserver.disconnect();
          console.log('[贰伴] MutationObserver 检测到编辑器，注入成功');
        }
      });
      editorObserver.observe(appmsgEditor, { childList: true, subtree: true });
      console.log('[贰伴] MutationObserver 已设置在 #js_appmsg_editor');
    } else {
      console.log('[贰伴] #js_appmsg_editor 不存在，等待中...');
    }

    // Retry every 500ms for 60 seconds
    var attempts = 0;
    var fallbackInterval = setInterval(function () {
      attempts++;
      if (tryInjectToolbarButton()) {
        clearInterval(fallbackInterval);
        console.log('[贰伴] 轮询第 ' + attempts + ' 次注入成功');
        return;
      }
      if (attempts % 10 === 0) {
        console.log('[贰伴] 轮询第 ' + attempts + ' 次，等待编辑器中... edui1=' + !!document.getElementById('edui1') + ' js_toolbar_0=' + !!document.getElementById('js_toolbar_0'));
      }
      if (attempts > 120) {
        clearInterval(fallbackInterval);
        console.log('[贰伴] 轮询超时，使用浮动按钮');
        injectFloatingButton();
      }
    }, 500);
  }

  function injectFloatingButton() {
    if (buttonInjected || document.querySelector('.wx-edit-source-btn')) return;
    var fb = createButton();
    fb.style.cssText = 'position:fixed!important;top:120px!important;right:24px!important;z-index:2147483630!important;';
    document.body.appendChild(fb);
    buttonInjected = true;
    console.log('[贰伴] 浮动按钮注入');
  }

  // ============================================================
  //  Keyboard Shortcut
  // ============================================================
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'TOGGLE_EDITOR') { toggleEditor(); sendResponse({ success: true }); }
    else if (message.type === 'GET_STATUS') { sendResponse({ connected: true, dialogOpen: isDialogOpen }); }
  });

  // ============================================================
  //  Initialize
  // ============================================================
  console.log('[贰伴] ISOLATED world ready');
  injectButtonViaObserver();
})();
