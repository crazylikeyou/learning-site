# 共享资源（所有科目通用）

这里放跨科目复用的东西。新科目不要再复制一份，直接引用。

```
_shared\
├── css\
│   ├── course.css    课程页基础排版（正文、题目、选项、分数框）
│   └── circuit.css   电路图 SVG 样式（导线、元件、节点、标注）
└── katex\            KaTeX（含字体，完全离线）
    ├── katex.min.css
    ├── katex.min.js
    └── contrib\auto-render.min.js
```

## 新科目怎么引用

假设科目目录是 E:\G\learning\<科目>\，课程页在 <科目>\lessons\0001-xxx.html，
相对路径要往上跳两级：

```html
<link rel="stylesheet" href="../../_shared/css/course.css">
<link rel="stylesheet" href="../../_shared/css/circuit.css">
<link rel="stylesheet" href="../../_shared/katex/katex.min.css">
<script defer src="../../_shared/katex/katex.min.js"></script>
<script defer src="../../_shared/katex/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });
});
</script>
```

科目自己的 assets 目录保留给该科目独有的资源（专属插图、专属组件），
通用的一律进 _shared。

## 访问地址

服务器根是 E:\G\learning，所以：

- 课程页：http://127.0.0.1:8765/<科目>/lessons/0001-xxx.html
- 共享样式：http://127.0.0.1:8765/_shared/css/course.css

file:// 会被浏览器安全策略拦死，必须走这个服务器。
