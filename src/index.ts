import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface Env {
  AI: Ai;
  IMAGES: R2Bucket;
  PASSWORD: string;
}

function checkAuth(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization");
  const expected = `Bearer ${env.PASSWORD}`;
  
  if (!authHeader || authHeader !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

const MODEL_INFO: Record<string, {
  name: string;
  description: string;
  maxWidth: number;
  maxHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  maxSteps: number;
  defaultSteps: number;
}> = {
  "flux-1-schnell": {
    name: "Flux-1-Schnell", description: "Black Forest Labs 快速生成",
    maxWidth: 2048, maxHeight: 2048, defaultWidth: 1024, defaultHeight: 1024,
    maxSteps: 8, defaultSteps: 4,
  },
  "lucid-origin": {
    name: "Leonardo Lucid Origin", description: "Leonardo 高质量照片",
    maxWidth: 2500, maxHeight: 2500, defaultWidth: 1120, defaultHeight: 1120,
    maxSteps: 40, defaultSteps: 25,
  },
  "stable-diffusion-xl-base-1.0": {
    name: "SDXL Base 1.0", description: "标准高质量生成",
    maxWidth: 2048, maxHeight: 2048, defaultWidth: 1024, defaultHeight: 1024,
    maxSteps: 50, defaultSteps: 30,
  },
  "stable-diffusion-xl-lightning": {
    name: "SDXL Lightning", description: "极速生成 (1-4步)",
    maxWidth: 2048, maxHeight: 2048, defaultWidth: 1024, defaultHeight: 1024,
    maxSteps: 8, defaultSteps: 4,
  },
};

const IMAGE_TTL_SECONDS = 600;
const R2_DIR = "mcp-images/";
const WORKER_URL = "https://cloudflare-ai-image-mcp.jwbb903.workers.dev";

function generateKey(prompt: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 6);
  const safeName = prompt.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '_');
  return `${R2_DIR}${safeName}_${timestamp}_${random}`;
}

async function uploadToR2(env: Env, imageData: number[] | Uint8Array | string, prompt: string): Promise<string> {
  const key = generateKey(prompt) + '.jpg';
  
  let buffer: Uint8Array;
  if (typeof imageData === 'string') {
    const binary = atob(imageData);
    buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  } else if (imageData instanceof Uint8Array) {
    buffer = imageData;
  } else {
    buffer = new Uint8Array(imageData);
  }
  
  await env.IMAGES.put(key, buffer, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  
  return key;
}

async function getFromR2(env: Env, key: string): Promise<R2Object | null> {
  return await env.IMAGES.get(key);
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "cloudflare-ai-image-mcp",
    version: "1.0.0",
  });

  // 获取模型信息
  server.tool(
    "get_model_info",
    "获取模型详细信息",
    { model: z.string().optional() },
    async ({ model }) => {
      if (!model) {
        const list = Object.entries(MODEL_INFO).map(([k, v]) => 
          `- ${k}: ${v.name}\n  分辨率: ${v.defaultWidth}x${v.defaultHeight}`
        ).join('\n\n');
        return { content: [{ type: "text", text: `可用模型:\n\n${list}` }] };
      }
      const info = MODEL_INFO[model];
      if (!info) return { content: [{ type: "text", text: `未知模型: ${model}` }], isError: true };
      return { content: [{
        type: "text",
        text: `模型: ${info.name}\n\n${info.description}\n\n分辨率: ${info.defaultWidth}x${info.defaultHeight} (最大 ${info.maxWidth}x${info.maxHeight})\n步数: ${info.defaultSteps} (最大 ${info.maxSteps})`
      }]};
    }
  );

  // 列出模型
  server.tool("list_models", "列出所有模型", {}, async () => {
    const list = Object.entries(MODEL_INFO).map(([k, v]) => `**${k}**: ${v.description}`).join('\n\n');
    return { content: [{ type: "text", text: `可用模型:\n\n${list}` }]};
  });

  // 上传图片到 R2
  server.tool(
    "upload_image",
    "上传图片到 R2，返回 key（用于图片修改）",
    {
      image_url: z.string().optional().describe("图片URL，自动下载"),
      image_b64: z.string().optional().describe("图片Base64"),
    },
    async ({ image_url, image_b64 }) => {
      try {
        let imageData: number[];
        
        if (image_url) {
          const res = await fetch(image_url);
          if (!res.ok) return { content: [{ type: "text", text: `下载失败: ${res.status}` }], isError: true };
          const buffer = await res.arrayBuffer();
          imageData = Array.from(new Uint8Array(buffer));
        } else if (image_b64) {
          const binary = atob(image_b64);
          imageData = Array.from(new Uint8Array(binary.length)).map((_, i) => binary.charCodeAt(i));
        } else {
          return { content: [{ type: "text", text: "需要提供 image_url 或 image_b64" }], isError: true };
        }
        
        const key = await uploadToR2(env, imageData, "upload");
        
        return { content: [{
          type: "text",
          text: `上传成功!\n\n图片Key: ${key}\n\n访问链接: ${WORKER_URL}/i/${key}\n\n用于图片修改时填写 key 即可`
        }]};
      } catch (err: any) {
        return { content: [{ type: "text", text: `错误: ${err.message}` }], isError: true };
      }
    }
  );

  // 通用生成
  async function generateAndUpload(modelId: any, inputs: any, prompt: string, numImages: number = 1): Promise<any> {
    const keys: string[] = [];
    for (let i = 0; i < numImages; i++) {
      if (numImages > 1) inputs.seed = Math.floor(Math.random() * 1000000);
      const response: any = await env.AI.run(modelId, inputs);
      const key = await uploadToR2(env, response.image || response, `${prompt} ${i+1}`);
      keys.push(key);
    }
    const links = keys.map(k => `${WORKER_URL}/i/${k}`).join('\n');
    const msg = numImages > 1 
      ? `生成 ${keys.length} 张图片成功!\n\n${links}`
      : `生成成功!\n\n${links}`;
    return { content: [{ type: "text", text: msg }] };
  }

  // Flux
  server.tool(
    "generate_image_flux",
    "Flux-1-Schnell 快速生成图片 (请使用英文提示词)",
    { prompt: z.string(), steps: z.number().optional(), width: z.number().optional(), height: z.number().optional(), num_images: z.number().optional().default(1) },
    async ({ prompt, steps, width, height, num_images }) => {
      try {
        const info = MODEL_INFO["flux-1-schnell"];
        return generateAndUpload("@cf/black-forest-labs/flux-1-schnell", { 
          prompt, steps: steps || info.defaultSteps, width: width || info.defaultWidth, height: height || info.defaultHeight 
        }, prompt, num_images);
      } catch (err: any) {
        return { content: [{ type: "text", text: `错误: ${err.message}` }], isError: true };
      }
    }
  );

  // Lucid
  server.tool(
    "generate_image_lucid",
    "Leonardo 高质量照片 (请使用英文提示词)",
    { prompt: z.string(), negative_prompt: z.string().optional(), width: z.number().optional(), height: z.number().optional(), steps: z.number().optional(), guidance: z.number().optional(), num_images: z.number().optional().default(1) },
    async ({ prompt, negative_prompt, width, height, steps, guidance, num_images }) => {
      try {
        const info = MODEL_INFO["lucid-origin"];
        const inputs: any = { prompt, width: width || info.defaultWidth, height: height || info.defaultHeight, num_steps: steps || info.defaultSteps, guidance: guidance || 4.5 };
        if (negative_prompt) inputs.negative_prompt = negative_prompt;
        return generateAndUpload("@cf/leonardo/lucid-origin", inputs, prompt, num_images);
      } catch (err: any) {
        return { content: [{ type: "text", text: `错误: ${err.message}` }], isError: true };
      }
    }
  );

  // SDXL Base
  server.tool(
    "generate_image_sdxl_base",
    "SDXL Base 1.0 标准高清生成 (请使用英文提示词)",
    { prompt: z.string(), width: z.number().optional(), height: z.number().optional(), steps: z.number().optional() },
    async ({ prompt, width, height, steps }) => {
      try {
        const info = MODEL_INFO["stable-diffusion-xl-base-1.0"];
        return generateAndUpload("@cf/stabilityai/stable-diffusion-xl-base-1.0", { prompt, width: width || info.defaultWidth, height: height || info.defaultHeight, num_steps: steps || info.defaultSteps }, prompt, 1);
      } catch (err: any) {
        return { content: [{ type: "text", text: `错误: ${err.message}` }], isError: true };
      }
    }
  );

  // SDXL Lightning
  server.tool(
    "generate_image_sdxl_lightning",
    "SDXL Lightning 极速高清生成 (请使用英文提示词)",
    { prompt: z.string(), width: z.number().optional(), height: z.number().optional(), steps: z.number().optional() },
    async ({ prompt, width, height, steps }) => {
      try {
        const info = MODEL_INFO["stable-diffusion-xl-lightning"];
        return generateAndUpload("@cf/bytedance/stable-diffusion-xl-lightning", { prompt, width: width || info.defaultWidth, height: height || info.defaultHeight, num_steps: steps || info.defaultSteps }, prompt, 1);
      } catch (err: any) {
        return { content: [{ type: "text", text: `错误: ${err.message}` }], isError: true };
      }
    }
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // 访问 R2 图片 - 不需要鉴权
    if (url.pathname.startsWith('/i/')) {
      const key = url.pathname.slice(3);
      if (!key) return new Response("Missing key", { status: 400 });
      
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response("Image not found", { status: 404 });
      
      return new Response(obj.body, { headers: { "Content-Type": "image/jpeg" } });
    }
    
    // MCP - 需要鉴权
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      const authError = checkAuth(request, env);
      if (authError) return authError;
      
      return createMcpHandler(createServer(env))(request, env, ctx);
    }

    return new Response(`Cloudflare AI Image MCP\n\n/i/:key - 查看图片\n/mcp, /sse - MCP端点\n\n需要 Authorization: Bearer <密码>`, { status: 200 });
  },
} satisfies ExportedHandler<Env>;
