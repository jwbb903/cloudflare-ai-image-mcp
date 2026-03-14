# Cloudflare AI Image MCP Server

一个基于 Cloudflare Workers 的 MCP（Model Context Protocol）服务器，让 AI 助手（如 Claude、Cursor 等）能够通过 MCP 协议调用 Cloudflare Workers AI 的图像生成和修改模型。

## 功能

### 图像生成工具

1. **generate_image_flux** - 使用 Flux-1-Schnell 模型
   - 快速生成（4-8 步，约 3 秒）
   - 适合快速原型和测试
   - 参数：prompt, steps, seed

2. **generate_image_lucid** - 使用 Leonardo Lucid-Origin 模型
   - 照片级真实感
   - 支持高分辨率（最高 2500x2500）
   - 参数：prompt, guidance, width, height, steps, seed, negative_prompt

3. **generate_image_phoenix** - 使用 Leonardo Phoenix 模型
   - 擅长文本渲染
   - 提示一致性高
   - 参数：prompt, guidance, width, height, steps, seed, negative_prompt

### 图像修改工具

4. **modify_image_inpainting** - 使用 Stable Diffusion Inpainting
   - 修改图像特定区域
   - 需要提供原始图像和遮罩
   - 参数：prompt, image_b64, mask_b64, strength, steps, seed

5. **modify_image_img2img** - 使用 Dreamshaper-8-LCM
   - 图像到图像转换
   - 风格迁移
   - 参数：prompt, image_b64, strength, guidance, steps, seed

6. **list_available_models** - 列出所有可用模型

## 部署步骤

### 1. 安装依赖

```bash
cd cloudflare-ai-image-mcp
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 配置项目

编辑 `wrangler.jsonc`：
- 修改 `name` 为你的 Worker 名称
- 可选：设置 `ALLOWED_USERS` 环境变量限制访问用户

### 4. 部署到 Cloudflare

```bash
npm run deploy
```

部署成功后，你会得到类似这样的 URL：
```
https://cloudflare-ai-image-mcp.your-account.workers.dev
```

### 5. 获取 MCP 端点

- SSE 端点：`https://cloudflare-ai-image-mcp.your-account.workers.dev/sse`
- HTTP 端点：`https://cloudflare-ai-image-mcp.your-account.workers.dev/mcp`

## 连接 MCP 客户端

### Claude Desktop

编辑 Claude Desktop 配置文件（`claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "cloudflare-images": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://cloudflare-ai-image-mcp.your-account.workers.dev/sse"
      ]
    }
  }
}
```

### Cursor

在 Cursor 设置中添加 MCP 服务器：

```json
{
  "mcpServers": {
    "cloudflare-images": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://cloudflare-ai-image-mcp.your-account.workers.dev/sse"
      ]
    }
  }
}
```

### Cloudflare AI Playground

1. 访问 https://playground.ai.cloudflare.com/
2. 输入你的 MCP 服务器 URL：`https://cloudflare-ai-image-mcp.your-account.workers.dev/sse`
3. 点击 Connect

## 使用示例

### 生成图像

在支持的 AI 助手中，你可以说：

```
使用 flux 模型生成一只赛博朋克风格的猫的图像
```

```
用 lucid 模型创建一个未来城市的照片，分辨率 1920x1080
```

### 修改图像

```
使用 inpainting 把这个图像中的狗变成狮子
```

（需要提供图像和遮罩）

```
用 img2img 把这张照片变成油画风格
```

## 定价

Cloudflare Workers AI 免费额度：
- 每天 100,000 次 AI 请求

图像生成模型的定价（按步数计费）：
- Flux-1-Schnell: $0.000053 / 512x512 tile / step
- Leonardo 模型：按步数计费

查看最新定价：https://developers.cloudflare.com/workers-ai/pricing/

## 开发

### 本地测试

```bash
npm run dev
```

本地服务器将在 `http://localhost:8787` 启动

### 查看日志

```bash
npm run tail
```

## 模型说明

### Text-to-Image 模型

| 模型 | 速度 | 质量 | 最佳用途 |
|------|------|------|----------|
| flux-1-schnell | 非常快 | 良好 | 快速原型 |
| lucid-origin | 中等 | 非常高 | 专业照片 |
| phoenix-1.0 | 中等 | 非常高 | 含文字图像 |

### Image Modification 模型

| 模型 | 类型 | 用途 |
|------|------|------|
| stable-diffusion-v1-5-inpainting | Inpainting | 修改特定区域 |
| dreamshaper-8-lcm | Img2Img | 风格转换 |

## 故障排除

### 部署失败

确保已登录 Cloudflare：
```bash
npx wrangler login
```

### MCP 连接失败

检查：
1. Worker 是否已部署成功
2. 端点 URL 是否正确（/sse 或 /mcp）
3. 防火墙是否允许连接

### 图像生成失败

检查：
1. 账户是否有足够的 Workers AI 额度
2. 提示词是否合规（不包含违规内容）
3. 参数是否在有效范围内

## 相关资源

- [Cloudflare Workers AI 文档](https://developers.cloudflare.com/workers-ai/)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)

## License

MIT
