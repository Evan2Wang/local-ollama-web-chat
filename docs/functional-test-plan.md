# MVP 功能测试矩阵

## 自动化功能测试

后端自动化测试入口：

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests -q
```

| 编号 | 功能 | 覆盖点 |
| --- | --- | --- |
| API-01 | 模型列表 | `/api/models` 代理 Ollama `/api/tags`，配置默认模型缺失时回退到可用模型 |
| API-02 | Ollama 诊断 | `/api/health/ollama` 返回规范化 base URL、tags URL 和模型列表 |
| API-03 | 流式聊天 | 用户消息保存、助手流式内容返回、助手消息写入历史、首条消息生成标题 |
| API-04 | 文本附件 | Markdown/TXT 上传、解析、绑定消息、解析文本进入发给模型的上下文 |
| API-05 | 视觉附件 | 图片上传、存储、Base64 编码、视觉模型 payload 包含 Ollama `images` |
| API-06 | 损坏附件 | 损坏 PDF 上传后返回 `failed` 状态，不把接口打成 500 |
| API-07 | 附件隔离 | 一个会话不能把另一个会话的附件 ID 用于聊天 |

## 手工/浏览器功能测试

| 编号 | 场景 | 操作 | 预期 |
| --- | --- | --- | --- |
| UI-01 | 页面启动 | 打开前端 | 模型列表加载，默认模型可选择 |
| UI-02 | 文本发送 | 输入问题后按 `Enter` | 发送消息并流式展示回答 |
| UI-03 | 换行 | 输入框按 `Shift+Enter` | 输入框插入换行，不发送 |
| UI-04 | 历史恢复 | 刷新页面并点击历史会话 | 消息和附件恢复 |
| UI-05 | Markdown | 让模型输出表格和代码块 | 表格渲染，代码复制按钮可用 |
| UI-06 | 粘贴图片 | 截图后 `Ctrl+V` | 待发送区显示缩略图，发送后历史保留 |
| UI-07 | 拖拽文件 | 拖入 PDF/Markdown | 显示文件卡片，回答可基于文件 |
| UI-08 | 长消息滚动 | 打开长回答会话 | 聊天窗口可上下滚动，输入框保持在底部 |

## 真实 Ollama 冒烟测试

推荐使用本机已安装模型跑一轮：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health/ollama | ConvertTo-Json -Depth 8
Invoke-RestMethod http://127.0.0.1:8000/api/models | ConvertTo-Json -Depth 8
```

对支持图片的模型再补测：

1. 发送一条纯文本问题。
2. 上传一份 Markdown 或 PDF 并让模型回答文件内可验证事实。
3. 上传一张内容明确的图片并让模型回答颜色、文字或对象。
