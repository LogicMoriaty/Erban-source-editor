# 贰伴 — 微信公众号 HTML 源代码编辑器

贰伴是一个轻量级 Chrome/Edge 浏览器扩展，用于在微信公众平台文章编辑页查看、编辑和应用正文 HTML 源代码。它对标壹伴插件的源代码编辑能力，重点提供源码编辑、手机式实时预览、本地导入、查找替换和语法高亮。

## 功能

- **HTML 源代码编辑**：在微信公众号文章编辑页直接读取、编辑并写回正文 HTML。
- **源码格式化**：打开编辑器时自动做换行和缩进；只格式化源码结构，不改写文章标签、属性、`style` 或图片数据。
- **手机式实时预览**：右侧预览以接近微信公众号手机阅读态的窄屏画布渲染，保留横向滑动图片容器、微信文章链接图标和正文排版。
- **本地导入**：支持导入 `.html`、`.htm`、`.txt` 文件内容到编辑器。
- **查找替换**：在源码编辑区按 `Ctrl+F` / `Cmd+F` 打开查找，支持上一个、下一个、替换、全部替换和大小写匹配；`Ctrl+H` / `Cmd+H` 可直接打开替换。
- **语法高亮**：HTML 标签、属性、字符串和注释会在编辑区中高亮显示。
- **快捷键开关**：使用 `Ctrl+Shift+E` / `Cmd+Shift+E` 快速打开或关闭源码编辑器。

## 安装

1. 打开浏览器扩展管理页面：
   - Edge：`edge://extensions`
   - Chrome：`chrome://extensions`
2. 开启“开发人员模式”或“开发者模式”。
3. 点击“加载解压缩的扩展”或“加载已解压的扩展程序”。
4. 选择仓库中的 `Erban-source-editor` 文件夹。

## 使用

1. 打开微信公众平台文章编辑页面。
2. 点击编辑器工具栏中的“贰伴 · 源代码”，或按 `Ctrl+Shift+E` / `Cmd+Shift+E`。
3. 在左侧编辑 HTML 源代码。
4. 可按需使用：
   - `格式化`：重新整理源码换行和缩进。
   - `导入 HTML`：从本地文件导入源码。
   - `实时预览`：打开右侧手机式预览。
   - `Ctrl+F` / `Cmd+F`：查找。
   - `Ctrl+H` / `Cmd+H`：查找替换。
   - `Ctrl+Enter` / `Cmd+Enter`：应用当前源码到微信公众号编辑器。

## 开发

本仓库保持无构建步骤的 Manifest V3 扩展结构。核心文件：

- `Erban-source-editor/manifest.json`：扩展清单、版本和权限。
- `Erban-source-editor/content-isolated.js`：插件 UI、编辑器生命周期和页面交互。
- `Erban-source-editor/content-main.js`：微信公众号编辑器 API 桥接。
- `Erban-source-editor/lib/editor-utils.js`：可测试的纯函数工具，包括源码格式化、预览准备、查找匹配和语法高亮。
- `Erban-source-editor/editor.css`：编辑器、搜索栏、语法高亮和预览样式。
- `tests/fixtures/`：真实微信公众号文章 HTML 夹具。
- `tests/editor-utils.test.js`：Node 内置测试。

运行测试：

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

更多开发说明见 [docs/development.md](docs/development.md)。
