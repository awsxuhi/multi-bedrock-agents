# 多 Bedrock 代理项目文档

本目录包含多 Bedrock 代理项目的文档，帮助您了解项目架构、部署和使用方法。

## 文档索引

1. [架构设计](./architecture.md) - 项目的架构设计和核心组件说明
2. [目录结构](./directory-structure.md) - 项目的目录结构和文件组织
3. [代码更改记录](./code-changes.md) - 重要代码更改的记录和说明
4. [部署指南](./deployment-guide.md) - 项目的部署步骤和最佳实践

## 项目概述

多 Bedrock 代理项目是一个基于 AWS CDK 的解决方案，用于在 AWS 平台上自动部署多个协作的 Bedrock Agent。项目的主要特点包括：

1. **模块化设计**：每个组件都设计为可重用的构造，便于扩展和维护
2. **多代理协作**：支持多个专业子代理，由监督代理协调
3. **知识库集成**：使用 OpenSearch Serverless 和 S3 存储知识库数据
4. **自动部署**：使用 AWS CDK 自动部署所有资源
5. **前端集成**：支持与 Streamlit 前端集成

## 快速开始

1. 克隆项目并安装依赖：

   ```bash
   git clone <repository-url>
   cd multi-bedrock-agents
   npm install
   ```

2. 部署项目：

   ```bash
   cdk deploy --all
   ```

3. 查看详细的[部署指南](./deployment-guide.md)获取更多信息。

## 主要组件

1. **Supervisor Agent**：负责理解用户请求并路由到适当的子代理
2. **Portfolio Creator Agent**：第一个子代理，专注于投资组合创建和公司研究
3. **Knowledge Base**：使用 OpenSearch Serverless 和 S3 存储知识库数据
4. **Action Group**：提供 API 供代理调用

## 扩展项目

要添加新的子代理，请按照以下步骤操作：

1. 在`lib/subagents/`目录下创建新的子代理目录
2. 实现必要的文件（instructions.ts, schema.ts, lambda/, permissions.ts, knowledge-base.ts, action-group.ts, agent.ts）
3. 在主堆栈中添加新的子代理，并将其 ID 添加到 Supervisor Agent 的 subAgentIds 列表中

详细说明请参考[架构设计](./architecture.md)文档。

## 故障排除

如果在部署或使用过程中遇到问题，请参考[部署指南](./deployment-guide.md)中的故障排除部分。

## 贡献

欢迎贡献代码、报告问题或提出改进建议。请遵循项目的贡献指南。

## 许可证

本项目采用[MIT 许可证](../LICENSE)。
