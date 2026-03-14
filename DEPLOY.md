# 部署指南

## 快速部署

### 1. 登录 Cloudflare

```bash
cd /root/http-4-mcp-master/cloudflare-ai-image-mcp
npx wrangler login
```

这会打开浏览器让你授权。

### 2. 部署 Worker

```bash
npm run deploy
```

或者：

```bash
npx wrangler deploy
```

### 3. 获取 URL

部署成功后，你会看到类似这样的输出：

```
Deployed cloudflare-ai-image-mcp triggers:
  https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev
```

### 4. MCP 端点

- **SSE 端点**: `https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev/sse`
- **HTTP 端点**: `https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev/mcp`

## 配置 MCP 客户端

### Claude Desktop

编辑配置文件 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 或 `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "cloudflare-images": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev/sse"
      ]
    }
  }
}
```

### Cursor

设置 → Features → MCP → Add New MCP Server:

- Name: `cloudflare-images`
- Type: `command`
- Command: 
```
npx mcp-remote https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev/sse
```

## 测试连接

部署后，可以在浏览器中访问：

```
https://cloudflare-ai-image-mcp.<your-subdomain>.workers.dev
```

应该看到欢迎信息。

## 本地开发

```bash
npm run dev
```

然后在本地测试 MCP 连接：
```
http://localhost:8787/sse
```

## 查看日志

```bash
npm run tail
```

或者：
```bash
npx wrangler tail
```

## 常见问题

### 认证失败
```bash
npx wrangler logout
npx wrangler login
```

### 部署权限问题
确保你的账户有 Workers 权限。

### AI 绑定不可用
确保你的账户已启用 Workers AI（免费账户自动包含）。

## 定价

- Workers: 每天 100,000 次请求免费
- Workers AI: 每天 100,000 次 AI 请求免费

图像生成消耗 AI 请求额度，具体取决于模型和步数。
