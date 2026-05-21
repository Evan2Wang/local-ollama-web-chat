# local-ollama-web-chat

本项目是一个本地轻量版 ChatGPT Web Chat，前端使用 React + Vite + TypeScript，后端使用 FastAPI + SQLite + SQLAlchemy，底层调用本机 Ollama API。

## 功能

- 读取本地 Ollama 模型列表
- 多轮对话和 SQLite 历史记录
- Markdown、表格、代码块渲染和复制
- `Ctrl+V` 粘贴图片/文件
- 拖拽上传图片/文件
- 支持 `txt`、`md`、`csv`、`pdf`、`docx`、`pptx`、`xlsx` 解析后参与对话
- 支持 `png`、`jpg`、`jpeg`、`webp` 图片附件；视觉模型会以 Ollama `images` 数组发送

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
MAX_FILE_CHARS=30000
```

注意：`OLLAMA_BASE_URL` 不要带 `/api`。后端会自动拼接：

```text
GET  {OLLAMA_BASE_URL}/api/tags
POST {OLLAMA_BASE_URL}/api/chat
```

如果你的模型名不是 `qwen3.6:35b-a3b`，把 `DEFAULT_MODEL` 改成你本机 `ollama list` 里显示的模型名。

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

## 使用说明

- 左侧新建/选择/删除会话。
- 右上角选择 Ollama 模型。
- 输入框中按 `Ctrl+Enter` 发送。
- 直接 `Ctrl+V` 粘贴截图或文件。
- 把 PDF、Word、PPT、Excel、CSV、Markdown、TXT 拖到页面即可上传。
- 文件过长时后端会截断，并要求模型在回答开头提示内容已截断。

## 注意

- 普通文本模型不能直接识图。只有模型名命中 `LOCAL_CHAT_VISION_MODEL_KEYWORDS` 时，后端才会把图片 Base64 放进 Ollama `images` 数组。
- 本项目是本地单用户 MVP，没有登录、云同步、向量库或复杂知识库。
