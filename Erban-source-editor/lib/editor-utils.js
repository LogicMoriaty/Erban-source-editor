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

  function isJavascriptUrl(value) {
    return /^\s*javascript:/i.test(String(value || ''));
  }

  function preparePreviewWithDOM(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString('<!doctype html><html><body><div id="erban-preview-root">' + html + '</div></body></html>', 'text/html');
    var previewRoot = doc.getElementById('erban-preview-root');
    if (!previewRoot) return html;

    var walker = doc.createTreeWalker(previewRoot, NodeFilter.SHOW_ELEMENT, null, false);
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
        if (/^on/i.test(name) || isJavascriptUrl(attr.value)) {
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

    return previewRoot.innerHTML;
  }

  function preparePreviewWithStrings(html) {
    var result = String(html || '');
    REMOVED_PREVIEW_TAGS.forEach(function (tag) {
      var paired = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
      var single = new RegExp('<' + tag + '\\b[^>]*\\/?>', 'gi');
      result = result.replace(paired, '').replace(single, '');
    });
    result = result.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '');
    result = result.replace(/\s+[a-z0-9:-]+\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '');
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
