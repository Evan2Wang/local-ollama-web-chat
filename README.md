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
3. 启动 Ollama，并确保本地模型已安装，例如：

```powershell
ollama pull qwen3.6:35b
ollama serve
```

Ollama 默认地址是 `http://localhost:11434`。

## 没有 Ollama 时的 Mock 测试模式

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

## 配置

复制 `.env.example` 为 `.env`，按需修改：

```powershell
Copy-Item .env.example .env
```

常用配置：

```env
LOCAL_CHAT_OLLAMA_BASE_URL=http://localhost:11434
LOCAL_CHAT_DEFAULT_MODEL=qwen3.6:35b
LOCAL_CHAT_MAX_FILE_CHARS=30000
```

如果你有视觉模型，把模型名关键字加入：

```env
LOCAL_CHAT_VISION_MODEL_KEYWORDS=llava,qwen-vl,qwen2-vl,minicpm-v
```

## 启动后端

双击 `start_backend.bat`，或手动执行：

```powershell
cd D:\local-ollama-web-chat\backend
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

## 启动前端

双击 `start_frontend.bat`，或手动执行：

```powershell
cd D:\local-ollama-web-chat\frontend
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173
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
