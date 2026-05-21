# local-ollama-web-chat

本项目是一个本地轻量版 ChatGPT Web Chat，前端使用 React + Vite + TypeScript，后端使用 FastAPI + SQLite + SQLAlchemy，底层调用本机 Ollama API。

## 功能

- 读取本地 Ollama 模型列表
- 可选本地 Token 门禁，适合局域网访问
- 多轮对话和 SQLite 历史记录
- 会话搜索，支持标题、消息内容和附件文件名
- 内置快捷提示词并支持自定义模板管理
- Markdown、表格、代码块渲染和复制
- `Ctrl+V` 粘贴图片/文件
- 拖拽上传图片/文件
- 支持 `txt`、`md`、`csv`、`pdf`、`docx`、`pptx`、`xlsx` 解析后参与对话
- 文件附件支持解析文本预览、截断信息和重新解析
- 支持 `png`、`jpg`、`jpeg`、`webp` 图片附件；视觉模型会以 Ollama `images` 数组发送
- Ollama 诊断页展示配置、模型列表和 `/api/tags`、`/api/chat` 测试结果

## 目录

```text
local-ollama-web-chat/
  backend/
    app/
  frontend/
    src/
  data/
    app.db
    uploads/
    parsed/
    logs/
  .env.example
  start_backend.bat
  start_frontend.bat
  start_mock_ollama.bat
```

## 前置条件

1. 安装 Python 3.11+。
2. 安装 Node.js 20+。
3. 如果使用真实模型，目标电脑需要安装并启动 Ollama。

## 场景 A：目标电脑已经安装 Ollama

这是正式使用方式。你需要启动 3 个东西：

1. Ollama 服务
2. 本项目后端
3. 本项目前端

### 1. 克隆项目

```powershell
git clone https://github.com/Evan2Wang/local-ollama-web-chat.git
cd local-ollama-web-chat
```

### 2. 确认 Ollama 可用

先确认 Ollama 已安装，并拉取目标模型：

```powershell
ollama pull qwen3.6:35b
```

启动 Ollama 服务：

```powershell
ollama serve
```

Ollama 默认地址是：

```text
http://127.0.0.1:11434
```

可以在浏览器或 PowerShell 里检查模型列表：

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

如果能看到模型列表，说明 Ollama 已经正常。

### 3. 配置本项目

复制 `.env.example` 为 `.env`：

```powershell
Copy-Item .env.example .env
```

默认配置已经适配本机 Ollama：

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
DEFAULT_MODEL=qwen3.6:35b-a3b
AUTH_ENABLED=true
APP_TOKEN=your-local-secret-token
MAX_FILE_CHARS=30000
```

注意：`OLLAMA_BASE_URL` 不要带 `/api`。后端会自动拼接：

```text
GET  {OLLAMA_BASE_URL}/api/tags
POST {OLLAMA_BASE_URL}/api/chat
```

如果你的模型名不是 `qwen3.6:35b-a3b`，把 `DEFAULT_MODEL` 改成你本机 `ollama list` 里显示的模型名。

`AUTH_ENABLED=true` 时，前端首次打开会要求输入 `APP_TOKEN`。Token 仅保存在当前浏览器的 `localStorage`，后续 API 请求会带 `Authorization: Bearer <token>`。本地单机调试可改为：

```env
AUTH_ENABLED=false
```

### 4. 启动后端

双击：

```text
start_backend.bat
```

或手动执行：

```powershell
cd D:\local-ollama-web-chat\backend
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

诊断接口：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health/config
Invoke-RestMethod http://127.0.0.1:8000/api/health/ollama
$headers = @{ Authorization = "Bearer your-local-secret-token" }
Invoke-RestMethod http://127.0.0.1:8000/api/health/chat -Headers $headers
```

### 5. 启动前端

双击：

```text
start_frontend.bat
```

或手动执行：

```powershell
cd D:\local-ollama-web-chat\frontend
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173
```

此时完整链路是：

```text
浏览器前端 5173 -> FastAPI 后端 8000 -> Ollama 11434 -> 本地模型
```

## 场景 B：没有 Ollama，只测试前后端

如果当前电脑没有安装 Ollama，可以先启动内置 Mock 服务完成前后端测试。Mock 服务监听同样的地址 `http://127.0.0.1:11434`，并模拟：

- `GET /api/tags`
- `POST /api/chat`
- Ollama NDJSON 流式输出

启动顺序：

```powershell
cd D:\local-ollama-web-chat
.\start_mock_ollama.bat
.\start_backend.bat
.\start_frontend.bat
```

然后打开：

```text
http://127.0.0.1:5173
```

Mock 会返回 `qwen3.6:35b` 和 `mock-vision:latest` 两个模型。选择 `mock-vision:latest` 时，可以测试图片通过 `images` 数组发送的分支；选择 `qwen3.6:35b` 时，可以测试普通文本模型无法识图的提示分支。

目标电脑上有真实 Ollama 后，关闭 Mock，启动真实 Ollama 即可，前后端代码不需要调整。

## 视觉模型配置

普通文本模型不能直接识图。只有模型名命中 `LOCAL_CHAT_VISION_MODEL_KEYWORDS` 时，后端才会把图片 Base64 放进 Ollama `images` 数组。

如果你有视觉模型，把模型名关键字加入 `.env`：

```env
VISION_MODEL_KEYWORDS=llava,qwen-vl,qwen2-vl,qwen3.5,minicpm-v
```

## 局域网访问

启动脚本会自动打印本机可用的 IPv4 地址。同一局域网内的其他设备可以用下面的形式访问：

```text
http://你的内网IP:5173
```

例如：

```text
http://192.168.1.23:5173
```

前端和后端默认监听所有网卡：

- 前端：`0.0.0.0:5173`
- 后端：`0.0.0.0:8000`
- Mock Ollama：`0.0.0.0:11434`

如果局域网设备打不开页面，请检查 Windows 防火墙是否允许 Node.js 和 Python 访问专用网络，或手动放行端口 `5173`、`8000`、`11434`。

## 功能测试

MVP 功能测试矩阵见 `docs/functional-test-plan.md`。

后端自动化功能测试：

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests -q
```

V1.1 手工验收：

1. Token 认证：保持 `AUTH_ENABLED=true` 启动后端，首次打开前端输入 `.env` 中的 `APP_TOKEN`；错误 Token 应提示失败，正确 Token 进入聊天。把 `AUTH_ENABLED=false` 后重启后端，页面应直接进入。
2. Ollama 诊断：左侧打开“Ollama 诊断”，确认地址为 `http://127.0.0.1:11434`，模型列表可见，`/api/tags` 结果为 `ok: true`；已配置默认模型时 `/api/chat` 测试应返回回复。
3. 快捷提示词：点击输入框上方模板按钮，确认文本只写入输入框且可继续编辑；在“管理”里新增、编辑、禁用、删除模板，刷新页面后自定义模板仍在。
4. 附件解析预览：上传 `txt`、`pdf` 或 Office 文件并发送消息，点击消息中的文件名，确认预览面板展示解析状态、字符数、截断标记、错误信息和解析文本；点击“重新解析”应刷新结果。
5. 会话搜索：在左侧搜索框分别输入会话标题片段、消息正文片段和附件文件名片段，点击结果后应恢复对应会话。

## 数据迁移

后端启动时会在现有 SQLite 数据库上做 V1.1 兼容迁移：只为 `attachments` 表补充解析详情字段，并创建 `prompt_templates` 表和内置模板，不会清空 `data/app.db` 中的历史会话。升级前仍建议备份 `data/app.db`。

## 使用说明

- 左侧新建/选择/删除会话。
- 右上角选择 Ollama 模型。
- 输入框中按 `Enter` 发送，按 `Shift+Enter` 换行。
- 用户消息上的重试按钮可在 Ollama 恢复后重新生成回答，不会重复保存同一条提问。
- 助手消息支持复制 Markdown 原文和富文本内容。
- 直接 `Ctrl+V` 粘贴截图或文件。
- 把 PDF、Word、PPT、Excel、CSV、Markdown、TXT 拖到页面即可上传。
- 文件过长时后端会截断，并要求模型在回答开头提示内容已截断。

## 注意

- 普通文本模型不能直接识图。只有模型名命中 `LOCAL_CHAT_VISION_MODEL_KEYWORDS` 时，后端才会把图片 Base64 放进 Ollama `images` 数组。
- 本项目仍是本地单用户工具。Token 只是一层本地访问门禁，不包含注册、用户管理、云同步、向量库或复杂知识库。
