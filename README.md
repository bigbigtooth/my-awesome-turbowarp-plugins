# my-awesome-turbowarp-plugins

TurboWarp 自定义扩展插件合集。

## 插件列表

### 摄像头截图 (Camera Capture)

从 TurboWarp 摄像头中捕获当前帧并保存为 PNG 图片。

#### 功能

- **捕获当前帧** — 从视频设备抓取当前画面
- **保存帧为 [文件名]** — 将捕获的画面下载为 PNG 文件（默认文件名 `capture.png`）

#### 使用方法

1. 打开 [TurboWarp](https://turbowarp.org/)
2. 确保项目中已启用摄像头（使用 Scratch 内置的「侦测」类别中的视频相关积木）
3. 加载自定义扩展，粘贴 `camera_capture.js` 的 URL 或内容
4. 在积木面板中找到「摄像头截图」类别，使用对应积木

#### 使用流程

```
先执行「捕获当前帧」→ 再执行「保存帧为 capture.png」
```

> 注意：必须先捕获帧，再保存。保存前请确保 TurboWarp 的视频设备已开启。

### 百炼大模型 (DashScope AI)

调用阿里百炼大模型 API（通义千问），在 TurboWarp 中集成 AI 对话能力。

#### 积木

| 积木 | 类型 | 说明 |
|------|------|------|
| 使用 API Key [KEY] 向模型 [MODEL] 提问 [QUESTION] | 指令 | 发送问题到百炼 API，异步请求 |
| 当收到大模型回复时 | 事件 | API 返回结果时触发 |
| 大模型的回答 | 报告 | 获取最近一次大模型的回答内容 |

#### 使用方法

1. 在 [阿里云百炼平台](https://bailian.console.aliyun.com/) 获取 API Key
2. 加载扩展，在提问积木中直接传入 API Key、模型名和问题

#### 使用流程

```
当 🟢 收到大模型回复时
  说（大模型的回答）

使用 API Key [sk-xxx] 向模型 [qwen-plus] 提问 [你是谁？]
```

> 注意：扩展需要以非沙箱模式运行。API Key 仅在本地浏览器中使用，不会发送到第三方。

## 如何在 TurboWarp 中加载自定义扩展

1. 将 `.js` 文件托管到可公开访问的 URL（如 GitHub Pages、jsDelivr 等）
2. 在 TurboWarp 编辑器中，点击左下角「添加扩展」
3. 选择「自定义扩展」，输入文件 URL 并确认加载

也可以直接将文件内容复制到 TurboWarp 的自定义扩展加载器中。

## 许可证

MIT
