# Ocean 项目上下文

## 项目定位

Ocean 是一个“水下垃圾识别与数据管理 MVP”。目标是打通从水下图片采集、AI 分析、垃圾身份证入库，到后台复核和治理看板展示的端到端演示链路。

核心业务流程：

1. 上传水下图片与潜点/志愿者备注。
2. 执行图像增强。
3. 执行垃圾目标检测。
4. 执行 OCR 检测与识别。
5. 对志愿者备注做语义分析。
6. 返回异步任务 `jobId`，通过轮询获取状态。
7. 生成垃圾身份证并写入 SQLite。
8. 在任务历史页查看队列、进度、失败原因。
9. 在后台核对页复核状态，在看板页查看概览。

## 技术栈

- 前端：Next.js、React、TypeScript、Tailwind CSS、shadcn 风格组件、React Query。
- 后端：FastAPI、SQLAlchemy、SQLite。
- AI 接入：ModelScope、本地 ONNX Runtime、OpenAI 兼容接口。
- 存储：本地文件目录 `storage/uploads`、`storage/enhanced`，数据库默认 `storage/ocean.db`。

## 主要目录

- `src/app`：Next.js 页面。
  - `/`：项目首页。
  - `/collect`：采集与上传页。
  - `/jobs`：任务历史页。
  - `/dashboard`：治理看板。
  - `/admin/trash`：垃圾身份证后台核对页。
  - `/plan`：项目计划提示页。
- `src/components`：前端通用组件和海洋视觉组件。
- `src/lib/project-data.ts`：导航和静态展示数据。
- `services/api/app`：FastAPI 应用。
- `services/api/app/routes`：HTTP 路由。
- `services/api/app/services`：增强、检测、OCR、语义分析、流水线、垃圾身份证存储。
- `docs/project-plan.md`：项目计划与当前约束。
- `docs/ppt-generation-brief.md`：汇报/路演 PPT 内容说明。

## 后端接口

- `GET /api/v1/health`：健康检查。
- `POST /api/v1/media/upload`：上传图片到 `storage/uploads`。
- `POST /api/v1/ai/pipeline`：创建异步 AI 流水线任务。
- `GET /api/v1/ai/pipeline/{job_id}`：查询单个任务状态与结果。
- `POST /api/v1/ai/pipeline/{job_id}/retry`：重试失败或已取消任务。
- `POST /api/v1/ai/pipeline/{job_id}/cancel`：取消排队中或执行中的任务。
- `GET /api/v1/ai/pipeline-jobs`：查询任务历史、分页、筛选与统计。
- `GET /api/v1/dashboard/overview`：获取真实看板聚合数据。
- `GET /api/v1/trash-identities`：查询垃圾身份证列表。
- `PATCH /api/v1/trash-identities/{identity_id}`：更新审核状态。

## AI 流水线入口

- 统一编排：`services/api/app/services/pipeline.py`
- 图像增强：`services/api/app/services/enhancement.py`
- 目标检测：`services/api/app/services/detection.py`
- OCR：`services/api/app/services/ocr.py`
- 语义分析：`services/api/app/services/semantic.py`
- 入库查询：`services/api/app/services/trash_identity_store.py`

当前模型配置：

- 增强：`iic/cv_nafnet_image-denoise_sidd`
- 检测：`CVHub520/damo_yolo_t`
- OCR 检测：`damo/cv_resnet18_ocr-detection-db-line-level_damo`
- OCR 识别：`iic/cv_convnextTiny_ocr-recognition-general_damo`
- 语义分析：`Qwen/Qwen3.5-397B-A17B`

## 本地启动

前端：

```bash
npm run dev
```

后端：

```bash
.venv/bin/uvicorn services.api.app.main:app --reload --app-dir .
```

依赖安装参考 `README.md`。前端 API 地址由 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 控制，默认 `http://127.0.0.1:8000`。后端配置参考 `services/api/.env.example`。

## 当前状态与约束

- 这是可运行 MVP/演示原型，不是生产级系统。
- 部分 AI 能力有真实接入结构，但依赖缺失、模型失败或 API key 不存在时会自动 fallback/mock，保证业务链路可联调。
- `CVHub520/damo_yolo_t` 基于 COCO 类别，对水下专用垃圾如渔网、绳索、塑料袋覆盖有限，当前有规则/mock 兜底。
- 看板概览已经改为基于真实垃圾身份证记录聚合。
- 数据库已使用 SQLite 持久化垃圾身份证与异步任务状态，但没有迁移系统。
- 上传接口已限制 `JPG/PNG/WebP` 和 `10 MB` 上限。
- AI 流水线已异步化，支持任务分页、保留策略、取消、重试、超时和重复提交去重。
- 任务缓存键基于图片内容哈希、潜点、备注、缓存版本和当前模型配置。
- 不要把 X-AnyLabeling 平台能力误认为本项目已经完整实现；当前项目真正集成的是单张图片检测和可配置执行后端。

## 开发注意事项

- 修改前端时保持现有 Tailwind/shadcn 风格，不要无关重构视觉系统。
- 修改后端时优先保持端到端链路不中断；模型失败应继续 fallback，而不是让接口整体失败。
- 不要随意删除 `storage` 下已有运行产物，除非用户明确要求。
- 不要提交 git commit，除非用户明确要求。
- 如果需要快速理解项目，优先读本文件、`README.md`、`docs/project-plan.md`、`services/api/app/services/pipeline.py`。
