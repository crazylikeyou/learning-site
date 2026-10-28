# circuitikz 运放电路图

本目录使用 LaTeX `circuitikz` 绘制课程中的 7 幅运放电路图：

| 源文件 | 网页图片 | 内容 |
|---|---|---|
| `voltage-follower.tex` | `voltage-follower.png` | 电压跟随器 |
| `inverting.tex` | `inverting.png` | 反相放大 |
| `non-inverting.tex` | `non-inverting.png` | 同相放大 |
| `summing.tex` | `summing.png` | 反相加法 |
| `differential.tex` | `differential.png` | 差分放大 |
| `integrator.tex` | `integrator.png` | 积分器 |
| `differentiator.tex` | `differentiator.png` | 微分器 |

`exercises/` 还保存两节课 10 道需要图示的习题电路和波形。

## 统一约定

- 使用欧洲矩形电阻，接近中文模电教材习惯。
- 变量与课程正文统一为 \(R_1,R_2,R_3,R_f,R,C\)。
- 独立页面宽度为 `standalone` 自动裁切。
- 输出 PDF 后以 300 dpi PNG 嵌入网页。

## 重建

在 PowerShell 中运行：

```powershell
.\build.ps1
```

脚本会要求环境存在 `E:\G\codex\texmf`，其中包含本机独立安装的 `pgf`、`circuitikz` 和 `standalone`。
