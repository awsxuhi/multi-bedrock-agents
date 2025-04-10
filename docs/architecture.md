# 多 Bedrock 代理架构设计

## 架构概述

本项目实现了一个基于 AWS Bedrock 的多代理协作系统，包括一个监督代理（Supervisor Agent）和多个专业子代理。第一个实现的子代理是 Portfolio Creator Agent，专注于投资组合创建和公司研究。

![架构图](../assets/architecture.png)

_注：上图是架构的概念图，实际实现可能有所不同_

## 核心组件

### 1. 监督代理（Supervisor Agent）

- **角色**：负责理解用户请求并路由到适当的子代理
- **模式**：使用 SUPERVISOR_ROUTER 模式
- **基础模型**：Claude 3 Haiku
- **主要功能**：
  - 分析用户请求
  - 选择合适的子代理处理请求
  - 协调多个子代理的工作
  - 整合子代理的响应

### 2. Portfolio Creator Agent

- **角色**：专注于投资组合创建和公司研究
- **基础模型**：Claude 3 Haiku
- **组件**：
  - **Knowledge Base**：使用 OpenSearch Serverless 作为存储，S3 作为数据源
  - **Action Group**：提供 companyResearch、createPortfolio 和 sendEmail API
- **主要功能**：
  - 分析公司数据
  - 创建投资组合
  - 发送报告

### 3. 知识库（Knowledge Base）

- **存储**：OpenSearch Serverless
- **数据源**：Amazon S3
- **嵌入模型**：Amazon Titan Text Embeddings v2
- **索引配置**：
  - vectorIndexName: "bedrock-kb-index"
  - fieldMapping:
    - textField: "text"
    - vectorField: "vector"
    - metadataField: "metadata"

### 4. 操作组（Action Group）

- **实现**：AWS Lambda 函数
- **API**：
  - companyResearch
  - createPortfolio
  - sendEmail
- **运行时**：Python 3.12

## 技术栈

- **基础设施即代码**：AWS CDK (TypeScript)
- **部署**：CloudFormation
- **AI 服务**：Amazon Bedrock
- **存储**：OpenSearch Serverless, Amazon S3
- **计算**：AWS Lambda
- **前端**：Streamlit (通过 bedrock-agent-streamlit-ui 项目集成)

## 设计原则

1. **模块化**：每个组件都设计为可重用的构造
2. **可扩展性**：易于添加新的子代理和功能
3. **权限分离**：基础权限和特定权限分离，便于管理
4. **配置驱动**：通过配置文件管理模型和其他设置

## 集成点

1. **Streamlit 前端**：通过 bedrock-agent-streamlit-ui 项目集成
2. **数据源**：S3 存储桶用于存储公司文档和 FOMC 报告
3. **OpenSearch Serverless**：用于向量存储和检索
