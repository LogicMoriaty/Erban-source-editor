# AGENTS.md

本文件适用于整个仓库。后续 agent 在本仓库工作时，应优先遵守这里的项目约定和验收方式。

## 项目概况

贰伴是一个无构建步骤的 Manifest V3 浏览器扩展，用于在微信公众号文章编辑页查看、编辑、格式化、导入并写回正文 HTML 源代码。扩展对标壹伴插件的源代码编辑和实时预览体验。

核心源码在 `Erban-source-editor/`：

- `manifest.json`：扩展清单、版本、权限、快捷键和 content script 配置。
- `background.js`：处理浏览器扩展命令并转发到微信公众号编辑页。
- `content-main.js`：注入页面主世界，桥接微信公众号编辑器 API 和 fallback 编辑区。
- `content-isolated.js`：隔离世界内的插件 UI、编辑器生命周期、导入、查找替换、实时预览和写回逻辑。
- `lib/editor-utils.js`：浏览器和 Node 测试共用的纯函数工具。
- `editor.css`：插件按钮、编辑器、语法高亮、查找栏和手机式预览样式。
- `tests/fixtures/`：真实微信公众号文章 HTML 夹具。
- `tests/editor-utils.test.js`：Node 内置测试。

## 工作方式

- 先读现有实现和测试，再改代码。不要凭印象重写已有逻辑。
- 优先使用 `rg` / `rg --files` 查找文件和文本。
- 手工编辑文件时使用 `apply_patch`。
- 工作树可能包含用户改动。不要重置、检出或覆盖不属于当前任务的改动。
- 保持变更范围小而可审查。避免顺手重构无关模块。
- 新功能和 bugfix 尽量先写失败测试，再实现，再跑完整测试。
- 提交前只暂存本任务相关文件，使用明确的提交信息。

## 关键行为约束

### 源码格式化

`formatSourceHTML()` 只做源码层面的换行和缩进。它不能改变文章实际排版语义：

- 不要用 DOM 解析后重新序列化整篇文章。
- 不要改写 `<p>`、`section`、`span`、`img` 的显式 `style`。
- 不要清理或重排 `data-*`、图片属性、微信自定义属性和横向滑动容器所需属性。
- 格式化前后的 `preparePreviewHTML()` 输出应保持等价；相关回归测试必须继续覆盖 `tests/fixtures/example2.html`。

### 实时预览

预览目标是接近微信公众号手机阅读态，不是普通桌面 HTML 预览：

- 保留正文中的 inline style、`display:flex`、`overflow-x:auto`、`width:200%` / `width:300%` 等布局信息。
- 不要对所有子元素强制 `max-width: 100%`，否则会破坏横向滑动图片轨道。
- 不要全局覆盖正文显式 `text-align`、行高或段落样式。
- 微信文章链接 `a.normal_text_link` 前的文章图标需要保留。
- 图片缺少 `src` 但有 `data-src` 时，应在预览中补齐 `src`。
- 可以移除脚本、事件属性和 `javascript:` URL，但不要把安全清理扩展成排版清理。

### 编辑器和语法高亮

左侧源码编辑器由行号 gutter、透明 textarea 和语法高亮 `<pre>` 三层叠加而成。三者的坐标系必须一致：

- `.wx-source-line-numbers`、`.wx-source-highlight`、`.wx-source-textarea` 必须共享同一套代码字体、字号、行高和上下 padding。
- `editor.css` 中的 `--eb-code-font`、`--eb-code-font-size`、`--eb-code-line-height`、`--eb-code-padding-y` 是对齐契约，不要随意拆开。
- 语法高亮 token 不要使用会改变字形度量的样式，例如 comment italic。
- 代码层应保持 `letter-spacing: 0`，并禁用 ligature，避免光标和可见文本横向错位。

### 快捷键和查找

- `Ctrl+Shift+E` / `Cmd+Shift+E` 应打开或关闭源码编辑器。
- `Ctrl+F` / `Cmd+F` 应打开源码区查找栏，不触发浏览器默认查找。
- 上一个/下一个查找结果必须选中命中位置，并滚动 textarea 让命中项进入可视区域。
- `Ctrl+H` / `Cmd+H` 应打开替换模式。

## 测试和验证

常规测试：

```bash
npm test
```

脚本语法检查：

```bash
node --check Erban-source-editor/content-isolated.js
node --check Erban-source-editor/background.js
node --check Erban-source-editor/content-main.js
node --check Erban-source-editor/lib/editor-utils.js
```

发布或改版本时，还要确认：

- `package.json` 和 `Erban-source-editor/manifest.json` 版本一致。
- `README.md` 与 `docs/development.md` 的功能描述没有过期。
- 浏览器扩展页重新加载 `Erban-source-editor/` 后，微信公众号文章编辑页能打开编辑器、导入夹具、实时预览、查找替换并写回。

## Fixture 和临时资产

- `tests/fixtures/example1.html` 和 `tests/fixtures/example2.html` 是正式回归夹具，应纳入版本控制并谨慎修改。
- `USER-temp/` 是用户临时目录，不要依赖它作为测试输入。需要保留的素材应复制到受管目录后再清理临时文件。
- 用户提供的截图通常只是排查参考，修完后可以删除临时截图文件，但不要删除正式 fixture。

## 前端风格

- 这是工作型浏览器插件，不是营销页。界面应克制、紧凑、可扫描。
- 预览区优先还原真实微信公众号正文，而不是追求装饰性视觉效果。
- 不要添加重型前端框架、打包器或大型依赖，除非需求明确且已有测试说明收益。
