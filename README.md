# Cloudflare AI Image MCP

这是一个基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 的 Cloudflare Workers 服务，允许你通过 AI 助手（如 Claude Desktop）直接调用 Cloudflare Workers AI 的图像生成模型。

## 🚀 快速开始（控制台部署教程）

如果你不想使用终端命令，可以完全在 Cloudflare 浏览器控制台中完成部署：

### 1. 准备 Cloudflare 资源
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. **创建 R2 存储桶**：
   - 点击左侧菜单 "R2" -> "Create bucket"。
   - 命名为 `mcp-images`（或者你喜欢的名字，记下它）。
3. **启用 AI**：
   - 确保你的账户已启用 Workers AI（通常默认开启）。

### 2. 创建并部署 Worker
1. 进入 "Workers & Pages" -> "Create application" -> "Create Worker"。
2. 给你的 Worker 起个名字（例如 `cloudflare-ai-image-mcp`）。
3. 点击 "Deploy"。
4. 部署完成后，点击页面右上角的 **"Edit Code"** 按钮。
5. 在左侧文件列表中，找到并打开 `worker.js` (或者 `index.ts`)。
6. **删除原有内容**，将本项目 [src/index.ts](src/index.ts) 中的全部代码粘贴进去。
7. 点击右上角的 **"Deploy"** 按钮。

### 3. 配置绑定与变量（关键步骤）
回到该 Worker 的主页面，点击 **"Settings"** 选项卡：

#### A. 变量 (Variables)
1. 找到 "Environment Variables" -> "Add variable"。
2. 添加变量：
   - **Variable name**: `PASSWORD`
   - **Value**: 设置你的访问密码（用于 MCP 连接鉴权）。
   - 点击 "Save and deploy"。

#### B. 绑定 (Bindings)
1. 找到 "Bindings" -> "Add binding"。
2. **添加 R2 Bucket 绑定**：
   - **Service role**: 选择 `R2 Bucket`。
   - **Variable name**: 必须填写 `IMAGES`。
   - **R2 bucket**: 选择你第一步创建的存储桶。
3. **添加 AI 绑定**：
   - 点击 "Add binding" -> 选择 `AI`。
   - **Variable name**: 必须填写 `AI`。
4. 点击 "Save and deploy"。

### 4. 获取你的端点
你的端点 URL 格式通常为：
`https://项目名.用户名.workers.dev/sse`

---

## 🎨 可用模型

| 模型 ID | 描述 |
| :--- | :--- |
| `flux-1-schnell` | 极速生成，质量上乘 |
| `lucid-origin` | Leonardo 出品，照片级真实感 |
| `phoenix-1.0` | 擅长渲染图像中的文字 |
| `stable-diffusion-xl-base-1.0` | 经典的 SDXL 高清生成 |
| `stable-diffusion-xl-lightning` | 1-4 步极速出图 |

## 🛠️ 在 Claude Desktop 中配置

打开你的 Claude Desktop 配置文件，添加以下内容：

```json
{
  "mcpServers": {
    "cloudflare-ai-image": {
      "command": "curl",
      "args": [
        "-N",
        "-H", "Authorization: Bearer 你的密码",
        "https://你的项目名.你的用户名.workers.dev/sse"
      ]
    }
  }
}
```

## 📄 开源协议
Apache-2.0
