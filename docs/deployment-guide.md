# 多 Bedrock 代理部署指南

本文档提供了部署多 Bedrock 代理项目的详细步骤和最佳实践。

## 前提条件

在开始部署之前，请确保满足以下条件：

1. **AWS 账户**：拥有有效的 AWS 账户，并具有创建以下资源的权限：

   - Amazon Bedrock
   - AWS Lambda
   - Amazon S3
   - OpenSearch Serverless
   - IAM 角色和策略

2. **AWS CLI 和凭证**：已配置 AWS CLI 和有效的凭证

   ```bash
   aws configure
   ```

3. **Node.js 和 npm**：安装 Node.js (>=14.x)和 npm

   ```bash
   node --version
   npm --version
   ```

4. **AWS CDK**：安装 AWS CDK 工具包

   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

5. **启用 Bedrock 模型访问**：
   - 在 AWS 控制台中导航到 Amazon Bedrock 服务
   - 在"Model access"部分，确保已启用以下模型：
     - Claude 3 Haiku
     - Amazon Titan Text Embeddings v2

## 项目设置

1. **克隆项目**：

   ```bash
   git clone <repository-url>
   cd multi-bedrock-agents
   ```

2. **安装依赖**：

   ```bash
   npm install
   ```

3. **引导 CDK 环境**（如果是首次在此 AWS 账户/区域中使用 CDK）：
   ```bash
   cdk bootstrap
   ```

## 配置项目

### 1. 配置 OpenSearch Serverless 集合（可选）

如果您想使用现有的 OpenSearch Serverless 集合，可以在部署时提供集合名称。否则，CDK 将自动创建新的集合。

要创建自定义集合：

```bash
aws opensearchserverless create-collection \
  --name my-custom-collection \
  --type VECTORSEARCH
```

记录生成的集合 ID，稍后在部署时使用。

### 2. 配置 S3 存储桶（可选）

如果您想使用现有的 S3 存储桶作为知识库数据源，可以在部署时提供存储桶名称。否则，CDK 将自动创建新的存储桶。

### 3. 修改子代理配置（如需要）

如果需要自定义子代理的配置，可以修改`lib/subagents/portfolio-creator/knowledge-base.ts`文件：

```typescript
// 使用现有的OpenSearch Serverless集合
this.knowledgeBase = new KnowledgeBase(this, "KnowledgeBase", {
  knowledgeBaseName: "portfolio-creator-knowledge-base",
  description: "Knowledge base for company documents and FOMC reports",
  embeddingModelKey: "titan-embedding",
  collectionName: "my-custom-collection", // 使用现有集合
  vectorIndexName: "my-custom-index", // 自定义索引名称
  s3BucketName: "my-existing-bucket", // 使用现有S3存储桶
  additionalPolicies: [
    new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    }),
  ],
});
```

## 部署

### 1. 合成 CloudFormation 模板

```bash
cdk synth
```

这将生成 CloudFormation 模板，但不会部署任何资源。您可以在`cdk.out`目录中查看生成的模板。

### 2. 部署资源

```bash
cdk deploy --verbose --all --require-approval never
```

这将部署所有资源，包括：

- Supervisor Agent
- Portfolio Creator Agent
- Knowledge Base
- OpenSearch Serverless 集合（如果未提供现有集合）
- S3 存储桶（如果未提供现有存储桶）
- Lambda 函数
- IAM 角色和策略

部署完成后，CDK 将输出重要的资源 ID，包括：

- Supervisor Agent ID 和 Alias ID
- Portfolio Creator Agent ID
- Knowledge Base ID
- S3 存储桶名称
- OpenSearch Serverless 集合名称和 ARN

记录这些输出，以便在后续步骤中使用。

## 上传数据

部署完成后，您可以将数据上传到 S3 存储桶，以便知识库可以索引和查询这些数据：

```bash
aws s3 cp ./data/ s3://your-knowledge-base-bucket/ --recursive
```

上传数据后，Bedrock 将自动处理和索引这些数据。

## 与 Streamlit 前端集成

要将此项目与 bedrock-agent-streamlit-ui 前端集成，请按照以下步骤操作：

1. 记录部署输出的 Agent ID 和 Agent Alias ID
2. 在 bedrock-agent-streamlit-ui 项目的 config.py 文件中更新以下配置：

   ```python
   AGENT_ID = "your-supervisor-agent-id"
   AGENT_ALIAS_ID = "your-supervisor-agent-alias-id"
   ```

3. 启动 Streamlit 应用程序：
   ```bash
   streamlit run app.py
   ```

## 测试代理

您可以使用 AWS 控制台或 AWS CLI 测试部署的代理：

### 使用 AWS 控制台

1. 导航到 Amazon Bedrock 控制台
2. 选择"Agents"
3. 找到您的 Supervisor Agent
4. 点击"Test"
5. 在测试界面中输入查询并查看响应

### 使用 AWS CLI

```bash
aws bedrock-agent invoke-agent \
  --agent-id your-agent-id \
  --agent-alias-id your-agent-alias-id \
  --session-id $(uuidgen) \
  --input-text "创建一个包含科技公司的投资组合"
```

## 清理资源

如果您不再需要这些资源，可以使用以下命令删除它们：

```bash
cdk destroy --all
```

注意：这将删除所有资源，包括 S3 存储桶中的数据。如果您想保留数据，请在销毁堆栈之前备份数据。

## 故障排除

### 1. OpenSearch Serverless 集合创建失败

如果 OpenSearch Serverless 集合创建失败，可能是由于以下原因：

- 服务限额不足
- 命名冲突
- 权限不足

解决方案：

- 检查 AWS 控制台中的错误消息
- 手动创建集合，然后在部署时提供集合名称

### 2. 嵌入模型 ARN 格式错误

如果部署失败，并显示嵌入模型 ARN 格式错误，请确保使用正确的 ARN 格式：

```
arn:aws:bedrock:${region}::foundation-model/${modelId}
```

注意账户 ID 部分为空（两个冒号之间没有内容），服务名称为"foundation-model"。

### 3. 权限不足

如果部署失败，并显示权限错误，请确保您的 AWS 账户具有创建所需资源的权限。您可能需要联系管理员获取额外的权限。

## 最佳实践

1. **环境隔离**：为开发、测试和生产环境使用不同的 AWS 账户或区域
2. **资源命名**：使用有意义的名称，以便于识别和管理资源
3. **监控**：设置 CloudWatch 警报和日志，以监控代理的性能和错误
4. **成本管理**：定期检查资源使用情况，避免不必要的费用
5. **安全性**：遵循最小权限原则，只授予必要的权限
6. **备份**：定期备份重要数据，以防意外删除或损坏
