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

  var VOID_TAGS = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
  };

  function findTagEnd(html, start) {
    var quote = '';
    for (var i = start + 1; i < html.length; i++) {
      var ch = html.charAt(i);
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        return i;
      }
    }
    return -1;
  }

  function tokenizeHTML(html) {
    var value = String(html || '');
    var tokens = [];
    var i = 0;

    while (i < value.length) {
      if (value.charAt(i) === '<') {
        var end = findTagEnd(value, i);
        if (end === -1) {
          tokens.push({ type: 'text', value: value.slice(i) });
          break;
        }
        tokens.push({ type: 'tag', value: value.slice(i, end + 1) });
        i = end + 1;
      } else {
        var next = value.indexOf('<', i);
        if (next === -1) next = value.length;
        tokens.push({ type: 'text', value: value.slice(i, next) });
        i = next;
      }
    }

    return tokens;
  }

  function tagInfo(tag) {
    var text = String(tag || '').trim();
    if (!text || /^<!--/.test(text) || /^<!/i.test(text) || /^<\?/.test(text)) {
      return { kind: 'special', name: '' };
    }

    var closing = text.match(/^<\/\s*([^\s>\/]+)/);
    if (closing) return { kind: 'close', name: closing[1].toLowerCase() };

    var opening = text.match(/^<\s*([^\s>\/]+)/);
    if (!opening) return { kind: 'special', name: '' };

    var name = opening[1].toLowerCase();
    if (/\/\s*>$/.test(text) || VOID_TAGS[name]) return { kind: 'self', name: name };
    return { kind: 'open', name: name };
  }

  function previousNonWhitespace(tokens, index) {
    for (var i = index - 1; i >= 0; i--) {
      if (tokens[i].type !== 'text' || /\S/.test(tokens[i].value)) return tokens[i];
    }
    return null;
  }

  function nextNonWhitespace(tokens, index) {
    for (var i = index + 1; i < tokens.length; i++) {
      if (tokens[i].type !== 'text' || /\S/.test(tokens[i].value)) return tokens[i];
    }
    return null;
  }

  function formatSourceHTML(html) {
    var tokens = tokenizeHTML(html);
    var lines = [];
    var current = [];
    var previousKept = null;

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (token.type === 'text' && !/\S/.test(token.value)) {
        var prev = previousNonWhitespace(tokens, i);
        var next = nextNonWhitespace(tokens, i);
        if (prev && prev.type === 'tag' && next && next.type === 'tag') continue;
      }

      if (token.type === 'tag' && previousKept && previousKept.type === 'tag' && current.length) {
        lines.push(current);
        current = [];
      }

      current.push(token);
      previousKept = token;
    }

    if (current.length) lines.push(current);

    var indent = 0;
    var result = [];
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      var lineTokens = lines[lineIndex];
      var firstTagInfo = null;
      var netIndent = 0;
      var text = '';

      for (var j = 0; j < lineTokens.length; j++) {
        var lineToken = lineTokens[j];
        text += lineToken.value;
        if (lineToken.type !== 'tag') continue;

        var info = tagInfo(lineToken.value);
        if (!firstTagInfo) firstTagInfo = info;
        if (info.kind === 'open') netIndent++;
        if (info.kind === 'close') netIndent--;
      }

      text = text.trim();
      if (!text) continue;

      var lineIndent = firstTagInfo && firstTagInfo.kind === 'close' ? Math.max(indent - 1, 0) : indent;
      result.push(new Array(lineIndent + 1).join('  ') + text);
      indent = Math.max(indent + netIndent, 0);
    }

    return result.join('\n');
  }

  function prepareLoadedHTML(html) {
    return formatSourceHTML(html);
  }

  function getInlineStyleValue(styleText, propName) {
    var parts = String(styleText || '').split(';');
    var target = String(propName || '').toLowerCase();
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i];
      var colon = piece.indexOf(':');
      if (colon === -1) continue;
      var name = piece.slice(0, colon).trim().toLowerCase();
      if (name === target) return piece.slice(colon + 1).trim();
    }
    return '';
  }

  function mergeParagraphStyle(existingStyle, baseStyle) {
    var base = String(baseStyle || '').replace(/;?\s*$/, '');
    var textAlign = getInlineStyleValue(existingStyle, 'text-align');
    if (textAlign && !getInlineStyleValue(base, 'text-align')) {
      base += ';text-align:' + textAlign;
    }
    return base;
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
    formatSourceHTML: formatSourceHTML,
    isToggleShortcut: isToggleShortcut,
    isSupportedImportFile: isSupportedImportFile,
    mergeParagraphStyle: mergeParagraphStyle,
    prepareLoadedHTML: prepareLoadedHTML,
    preparePreviewHTML: preparePreviewHTML
  };
});
