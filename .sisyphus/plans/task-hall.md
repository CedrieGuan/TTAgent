# 任务大厅（Task Hall）功能实现

## TL;DR

> **Quick Summary**: 实现完整的"任务大厅"功能，包括类型定义、主进程 TaskManager（CRUD + electron-store 持久化）、IPC 通信、本地工具 `local_create_task`（AI 自动创建任务）、Preload 桥接、Zustand 状态管理、以及完整的 React UI（统计栏、筛选器、任务卡片、子任务）。
>
> **Deliverables**:
>
> - 新增类型文件 `src/shared/types/task.types.ts`
> - 新增主进程模块 `src/main/task/task-manager.ts` + `src/main/ipc/task.handler.ts`
> - 新增本地工具 `local_create_task`
> - 新增渲染进程 store `src/renderer/src/stores/task.store.ts`
> - 完整 TasksPage UI 替换占位符
> - 修改 5 个现有文件完成集成
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (types) → Task 3 (store schema) → Task 4 (TaskManager) → Task 5 (handler) → Task 7 (local tool) → Task 10 (UI)

---

## Context

### Original Request

用户希望实现"任务大厅"功能（当前 TasksPage 只是占位符），包含完整的任务管理能力和 AI 自动创建任务支持。详细规格定义在 `plan/optimized-greeting-fiddle.md`。

### Interview Summary

**Key Discussions**:

- TaskManager 遵循 MemoryManager 单例模式，但使用 electron-store 持久化（更简单）
- 任务存储在 electron-store 的 `tasks` 字段中
- `local_create_task` 不是危险工具，无需用户确认
- 进度从子任务自动计算
- UI 包含：统计栏、双维度筛选器（状态 + 周期）、任务卡片（复选框、徽章、下拉、删除、标签、截止日期、进度条、可展开子任务）

**Research Findings**:

- MemoryManager 使用文件系统存储，但 TaskManager 使用 electron-store 直接存储（类似 sessions）
- IPC 遵循 `resource:action` 命名规范
- Zustand stores 统一使用 immer 中间件
- UI 使用 Tailwind CSS v4 + CSS 变量主题
- 现有页面遵循一致的布局模式（flex column, max-w-2xl 居中）

### Metis Review

**Identified Gaps** (addressed):

- 手动创建任务 UX 未定义 → 已添加简单的 "+" 按钮和内联创建表单
- status/progress 冲突规则未定义 → 已明确优先级规则
- 统计栏计算公式未定义 → 已定义为 (已完成任务数 / 总任务数) × 100%
- 默认排序未定义 → 已定义为 createdAt 降序（最新优先）
- AI 自动创建触发策略未定义 → 已限定为明确请求
- 验收标准为纯手动 → 已补充 IPC 层自动化验证

---

## Work Objectives

### Core Objective

为 TTAgent 实现"任务大厅"功能，让用户可以管理任务（创建、状态切换、子任务进度跟踪、删除），并支持 AI 在聊天时通过 `local_create_task` 工具自动创建任务。

### Concrete Deliverables

- `src/shared/types/task.types.ts` — Task、SubTask、TaskEvent 类型定义
- `src/shared/constants/ipc.channels.ts` — 新增 5 个 TASK\_\* IPC 频道
- `src/main/store.ts` — StoreSchema 新增 `tasks: Task[]` 字段
- `src/main/task/task-manager.ts` — 单例 TaskManager，封装 CRUD
- `src/main/ipc/task.handler.ts` — TASK\_\* IPC handler + TASK_EVENT 广播
- `src/main/ipc/index.ts` — 注册 registerTaskHandlers()
- `src/main/tools/local-tools.ts` — 新增 `local_create_task` 工具
- `src/preload/index.ts` — window.api 新增 task 方法 + onTaskEvent 监听
- `src/renderer/src/stores/task.store.ts` — Zustand store（筛选 + CRUD）
- `src/renderer/src/pages/TasksPage.tsx` — 完整 UI
- `src/renderer/src/App.tsx` — 初始化 task store + TASK_EVENT 监听

### Definition of Done

- [ ] `npm run typecheck` 通过（零错误）
- [ ] 任务大厅页面展示空状态提示
- [ ] 可以通过 "+" 按钮手动创建任务
- [ ] 状态筛选器和周期筛选器正常过滤
- [ ] 任务状态切换（pending → in-progress → completed → cancelled）正常
- [ ] 子任务添加、勾选、进度自动重算正常
- [ ] 任务删除正常
- [ ] AI 聊天触发 `local_create_task` 后任务实时出现在任务大厅
- [ ] 任务事件无需刷新页面即实时更新

### Must Have

- Task/SubTask/TaskEvent 类型定义
- electron-store 持久化（tasks 字段）
- TaskManager 单例 CRUD（listTasks、createTask、updateTask、deleteTask）
- IPC handler 注册 + TASK_EVENT 广播（BrowserWindow.getAllWindows）
- `local_create_task` 本地工具（非危险工具）
- Preload 桥接方法
- Zustand store 含筛选状态（status、period）+ filteredTasks 计算属性
- 完整 TasksPage UI：统计栏、双维度筛选、任务卡片、子任务展开
- App.tsx 初始化 + 事件监听
- 进度自动计算（有子任务时从子任务完成比例计算）
- 手动创建任务入口（"+" 按钮和简单内联表单）

### Must NOT Have (Guardrails)

- **不添加** `local_update_task` / `local_delete_task` 等 AI 工具
- **不实现** 任务搜索、拖拽排序、分组显示
- **不实现** 周期性任务、提醒、通知、日历集成
- **不实现** 嵌套子任务（子任务下不能再有子任务）
- **不持久化** 筛选器选择和展开状态
- **不修改** 系统提示或 AI 工具描述之外的 prompt engineering
- **不提取** TasksPage 中的组件到独立文件（保持在单文件内）
- **不修改** 除已列出之外的任何文件
- **不实现** 标题内联编辑、描述编辑、优先级/周期/标签编辑（后续迭代）
- **不实现** 逾期筛选器
- **不实现** 子任务删除或重命名（仅支持添加和切换完成状态）

---

## Behavioral Rules (Status/Progress/Sort)

### Status/Progress Precedence

1. **主任务复选框点击**：
   - 从 `pending`/`in-progress`/`cancelled` → 设为 `completed`，自动将所有子任务标记为 completed，progress 设为 100
   - 从 `completed` → 设为 `pending`，子任务状态保持不变，progress 从子任务重新计算
2. **子任务勾选**：切换 `subtask.completed`，自动重算 `progress = Math.round(completedSubtasks / totalSubtasks * 100)`
3. **无子任务时**：progress 保持为 0（手动设置不在本次范围）
4. **status 下拉**：用户可通过下拉菜单手动设置任意状态（pending/in-progress/completed/cancelled），不影响子任务完成状态

### Stats Bar Formula

`完成度 = Math.round(completedTasksCount / totalTasksCount * 100)` + 文字 "已完成 X / 共 Y"

### Default Sort Order

`createdAt` 降序（最新任务在顶部）

### AI Auto-Create Trigger Policy

仅当 AI 判断用户明确要求创建/记录任务时才调用 `local_create_task`。工具描述中明确指定触发条件，避免从闲聊中误触发。

### Period vs DueDate

`period`（短期/长期）是用户/AI 手动设置的标签，不从 `dueDate` 自动推导。

### Validation Rules

- `title`: 必填，去除首尾空格后不能为空
- `tags`: 去重、去除空标签
- `dueDate`: 接受 ISO 日期字符串，无效值忽略（不设 dueDate）
- `priority`: 默认 `normal`
- `period`: 默认 `short`

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: NO
- **User wants tests**: NO (manual verification via typecheck + dev run)
- **Framework**: none
- **QA approach**: Manual verification with IPC-level automated checks

### Automated Verification (Type Check Gate)

Every task must pass:

```bash
npm run typecheck  # Expected: exit code 0
```

### IPC-Level Verification (Agent-Executable via Dev Console)

After `npm run dev`, the agent can verify core behavior through the renderer devtools console:

```javascript
// 1. Empty state
const r1 = await window.api.listTasks()
console.assert(r1.success === true, 'listTasks should succeed')
console.assert(Array.isArray(r1.data) && r1.data.length === 0, 'should start empty')

// 2. Create task
const r2 = await window.api.createTask({
  title: 'Test Task',
  priority: 'normal',
  period: 'short',
  tags: ['test']
})
console.assert(r2.success === true, 'createTask should succeed')
const taskId = r2.data.id
console.assert(taskId, 'should return task id')
console.assert(r2.data.status === 'pending', 'default status should be pending')
console.assert(r2.data.progress === 0, 'default progress should be 0')

// 3. Update task with subtasks
const r3 = await window.api.updateTask({
  id: taskId,
  subtasks: [
    { id: 'sub-1', title: 'Sub 1', completed: true, createdAt: Date.now() },
    { id: 'sub-2', title: 'Sub 2', completed: false, createdAt: Date.now() }
  ]
})
console.assert(r3.success === true, 'updateTask should succeed')
console.assert(r3.data.progress === 50, 'progress should be 50%')

// 4. Delete task
const r4 = await window.api.deleteTask(taskId)
console.assert(r4.success === true, 'deleteTask should succeed')
const r5 = await window.api.listTasks()
console.assert(r5.data.length === 0, 'task should be deleted')
```

---

## Execution Strategy

### Task Dependency Graph

| Task                | Depends On    | Reason                                                |
| ------------------- | ------------- | ----------------------------------------------------- |
| 1. task.types.ts    | None          | Foundation type definitions needed by all other tasks |
| 2. ipc.channels.ts  | None          | Channel constants, no type dependency                 |
| 3. store.ts         | 1 (Task type) | StoreSchema references Task type                      |
| 4. task-manager.ts  | 1, 3          | Uses Task type and store for persistence              |
| 5. task.handler.ts  | 1, 2, 4       | Uses channels, Task types, and TaskManager            |
| 6. ipc/index.ts     | 5             | Imports registerTaskHandlers                          |
| 7. local-tools.ts   | 1, 4          | Uses Task type and TaskManager for tool execution     |
| 8. preload/index.ts | 1, 2          | Uses types and channel constants                      |
| 9. task.store.ts    | 1, 8          | Uses Task type and window.api methods                 |
| 10. TasksPage.tsx   | 1, 9          | Uses Task types and task store                        |
| 11. App.tsx         | 9, 10         | Initializes store, page already imported              |

### Parallel Execution Graph

```
Wave 1 (Start immediately - no dependencies):
├── Task 1: Create task.types.ts (types foundation)
└── Task 2: Modify ipc.channels.ts (channel constants)

Wave 2 (After Wave 1):
├── Task 3: Modify store.ts (depends: Task 1)
├── Task 8: Modify preload/index.ts (depends: Task 1, 2)
└── [Task 4 needs Task 3, so Wave 2.5]

Wave 3 (After Wave 2):
├── Task 4: Create task-manager.ts (depends: Task 1, 3)
└── Task 9: Create task.store.ts (depends: Task 1, 8)

Wave 4 (After Wave 3):
├── Task 5: Create task.handler.ts (depends: Task 1, 2, 4)
├── Task 7: Modify local-tools.ts (depends: Task 1, 4)
└── Task 10: Modify TasksPage.tsx (depends: Task 1, 9)

Wave 5 (After Wave 4):
├── Task 6: Modify ipc/index.ts (depends: Task 5)
└── Task 11: Modify App.tsx (depends: Task 9, 10)

Critical Path: Task 1 → Task 3 → Task 4 → Task 5 → Task 6
Parallel Speedup: ~45% faster than sequential (11 tasks in 5 waves vs 11 sequential)
```

### Agent Dispatch Summary

| Wave | Tasks    | Recommended Agents                                                                                           |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | 1, 2     | 2x `delegate_task(category="quick", ...)`                                                                    |
| 2    | 3, 8     | 2x `delegate_task(category="quick", ...)`                                                                    |
| 3    | 4, 9     | 2x `delegate_task(category="unspecified-low", ...)`                                                          |
| 4    | 5, 7, 10 | 2x `delegate_task(category="unspecified-low", ...)` + 1x `delegate_task(category="visual-engineering", ...)` |
| 5    | 6, 11    | 2x `delegate_task(category="quick", ...)`                                                                    |

---

## TODOs

- [ ] 1. 创建 Task 类型定义文件

  **What to do**:
  - 创建 `src/shared/types/task.types.ts`
  - 定义 `TaskPriority` (`'urgent' | 'normal' | 'low'`)
  - 定义 `TaskPeriod` (`'short' | 'long'`)
  - 定义 `TaskStatus` (`'pending' | 'in-progress' | 'completed' | 'cancelled'`)
  - 定义 `SubTask` 接口（id, title, completed, createdAt）
  - 定义 `Task` 接口（id, title, description?, priority, period, status, tags, subtasks, progress, dueDate?, createdAt, updatedAt）
  - 定义 `TaskEvent` 接口（type: 'created'|'updated'|'deleted', task?, taskId?）
  - 定义 `CreateTaskPayload` 接口（title 必填，其余可选）
  - 定义 `UpdateTaskPayload` 接口（id 必填 + 部分更新字段）
  - 添加中文注释说明每个类型/字段的用途

  **Must NOT do**:
  - 不添加嵌套子任务类型
  - 不添加 TaskFilter 类型（放在 renderer store 中）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单文件类型定义，结构清晰明确
  - **Skills**: []
    - 纯类型定义，无需特殊技能
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 不涉及 UI
    - `git-master`: 不涉及 git

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 7, 8, 9, 10
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/shared/types/memory.types.ts` — 类型定义风格和注释规范参考（中文注释、interface 导出、type alias 使用）

  **API/Type References**:
  - `src/shared/types/session.types.ts` — Session 接口的字段命名风格参考（id, createdAt, updatedAt）
  - `src/shared/types/mcp.types.ts` — MCPTool 类型中 inputSchema 的格式参考

  **WHY Each Reference Matters**:
  - `memory.types.ts`: 展示了项目中类型定义的标准模式（注释风格、export 方式、interface vs type 的使用时机）
  - `session.types.ts`: 展示了数据模型的 id/createdAt/updatedAt 命名约定
  - `mcp.types.ts`: 如果 local_create_task 的 inputSchema 需要复用 MCPTool 类型

  **Acceptance Criteria**:
  - [ ] 文件 `src/shared/types/task.types.ts` 存在
  - [ ] 包含所有指定类型：TaskPriority, TaskPeriod, TaskStatus, SubTask, Task, TaskEvent, CreateTaskPayload, UpdateTaskPayload
  - [ ] Task 接口包含所有必要字段
  - [ ] 中文注释完整
  - [ ] `npm run typecheck` 通过

  **Evidence to Capture**:
  - [ ] typecheck 输出

  **Commit**: YES (groups with Task 2)
  - Message: `feat(task): add task types and IPC channels`
  - Files: `src/shared/types/task.types.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 2. 新增 TASK\_\* IPC 频道常量

  **What to do**:
  - 修改 `src/shared/constants/ipc.channels.ts`
  - 在 IPC_CHANNELS 对象中新增任务相关频道，添加在"长期记忆"区块之后：
    ```
    // 任务管理
    TASK_LIST: 'task:list',
    TASK_CREATE: 'task:create',
    TASK_UPDATE: 'task:update',
    TASK_DELETE: 'task:delete',
    TASK_EVENT: 'task:event',
    ```
  - 保持文件现有格式和注释风格

  **Must NOT do**:
  - 不修改现有频道定义
  - 不添加批量操作频道

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 在现有文件中添加几行常量定义
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/shared/constants/ipc.channels.ts:42-48` — 现有记忆频道定义模式，任务频道应紧跟其后

  **WHY Each Reference Matters**:
  - 现有文件的格式和分组方式必须保持一致

  **Acceptance Criteria**:
  - [ ] IPC_CHANNELS 包含 TASK_LIST, TASK_CREATE, TASK_UPDATE, TASK_DELETE, TASK_EVENT
  - [ ] 频道值遵循 `task:action` 格式
  - [ ] 中文注释说明新增区块
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (groups with Task 1)
  - Message: `feat(task): add task types and IPC channels`
  - Files: `src/shared/constants/ipc.channels.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 3. 扩展 electron-store Schema 添加 tasks 字段

  **What to do**:
  - 修改 `src/main/store.ts`
  - 在 import 区域添加：`import type { Task } from '@shared/types/task.types'`
  - 在 StoreSchema interface 中添加：`tasks: Task[]`
  - 在 defaults 中添加：`tasks: []`
  - 将 tasks 字段添加在 memoryWorkspacePath 之后

  **Must NOT do**:
  - 不修改现有字段定义
  - 不删除或重命名现有字段

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 在现有 interface 和 defaults 中各添加一行
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 8)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/main/store.ts:20-30` — StoreSchema interface 定义模式，新字段添加位置
  - `src/main/store.ts:32-58` — defaults 对象，tasks: [] 应添加在 memoryWorkspacePath 之后

  **API/Type References**:
  - `src/shared/types/task.types.ts:Task` — 新增字段的类型引用

  **WHY Each Reference Matters**:
  - 需要确保 StoreSchema 和 defaults 的结构保持一致

  **Acceptance Criteria**:
  - [ ] StoreSchema interface 包含 `tasks: Task[]`
  - [ ] defaults 包含 `tasks: []`
  - [ ] import 语句正确引用 Task 类型
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): add tasks field to store schema`
  - Files: `src/main/store.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 4. 创建 TaskManager 单例模块

  **What to do**:
  - 创建目录 `src/main/task/`（如果不存在）
  - 创建 `src/main/task/task-manager.ts`
  - 实现 `TaskManager` 类（参考 MemoryManager 的导出模式，但持久化方式不同）：
    - 构造函数：无参数，从 store 读取数据
    - `listTasks(): Task[]` — 从 store 获取所有任务，按 createdAt 降序排列
    - `createTask(payload: CreateTaskPayload): Task` — 生成 id（使用 crypto.randomUUID()），设置默认值（status: 'pending', progress: 0, tags: [], subtasks: []），写入 store，返回新 Task
    - `updateTask(payload: UpdateTaskPayload): Task | null` — 按 id 查找任务，合并更新字段，自动重算 progress（有子任务时），更新 updatedAt，写入 store
    - `deleteTask(id: string): boolean` — 按 id 删除任务，返回是否成功
    - `recalculateProgress(task: Task): number` — 私有方法，有子任务时计算 `Math.round(completedSubtasks / totalSubtasks * 100)`，无子任务返回 task.progress（不变）
  - 导出单例 `export const taskManager = new TaskManager()`
  - 添加中文注释

  **Must NOT do**:
  - 不使用文件系统存储（使用 electron-store）
  - 不实现批量操作
  - 不实现搜索/排序方法

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 需要理解 store 读写模式和 progress 计算逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 9)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `src/main/memory/memory-manager.ts:27-363` — 单例类模式参考（constructor、单例导出）
  - `src/main/store.ts` — store.get/store.set 的使用方式
  - `src/main/ipc/session.handler.ts:14-16` — generateId 函数（但 TaskManager 使用 crypto.randomUUID()）

  **API/Type References**:
  - `src/shared/types/task.types.ts:Task` — Task 接口定义
  - `src/shared/types/task.types.ts:CreateTaskPayload` — 创建载荷类型
  - `src/shared/types/task.types.ts:UpdateTaskPayload` — 更新载荷类型

  **Documentation References**:
  - plan/optimized-greeting-fiddle.md:92-96 — TaskManager 设计规格

  **WHY Each Reference Matters**:
  - `memory-manager.ts`: 展示了 TaskManager 应遵循的类结构和单例导出模式
  - `session.handler.ts`: 展示了 store.get/set 的 CRUD 模式（读取→修改→写回）
  - `store.ts`: 展示了 store 的类型化访问方式

  **Acceptance Criteria**:
  - [ ] 文件 `src/main/task/task-manager.ts` 存在
  - [ ] TaskManager 类包含 listTasks, createTask, updateTask, deleteTask 方法
  - [ ] createTask 生成 UUID、设置默认值、写入 store
  - [ ] updateTask 正确合并部分更新、自动重算 progress
  - [ ] recalculateProgress 正确计算子任务完成比例
  - [ ] 导出 taskManager 单例
  - [ ] `npm run typecheck` 通过

  **Evidence to Capture**:
  - [ ] typecheck 输出

  **Commit**: YES (groups with Task 5)
  - Message: `feat(task): add TaskManager and IPC handler`
  - Files: `src/main/task/task-manager.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 5. 创建任务 IPC Handler

  **What to do**:
  - 创建 `src/main/ipc/task.handler.ts`
  - 导出 `registerTaskHandlers()` 函数
  - 注册 4 个 `ipcMain.handle` 处理器（参考 memory.handler.ts 模式）：
    - `TASK_LIST` → 调用 `taskManager.listTasks()`，返回 `IPCResponse<Task[]>`
    - `TASK_CREATE` → 接收 `CreateTaskPayload`，调用 `taskManager.createTask()`，创建后广播 `TASK_EVENT({ type: 'created', task })`，返回 `IPCResponse<Task>`
    - `TASK_UPDATE` → 接收 `UpdateTaskPayload`，调用 `taskManager.updateTask()`，更新后广播 `TASK_EVENT({ type: 'updated', task })`，返回 `IPCResponse<Task>`
    - `TASK_DELETE` → 接收 id 字符串，调用 `taskManager.deleteTask()`，删除后广播 `TASK_EVENT({ type: 'deleted', taskId })`，返回 `IPCResponse`
  - TASK_EVENT 广播使用 `BrowserWindow.getAllWindows().forEach(win => win.webContents.send(...))`
  - 所有处理器统一使用 try/catch 返回 `IPCResponse`
  - 添加中文注释

  **Must NOT do**:
  - 不使用 sender.send（使用 getAllWindows 广播以确保所有窗口收到）
  - 不添加批量操作 handler

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 需要理解 IPC handler 注册模式和事件广播机制
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 7, 10)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 1, 2, 4

  **References**:

  **Pattern References**:
  - `src/main/ipc/memory.handler.ts:1-96` — 完整的 IPC handler 注册模式（ipcMain.handle、try/catch、IPCResponse 包装）
  - `src/main/ipc/session.handler.ts:18-102` — CRUD handler 模式（list, create, update, delete）

  **API/Type References**:
  - `src/shared/constants/ipc.channels.ts` — IPC_CHANNELS 常量
  - `src/shared/types/ipc.types.ts:IPCResponse` — 统一响应类型
  - `src/shared/types/task.types.ts:Task, CreateTaskPayload, UpdateTaskPayload, TaskEvent` — 类型定义

  **WHY Each Reference Matters**:
  - `memory.handler.ts`: 最接近的参考模式，展示了 handler 的完整结构
  - `session.handler.ts`: 展示了 CRUD 操作在 IPC handler 中的组织方式
  - `ipc.types.ts`: 确保返回值类型与项目约定一致

  **Acceptance Criteria**:
  - [ ] 文件 `src/main/ipc/task.handler.ts` 存在
  - [ ] registerTaskHandlers() 注册 4 个 ipcMain.handle
  - [ ] TASK_CREATE/UPDATE/DELETE 后通过 BrowserWindow.getAllWindows() 广播 TASK_EVENT
  - [ ] 所有 handler 返回 IPCResponse 格式
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (groups with Task 4)
  - Message: `feat(task): add TaskManager and IPC handler`
  - Files: `src/main/task/task-manager.ts`, `src/main/ipc/task.handler.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 6. 注册任务 IPC Handler

  **What to do**:
  - 修改 `src/main/ipc/index.ts`
  - 添加 import：`import { registerTaskHandlers } from './task.handler'`
  - 在 registerAllHandlers() 中添加 `registerTaskHandlers()` 调用
  - 位置：在 registerMemoryHandlers() 之后

  **Must NOT do**:
  - 不修改现有 handler 注册顺序
  - 不添加其他逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 添加两行代码（import + 调用）
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 11)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/main/ipc/index.ts:1-23` — 完整的文件内容，展示 import 和注册函数的格式

  **WHY Each Reference Matters**:
  - 必须完全匹配现有的 import 风格和注册顺序

  **Acceptance Criteria**:
  - [ ] import registerTaskHandlers 正确
  - [ ] registerTaskHandlers() 在 registerMemoryHandlers() 之后调用
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): register task IPC handlers`
  - Files: `src/main/ipc/index.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 7. 新增 local_create_task 本地工具

  **What to do**:
  - 修改 `src/main/tools/local-tools.ts`
  - 在文件顶部添加 import：`import { taskManager } from '../task/task-manager'` 和 `import type { CreateTaskPayload } from '@shared/types/task.types'`
  - 在 LOCAL_TOOLS 数组之前，添加 `createTaskDef: LocalToolDefinition` 定义：
    - tool.name: `localTool('create_task')`
    - tool.description: `'在任务大厅中创建新任务。当用户提到需要完成某件事、记录待办项、或明确要求帮忙记录任务时调用此工具。'`
    - tool.inputSchema: 包含 title（必填）、description、priority、period、tags、dueDate、subtasks 属性
    - executor.execute: 解析 args，验证 title 非空，调用 `taskManager.createTask(payload)`，返回成功消息（含任务标题）
  - 将 `createTaskDef` 添加到 `LOCAL_TOOLS` 数组中

  **inputSchema 详细定义**:

  ```typescript
  {
    type: 'object',
    properties: {
      title: { type: 'string', description: '任务标题（必填）' },
      description: { type: 'string', description: '任务描述（可选）' },
      priority: { type: 'string', enum: ['urgent', 'normal', 'low'], description: '优先级：紧急/普通/低' },
      period: { type: 'string', enum: ['short', 'long'], description: '周期：短期/长期' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      dueDate: { type: 'string', description: '截止日期（ISO 格式，可选）' },
      subtasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title']
        },
        description: '初始子任务列表（可选）'
      }
    },
    required: ['title']
  }
  ```

  **executor.execute 实现**:

  ```typescript
  async execute(args) {
    const title = (args.title as string)?.trim()
    if (!title) return 'Error: 任务标题不能为空'
    try {
      const payload: CreateTaskPayload = { title }
      if (args.description) payload.description = args.description as string
      if (args.priority && ['urgent', 'normal', 'low'].includes(args.priority as string)) {
        payload.priority = args.priority as TaskPriority
      }
      if (args.period && ['short', 'long'].includes(args.period as string)) {
        payload.period = args.period as TaskPeriod
      }
      if (Array.isArray(args.tags)) payload.tags = args.tags.filter((t): t is string => typeof t === 'string')
      if (args.dueDate) {
        const d = new Date(args.dueDate as string)
        if (!isNaN(d.getTime())) payload.dueDate = d.getTime()
      }
      if (Array.isArray(args.subtasks)) {
        payload.subtasks = args.subtasks
          .filter((s): s is { title: string } => typeof s?.title === 'string' && s.title.trim())
          .map(s => s.title.trim())
      }
      const task = taskManager.createTask(payload)
      return `已创建任务「${task.title}」(ID: ${task.id})`
    } catch (err) {
      return `创建任务失败: ${(err as Error).message}`
    }
  }
  ```

  **Must NOT do**:
  - **不将** `local_create_task` 添加到 ai.handler.ts 的 DANGEROUS_TOOLS 集合
  - 不添加 local_update_task 或 local_delete_task
  - 不修改 executorMap 的构建方式（它是从 LOCAL_TOOLS 数组自动生成的）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 需要理解现有工具定义模式和输入验证逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 5, 10)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `src/main/tools/local-tools.ts:37-77` — readFileDef 完整模式（tool 定义 + executor 实现）
  - `src/main/tools/local-tools.ts:206-211` — LOCAL_TOOLS 数组，createTaskDef 应追加在此

  **API/Type References**:
  - `src/main/tools/local-tools.ts:LocalToolDefinition` — 工具定义接口
  - `src/main/tools/local-tools.ts:localTool()` — 工具名称生成函数
  - `src/shared/types/task.types.ts:CreateTaskPayload` — 创建载荷类型

  **Critical References**:
  - `src/main/ipc/ai.handler.ts:35` — DANGEROUS_TOOLS 定义，确认 `local_create_task` **不在**此集合中

  **WHY Each Reference Matters**:
  - `readFileDef`: 展示了完整的工具定义+执行器模式，新工具必须严格遵循
  - `LOCAL_TOOLS` 数组: executorMap 自动从此数组构建，新工具必须添加到这里
  - `DANGEROUS_TOOLS`: 确认新工具不需要用户确认（这是设计决策）

  **Acceptance Criteria**:
  - [ ] local-tools.ts 包含 `local_create_task` 工具定义
  - [ ] inputSchema 包含所有指定字段，title 为 required
  - [ ] executor 正确解析参数并调用 taskManager.createTask()
  - [ ] executor 处理 title 为空的情况
  - [ ] executor 解析 dueDate 为 timestamp
  - [ ] 工具已添加到 LOCAL_TOOLS 数组
  - [ ] `local_create_task` 不在 DANGEROUS_TOOLS 中
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): add local_create_task tool`
  - Files: `src/main/tools/local-tools.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 8. 扩展 Preload API 桥接

  **What to do**:
  - 修改 `src/preload/index.ts`
  - 添加 import：`import type { Task, TaskEvent, CreateTaskPayload, UpdateTaskPayload } from '../shared/types/task.types'`
  - 在 api 对象中"长期记忆"区块之后添加"任务管理"区块：

    ```typescript
    // ── 任务管理 ──────────────────────────────────────────────────
    /** 获取所有任务列表 */
    listTasks: (): Promise<IPCResponse<Task[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST),

    /** 创建新任务 */
    createTask: (payload: CreateTaskPayload): Promise<IPCResponse<Task>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, payload),

    /** 更新任务 */
    updateTask: (payload: UpdateTaskPayload): Promise<IPCResponse<Task>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, payload),

    /** 删除任务 */
    deleteTask: (id: string): Promise<IPCResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),

    /** 注册任务事件监听，返回清理函数 */
    onTaskEvent: (callback: (event: TaskEvent) => void): (() => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: TaskEvent) => callback(event)
      ipcRenderer.on(IPC_CHANNELS.TASK_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TASK_EVENT, listener)
    },
    ```

  **Must NOT do**:
  - 不修改现有方法
  - 不添加批量操作方法

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 在现有文件中按固定模式添加方法
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 9, 10, 11
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/preload/index.ts:123-156` — 记忆管理方法区块，任务方法应紧跟其后
  - `src/preload/index.ts:152-156` — onMemoryEvent 的监听器模式（返回清理函数）

  **API/Type References**:
  - `src/shared/types/task.types.ts` — Task, TaskEvent, CreateTaskPayload, UpdateTaskPayload 类型
  - `src/shared/constants/ipc.channels.ts` — TASK\_\* 频道常量

  **WHY Each Reference Matters**:
  - `onMemoryEvent`: 展示了事件监听器注册的标准模式（ipcRenderer.on + 返回 cleanup 函数）
  - 记忆管理区块: 展示了 CRUD 方法的命名和参数风格

  **Acceptance Criteria**:
  - [ ] api 对象包含 listTasks, createTask, updateTask, deleteTask, onTaskEvent 方法
  - [ ] onTaskEvent 返回清理函数
  - [ ] 类型导入正确
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): add task API to preload bridge`
  - Files: `src/preload/index.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 9. 创建任务 Zustand Store

  **What to do**:
  - 创建 `src/renderer/src/stores/task.store.ts`
  - 使用 `create` + `immer` 中间件（与 memory.store.ts 一致）
  - State 接口包含：
    - `tasks: Task[]` — 所有任务列表
    - `loaded: boolean` — 是否已完成初始加载
    - `statusFilter: TaskStatus | 'all'` — 状态筛选器（默认 'all'）
    - `periodFilter: TaskPeriod | 'all'` — 周期筛选器（默认 'all'）
    - `expandedTasks: Set<string>` — 当前展开子任务的任务 ID 集合
  - Actions:
    - `loadTasks()` — 调用 `window.api.listTasks()` 初始化
    - `createTask(payload)` — 调用 `window.api.createTask()` 并更新本地状态
    - `updateTask(payload)` — 调用 `window.api.updateTask()` 并更新本地状态
    - `deleteTask(id)` — 调用 `window.api.deleteTask()` 并从本地状态移除
    - `setStatusFilter(filter)` — 更新状态筛选器
    - `setPeriodFilter(filter)` — 更新周期筛选器
    - `toggleTaskExpanded(id)` — 切换任务展开状态
    - `refreshTasks()` — 重新从主进程加载任务列表（事件触发时调用）
  - Computed（通过 getter 函数）:
    - `getFilteredTasks()` — 根据当前筛选器过滤任务
    - `getStats()` — 返回 `{ total, completed, progress }` 统计数据
  - 添加中文注释

  **Must NOT do**:
  - 不持久化筛选器状态到 electron-store
  - 不添加排序方法（使用默认排序 createdAt desc）
  - 不添加搜索功能

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 需要理解 Zustand + immer 模式和筛选逻辑
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: Tasks 10, 11
  - **Blocked By**: Tasks 1, 8

  **References**:

  **Pattern References**:
  - `src/renderer/src/stores/memory.store.ts:1-170` — 完整的 Zustand + immer store 模式（state interface、actions、async 调用 window.api）
  - `src/renderer/src/stores/chat.store.ts:1-217` — 更复杂的 store 参考（nested state 管理）

  **API/Type References**:
  - `src/shared/types/task.types.ts:Task, TaskStatus, TaskPeriod, CreateTaskPayload, UpdateTaskPayload` — 类型定义
  - `src/preload/index.ts` — window.api task 方法签名

  **WHY Each Reference Matters**:
  - `memory.store.ts`: 展示了项目的 Zustand store 标准模式（immer、async actions、window.api 调用）
  - `chat.store.ts`: 展示了更复杂的状态管理模式（Set 类型状态、分层数据）
  - `preload/index.ts`: 确保 store 调用 window.api 的方法名和参数类型完全匹配

  **Acceptance Criteria**:
  - [ ] 文件 `src/renderer/src/stores/task.store.ts` 存在
  - [ ] 使用 create + immer 中间件
  - [ ] 包含 tasks, loaded, statusFilter, periodFilter, expandedTasks 状态
  - [ ] loadTasks/createTask/updateTask/deleteTask 通过 window.api 调用主进程
  - [ ] getFilteredTasks 正确按 status 和 period 过滤
  - [ ] getStats 正确计算完成度
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): add task Zustand store`
  - Files: `src/renderer/src/stores/task.store.ts`
  - Pre-commit: `npm run typecheck`

---

- [ ] 10. 实现 TasksPage 完整 UI

  **What to do**:
  - 完全重写 `src/renderer/src/pages/TasksPage.tsx`（替换占位符）
  - 实现 UI 结构（遵循 Tailwind CSS v4 + CSS 变量主题风格）：

  **页面结构**:

  ```
  TasksPage
  ├── 顶部标题区
  │   ├── 标题 "任务大厅"
  │   └── "+" 创建任务按钮
  ├── 统计栏
  │   └── 完成度 X% (已完成 Y / 共 Z)
  ├── 筛选栏
  │   ├── 状态 pills: 全部 | 待办 | 进行中 | 已完成 | 已取消
  │   └── 周期 pills: 全部周期 | 短期 | 长期
  └── 任务列表（或空状态）
      └── TaskCard × N
          ├── 行 1: 圆形复选框 | 标题 | [优先级 badge] [周期 badge] | 状态下拉 | 删除按钮
          ├── 行 2: 描述文字（如有）
          ├── 行 3: 标签 pills（如有）
          ├── 行 4: 截止日期 | X/Y 子任务展开按钮 | 进度% + 进度条
          └── 展开区域（默认收起）
              └── SubTaskItem × N
                  ├── 圆形复选框 | 子任务标题
                  └── "+ 添加子任务" 输入框
  ```

  **创建任务内联表单**（点击 "+" 按钮展开）:
  - 标题输入框（必填）
  - 描述输入框（可选）
  - 优先级选择：紧急 / 普通 / 低（默认普通）
  - 周期选择：短期 / 长期（默认短期）
  - 标签输入框（逗号分隔）
  - 确认/取消按钮

  **样式要点**:
  - 使用 CSS 变量：`var(--color-text-primary)`, `var(--color-text-muted)`, `var(--color-border)`, `var(--color-bg-surface-2)`, `var(--color-bg-hover)`, `var(--color-accent)`, `var(--color-success)`
  - 优先级徽章颜色：urgent → 红色/橙色, normal → 蓝色, low → 灰色
  - 周期徽章颜色：short → 蓝色, long → 紫色
  - 进度条：completed 状态 → 绿色，其他 → 蓝色（使用 accent 色）
  - 状态下拉：使用原生 select 样式化
  - 圆形复选框：使用 SVG 或 border-radius: 50% 的 div
  - 卡片间距、圆角、边框遵循 MemoryPage 的列表项风格
  - 组件级状态（创建表单展开/收起、子任务展开/收起）使用 React.useState

  **交互实现**:
  - 主任务复选框 → 调用 `taskStore.updateTask()` 切换 status（遵循 Behavioral Rules 中的 status/progress 优先级规则）
  - 子任务复选框 → 更新 subtasks 数组，调用 `taskStore.updateTask()`
  - 状态下拉 → 调用 `taskStore.updateTask({ id, status })`
  - 删除按钮 → 确认后调用 `taskStore.deleteTask()`
  - 筛选 pill → 调用 `taskStore.setStatusFilter()` / `taskStore.setPeriodFilter()`
  - 子任务展开 → 调用 `taskStore.toggleTaskExpanded()`
  - 添加子任务 → 更新 subtasks 数组，调用 `taskStore.updateTask()`
  - 创建任务 → 调用 `taskStore.createTask()`

  **空状态**:
  - 无任务时显示图标 + "暂无任务" + "AI 会在聊天时自动创建任务，你也可以点击上方 + 手动创建"

  **页面初始化**:
  - useEffect 中检测 `loaded` 状态，未加载时调用 `loadTasks()`

  **Must NOT do**:
  - 不提取组件到独立文件（所有内容保持在 TasksPage.tsx 中）
  - 不实现标题内联编辑
  - 不实现描述/优先级/周期/标签的编辑
  - 不实现子任务删除和重命名
  - 不实现拖拽排序
  - 不使用外部 UI 库

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 需要完整的 UI 实现，包括多个交互组件和样式设计
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 需要设计任务卡片、筛选器、进度条等 UI 组件

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 5, 7)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 1, 9

  **References**:

  **Pattern References**:
  - `src/renderer/src/pages/MemoryPage.tsx:1-180` — 页面布局风格参考（max-w-2xl 居中、列表渲染、空状态、删除按钮样式）
  - `src/renderer/src/components/ui/Button.tsx` — 按钮 variant 颜色参考
  - `src/renderer/src/pages/TasksPage.tsx:1-28` — 当前占位符，将被完全替换

  **API/Type References**:
  - `src/renderer/src/stores/task.store.ts` — task store 的所有方法和状态
  - `src/shared/types/task.types.ts` — Task, SubTask, TaskStatus, TaskPriority, TaskPeriod 类型
  - `src/renderer/src/lib/utils.ts` — cn() 和 formatTime() 工具函数

  **WHY Each Reference Matters**:
  - `MemoryPage.tsx`: 展示了列表页面的完整样式模式（卡片列表、空状态、操作按钮、间距）
  - `Button.tsx`: 确保按钮样式与项目一致
  - `task.store.ts`: UI 必须调用的所有 store 方法
  - `utils.ts`: cn() 用于条件样式拼接，formatTime() 用于日期格式化

  **Acceptance Criteria**:
  - [ ] TasksPage 显示完整的任务大厅 UI（标题、统计、筛选器、任务列表）
  - [ ] 空状态正确显示
  - [ ] "+" 按钮展开创建表单
  - [ ] 创建表单包含标题（必填）、描述、优先级、周期、标签输入
  - [ ] 任务卡片正确显示所有字段（标题、描述、优先级/周期徽章、标签、截止日期、进度条）
  - [ ] 状态筛选器正常过滤
  - [ ] 周期筛选器正常过滤
  - [ ] 主任务复选框正确切换 status 并更新子任务
  - [ ] 子任务勾选正确切换并重算进度
  - [ ] 状态下拉正常工作
  - [ ] 删除按钮正常工作
  - [ ] 子任务可展开/收起
  - [ ] 可添加新子任务
  - [ ] `npm run typecheck` 通过

  **Evidence to Capture**:
  - [ ] typecheck 输出

  **Commit**: YES (standalone)
  - Message: `feat(task): implement TasksPage UI`
  - Files: `src/renderer/src/pages/TasksPage.tsx`
  - Pre-commit: `npm run typecheck`

---

- [ ] 11. 集成到 App.tsx（初始化 + 事件监听）

  **What to do**:
  - 修改 `src/renderer/src/App.tsx`
  - 添加 import：`import { useTaskStore } from '@stores/task.store'`
  - 添加 import：`import type { TaskEvent } from '@shared/types/task.types'`（如需要）
  - 在 App 组件中添加：
    ```typescript
    const { loadTasks } = useTaskStore()
    ```
  - 在 useEffect 初始化中添加 `loadTasks()` 调用
  - 添加新的 useEffect 注册 TASK_EVENT 监听：
    ```typescript
    useEffect(() => {
      const cleanup = window.api.onTaskEvent((_event: TaskEvent) => {
        // 收到任何任务事件时刷新列表
        useTaskStore.getState().refreshTasks()
      })
      return cleanup
    }, [])
    ```

  **Must NOT do**:
  - 不修改现有 import 的顺序（只追加新 import）
  - 不修改现有页面路由逻辑
  - 不修改 MainLayout 的 props

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 添加少量代码到现有文件
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 6)
  - **Blocks**: None
  - **Blocked By**: Tasks 9, 10

  **References**:

  **Pattern References**:
  - `src/renderer/src/App.tsx:27-31` — useEffect 初始化模式，loadTasks 应添加在此
  - `src/renderer/src/hooks/useStream.ts:131-142` — onMemoryEvent 监听模式参考

  **API/Type References**:
  - `src/renderer/src/stores/task.store.ts` — refreshTasks() 方法
  - `src/shared/types/task.types.ts:TaskEvent` — 事件类型

  **WHY Each Reference Matters**:
  - `App.tsx:27-31`: 展示了 store 初始化的标准位置
  - `useStream.ts:131-142`: 展示了事件监听器注册 + refresh 的标准模式

  **Acceptance Criteria**:
  - [ ] useTaskStore 已导入和使用
  - [ ] loadTasks 在初始化 useEffect 中调用
  - [ ] onTaskEvent 监听器注册正确，调用 refreshTasks()
  - [ ] useEffect 返回清理函数
  - [ ] `npm run typecheck` 通过

  **Commit**: YES (standalone)
  - Message: `feat(task): integrate task store into App`
  - Files: `src/renderer/src/App.tsx`
  - Pre-commit: `npm run typecheck`

---

## Commit Strategy

| After Task | Message                                       | Files                                                                    | Verification        |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| 1 + 2      | `feat(task): add task types and IPC channels` | `src/shared/types/task.types.ts`, `src/shared/constants/ipc.channels.ts` | `npm run typecheck` |
| 3          | `feat(task): add tasks field to store schema` | `src/main/store.ts`                                                      | `npm run typecheck` |
| 4 + 5      | `feat(task): add TaskManager and IPC handler` | `src/main/task/task-manager.ts`, `src/main/ipc/task.handler.ts`          | `npm run typecheck` |
| 6          | `feat(task): register task IPC handlers`      | `src/main/ipc/index.ts`                                                  | `npm run typecheck` |
| 7          | `feat(task): add local_create_task tool`      | `src/main/tools/local-tools.ts`                                          | `npm run typecheck` |
| 8          | `feat(task): add task API to preload bridge`  | `src/preload/index.ts`                                                   | `npm run typecheck` |
| 9          | `feat(task): add task Zustand store`          | `src/renderer/src/stores/task.store.ts`                                  | `npm run typecheck` |
| 10         | `feat(task): implement TasksPage UI`          | `src/renderer/src/pages/TasksPage.tsx`                                   | `npm run typecheck` |
| 11         | `feat(task): integrate task store into App`   | `src/renderer/src/App.tsx`                                               | `npm run typecheck` |

---

## Success Criteria

### Verification Commands

```bash
npm run typecheck  # Expected: exit code 0, no errors
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] `npm run typecheck` passes
- [ ] TasksPage shows empty state when no tasks
- [ ] Manual task creation works (+ button → fill form → task appears)
- [ ] Status filter and period filter work correctly
- [ ] Task status toggle via checkbox works (pending ↔ completed)
- [ ] Status dropdown works for all 4 statuses
- [ ] Subtask add/toggle works and progress recalculates
- [ ] Task delete works
- [ ] AI creates task via `local_create_task` → appears in Task Hall without page refresh
- [ ] Stats bar shows correct completion percentage
