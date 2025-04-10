# 项目目录结构

本文档描述了 multi-bedrock-agents 项目的主要目录结构和文件组织。

## 顶层目录

```
multi-bedrock-agents/
├── bin/                  # CDK应用程序入口点
├── docs/                 # 项目文档
├── lib/                  # 主要代码目录
│   ├── common/           # 通用组件和工具
│   ├── subagents/        # 子代理实现
│   └── supervisor-agent/ # 监督代理实现
├── test/                 # 测试代码
├── cdk.json              # CDK配置
├── package.json          # 项目依赖
└── tsconfig.json         # TypeScript配置
```

## 详细结构

### bin 目录

包含 CDK 应用程序的入口点。

```
bin/
└── multi-bedrock-agents.ts  # 主入口点，定义CDK应用程序和堆栈
```

### lib 目录

包含项目的主要代码。

#### common 目录

包含可重用的通用组件和工具。

```
common/
├── constructs/              # 可重用的CDK构造
│   ├── action-group.ts      # Action Group构造
│   ├── bedrock-agent.ts     # Bedrock Agent构造
│   ├── knowledge-base.ts    # Knowledge Base构造
│   └── lambda-function.ts   # Lambda函数构造
├── models/
│   └── model-registry.ts    # LLM模型注册表
└── permissions/
    └── base-permissions.ts  # 基础IAM权限
```

#### subagents 目录

包含各个子代理的实现。

```
subagents/
└── portfolio-creator/       # Portfolio Creator子代理
    ├── action-group.ts      # 操作组定义
    ├── agent.ts             # 代理定义
    ├── index.ts             # 导出
    ├── instructions.ts      # 代理指令
    ├── knowledge-base.ts    # 知识库配置
    ├── permissions.ts       # IAM权限
    ├── schema.ts            # API模式定义
    └── lambda/              # Lambda函数实现
        ├── index.py         # 主入口点
        └── requirements.txt # Python依赖
```

#### supervisor-agent 目录

包含监督代理的实现。

```
supervisor-agent/
├── agent.ts                 # 监督代理定义
├── index.ts                 # 导出
├── instructions.ts          # 代理指令
└── permissions.ts           # IAM权限
```

### docs 目录

包含项目文档。

```
docs/
├── architecture.md          # 架构设计文档
├── code-changes.md          # 代码更改记录
├── deployment-guide.md      # 部署指南
└── directory-structure.md   # 目录结构文档
```

## 关键文件说明

### CDK 应用程序和堆栈

- **bin/multi-bedrock-agents.ts**: CDK 应用程序入口点，创建应用程序和堆栈实例
- **lib/multi-bedrock-agents-stack.ts**: 主堆栈定义，组合所有资源

### 通用构造

- **lib/common/constructs/bedrock-agent.ts**: 定义 Bedrock Agent 构造，支持不同的代理模式
- **lib/common/constructs/knowledge-base.ts**: 定义 Knowledge Base 构造，支持不同的存储配置
- **lib/common/constructs/action-group.ts**: 定义 Action Group 构造，支持 Lambda 函数集成
- **lib/common/constructs/lambda-function.ts**: 定义 Lambda 函数构造，支持不同的运行时和配置

### 模型注册表

- **lib/common/models/model-registry.ts**: 定义 LLM 模型注册表，管理不同的模型配置

### 代理实现

- **lib/supervisor-agent/agent.ts**: 监督代理实现，使用 SUPERVISOR_ROUTER 模式
- **lib/subagents/portfolio-creator/agent.ts**: Portfolio Creator 代理实现
- **lib/subagents/portfolio-creator/lambda/index.py**: Portfolio Creator 代理的 Lambda 函数实现
