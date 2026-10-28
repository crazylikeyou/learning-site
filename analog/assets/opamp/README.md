# 运放电路图资源

课程当前使用 `circuitikz/` 中的 LaTeX 电路图。

## 当前图片

`circuitikz/` 保存：

- 7 个 `.tex` 源文件
- 7 个由 PDF 渲染的 300 dpi PNG
- `build.ps1` 一键重编译脚本

生成流程：

1. 设置 `TEXMFHOME=E:\G\codex\texmf`
2. `pdflatex` 编译每个独立图
3. `pdftoppm -png -r 300` 渲染网页图片

## 旧版参考图

上一版 Wikimedia Commons 公有领域 SVG 存放在 `upstream/`，仅作来源留档，不再是课程页面使用的图片。
