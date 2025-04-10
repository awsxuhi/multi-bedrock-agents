# 代码更改记录

本文档记录了项目中的重要代码更改，包括修复、优化和新功能的实现。

## 2025-04-10: 修复 Lambda 函数依赖和索引创建问题（最终解决方案 v3）

### 问题描述

在部署过程中，仍然遇到了以下错误：

```
"The knowledge base storage configuration provided is invalid... Dependency error document status code: 404, error message: no such index [pckb-kb-col-suhewc-vector-index]"
```

这个错误表明索引创建成功，但知识库创建时索引可能还没有完全准备好。

### 解决方案

1. **增强 Lambda 函数的索引验证**：

   - 添加索引健康状态检查
   - 添加索引可写性验证
   - 实现更完善的轮询机制

2. **添加索引状态检查函数**：

   - 创建专门的 Lambda 函数检查索引状态
   - 实现轮询机制，定期检查索引健康状态
   - 验证索引可读可写

3. **实现类似 AWS SDK 的等待机制**：

   ```javascript
   // 等待索引准备好的函数
   async function waitForIndexReady(endpoint, indexName) {
     const maxAttempts = 30; // 最多尝试30次
     const delay = 10000; // 每次等待10秒
     let attempts = 0;
     let indexReady = false;

     const healthUrl = new URL(`https://${endpoint}/_cluster/health/${indexName}`);

     while (!indexReady && attempts < maxAttempts) {
       try {
         attempts++;
         console.log(`检查索引健康状态 (尝试 ${attempts}/${maxAttempts})...`);
         const healthResponse = await makeRequest(healthUrl.toString(), "GET");

         if (healthResponse.status === "green" || healthResponse.status === "yellow") {
           console.log(`索引健康状态: ${healthResponse.status}`);
           indexReady = true;
         } else {
           console.log(`索引健康状态: ${healthResponse.status}，等待变为 green 或 yellow...`);
           await new Promise((resolve) => setTimeout(resolve, delay));
         }
       } catch (error) {
         console.log(`检查索引健康状态失败: ${error.message}，等待重试...`);
         await new Promise((resolve) => setTimeout(resolve, delay));
       }
     }

     if (!indexReady) {
       throw new Error(`索引在${(maxAttempts * delay) / 1000}秒内未准备好`);
     }
   }
   ```

4. **验证索引可写性**：

   ```javascript
   // 尝试插入一个测试文档，确保索引可写
   console.log("尝试插入测试文档以验证索引可写...");
   const testDocUrl = new URL(`https://${endpoint}/${indexName}/_doc/test-doc-id`);
   const testDoc = {
     vector: Array(parseInt(vectorSize)).fill(0),
     text: "This is a test document",
     metadata: { test: true },
   };
   await makeRequest(testDocUrl.toString(), "PUT", testDoc);

   // 删除测试文档
   console.log("删除测试文档...");
   await makeRequest(testDocUrl.toString(), "DELETE");
   ```

## 2025-04-10: 修复 Lambda 函数依赖和索引创建问题（最终解决方案 v2）

### 问题描述

在部署过程中，遇到了以下错误：

```
"Error: Cannot find module 'axios'"
```

```
"The knowledge base storage configuration provided is invalid... Dependency error document status code: 404, error message: no such index [pckb-kb-col-suhewc-vector-index]"
```

这些错误表明：

1. Lambda 函数找不到 axios 模块
2. 知识库创建时，索引还没有准备好

### 解决方案

1. **安装 Lambda 函数依赖**：

   - 在 lambda-index-creator 目录中运行 `npm install`
   - 确保 axios 依赖被正确安装

2. **增加 Lambda 函数重试逻辑**：

   ```javascript
   // 创建索引并添加重试逻辑
   const maxRetries = 5;
   const retryDelay = 5000; // 5秒
   let retries = 0;
   let success = false;

   while (retries < maxRetries && !success) {
     try {
       console.log(`尝试创建索引 (尝试 ${retries + 1}/${maxRetries})...`);
       const response = await makeRequest(url.toString(), "PUT", indexBody);
       console.log("索引创建成功:", response);
       success = true;
     } catch (error) {
       lastError = error;
       console.log(`创建索引失败 (尝试 ${retries + 1}/${maxRetries}): ${error.message}`);
       retries++;
       if (retries < maxRetries) {
         console.log(`等待 ${retryDelay}ms 后重试...`);
         await new Promise((resolve) => setTimeout(resolve, retryDelay));
       }
     }
   }
   ```

3. **添加延迟函数**：

   - 创建一个延迟 Lambda 函数，等待 30 秒
   - 使用自定义资源调用延迟函数
   - 确保知识库在延迟函数执行后创建

   ```typescript
   // 添加延迟，确保索引已经创建好了
   const delay = new lambda.Function(this, "DelayFunction", {
     runtime: lambda.Runtime.NODEJS_18_X,
     handler: "index.handler",
     code: lambda.Code.fromInline(`
       exports.handler = async (event) => {
         // 等待30秒
         await new Promise(resolve => setTimeout(resolve, 30000));
         return {
           statusCode: 200,
           body: JSON.stringify('Delay completed'),
         };
       };
     `),
     timeout: cdk.Duration.seconds(60),
   });

   // 创建自定义资源，调用延迟函数
   const delayProvider = new cr.Provider(this, "DelayProvider", {
     onEventHandler: delay,
   });

   const delayResource = new cdk.CustomResource(this, "DelayResource", {
     serviceToken: delayProvider.serviceToken,
     properties: {
       timestamp: Date.now().toString(), // 确保每次部署都会触发
     },
   });

   // 将知识库与延迟资源关联
   this.knowledgeBase.node.addDependency(delayResource);
   ```

## 2025-04-10: 修复 Lambda 函数依赖和索引创建问题（最终解决方案）

### 问题描述

在部署过程中，遇到了以下错误：

```
"The knowledge base storage configuration provided is invalid... Dependency error document status code: 404, error message: no such index [vector-index]"
```

这个错误表明 OpenSearch Serverless 集合中没有名为 "vector-index" 的索引，或者在创建知识库时索引还没有准备好。

### 解决方案

1. **使用集合名称作为索引名称前缀**：

   - 在 Lambda 函数中：`const indexName = ${collection}-${vectorIndexName};`
   - 在知识库配置中：`actualIndexName = ${safeCollectionName}-${vectorIndexName};`
   - 这样可以确保索引名称与集合名称一致，避免冲突

2. **增加 Lambda 函数的超时时间**：

   - 从 5 分钟增加到 10 分钟：`timeout: cdk.Duration.minutes(10)`
   - 确保有足够的时间创建索引

3. **重构代码结构**：

   - 将代码重构为更简单的形式，避免复杂的依赖关系
   - 使用明确的变量声明和赋值，避免 TypeScript 错误
   - 确保知识库在集合创建后创建：`this.knowledgeBase.addDependsOn(collection);`

4. **修改 Lambda 函数实现**：
   ```javascript
   // 使用集合名称作为索引名称前缀
   const indexName = `${collection}-${vectorIndexName}`;
   ```

## 2025-04-10: 修复 Lambda 函数依赖和索引创建问题（更新）

### 问题描述

在部署过程中，遇到了以下错误：

```
"The knowledge base storage configuration provided is invalid... Dependency error document status code: 404, error message: no such index [bedrock-kb-index]"
```

这个错误表明 OpenSearch Serverless 集合中没有名为 "bedrock-kb-index" 的索引，或者在创建知识库时索引还没有准备好。

### 解决方案

1. **修改向量索引名称**：

   - 将默认索引名称从 "bedrock-kb-index" 改为 "vector-index"
   - 这样可以避免与硬编码的索引名称冲突

2. **添加依赖关系**：

   - 确保在创建知识库之前，索引已经创建好了
   - 添加代码：`this.knowledgeBase.node.addDependency(indexCreator);`

3. **修复 TypeScript 错误**：
   - 将 indexCreator 变量提升到 if 语句块外部
   - 添加类型声明：`let indexCreator: cdk.CustomResource | undefined;`
   - 添加空值检查：`if (!props.collectionName && indexCreator) { ... }`

## 2025-04-10: 修复 Lambda 函数依赖和索引创建问题

### 问题描述

在部署过程中，遇到了以下错误：

```
"Error: Cannot find module 'aws-sdk'"
```

```
"The knowledge base storage configuration provided is invalid... Dependency error document status code: 404, error message: no such index [bedrock-kb-index]"
```

这些错误表明：

1. Lambda 函数找不到 'aws-sdk' 模块
2. OpenSearch Serverless 集合中没有名为 "bedrock-kb-index" 的索引

### 解决方案

1. **修改 Lambda 函数实现**：

   - 将内联代码改为使用 Lambda 资产目录
   - 创建 `lambda-index-creator` 目录和文件
   - 使用 axios 替代 aws-sdk 进行 HTTP 请求
   - 添加 package.json 文件，包含必要的依赖

2. **Lambda 函数实现细节**：

   ```javascript
   // Lambda function for creating OpenSearch Serverless vector index
   const { default: axios } = require("axios");
   const { URL } = require("url");

   exports.handler = async (event) => {
     // 处理 CloudFormation 自定义资源事件
     // 创建 OpenSearch Serverless 向量索引
   };
   ```

3. **package.json 文件**：
   ```json
   {
     "name": "lambda-index-creator",
     "version": "1.0.0",
     "description": "Lambda function for creating OpenSearch Serverless vector index",
     "main": "index.js",
     "dependencies": {
       "axios": "^1.6.0"
     }
   }
   ```

## 2025-04-10: 修复 AgentAlias 的 routingConfiguration 配置问题

### 问题描述

在部署过程中，遇到了以下错误：

```
"The attribute routingConfiguration in AgentAlias is invalid. DRAFT must not be associated with this alias. Retry the request with a valid attribute."
```

这个错误表明在创建 AgentAlias 时，不能将 DRAFT 版本与别名关联。

### 解决方案

1. **移除 AgentVersion 的创建**：

   - AWS CDK 的 bedrock 模块中没有 CfnAgentVersion 类，无法直接创建 Agent 版本

2. **修改 AgentAlias 的配置**：
   - 移除 routingConfiguration 配置，让 AWS 自动处理版本关联
   - 确保 AgentAlias 在 Agent 创建后创建

```typescript
// 修改前
this.agentAlias = new bedrock.CfnAgentAlias(this, "AgentAlias", {
  agentId: this.agent.attrAgentId,
  agentAliasName: "latest",
  routingConfiguration: [
    {
      agentVersion: "DRAFT",
    },
  ],
});

// 修改后
this.agentAlias = new bedrock.CfnAgentAlias(this, "AgentAlias", {
  agentId: this.agent.attrAgentId,
  agentAliasName: "latest",
});

// 确保别名在 agent 创建后创建
this.agentAlias.addDependsOn(this.agent);
```

## 2025-04-10: 修复 OpenSearch Serverless 资源名称长度限制

### 问题描述

在部署过程中，遇到了以下错误：

```
Properties validation failed for resource PortfolioCreatorAgentKnowledgeBaseCollection61201750 with message:
[#/Name: expected maxLength: 32, actual: 43, #/Name: string [portfolio-creator-knowledge-base-collection] does not match pattern ^[a-z][a-z0-9-]{2,31}$]
```

OpenSearch Serverless 资源名称有以下限制：

- 最大长度为 32 个字符
- 必须以小写字母开头
- 只能包含小写字母、数字和连字符
- 长度在 3-32 之间

我们的资源名称超出了这些限制：

- portfolio-creator-knowledge-base-collection (43 个字符)
- portfolio-creator-knowledge-base-collection-encryption-policy (61 个字符)
- portfolio-creator-knowledge-base-collection-network-policy (58 个字符)
- portfolio-creator-knowledge-base-collection-access-policy (57 个字符)

### 解决方案

1. **创建更短的资源名称**：

   - 使用缩写和唯一标识符生成更短的名称
   - 添加验证函数确保名称符合规则

2. **实现细节**：
   - 从知识库名称生成缩写（使用每个部分的首字母）
   - 添加时间戳作为唯一标识符
   - 添加验证函数确保名称符合规则（以小写字母开头，长度不超过 32）
   - 为策略名称使用更短的后缀（enc-pol、net-pol、acc-pol）

```typescript
// 生成缩写
const baseNameParts = props.knowledgeBaseName.split("-");
const abbreviation = baseNameParts.map((part) => part.charAt(0)).join("");

// 添加时间戳作为唯一标识符
const uniqueId = Math.floor(Date.now() / 1000).toString(36);

// 组合生成集合名称
const collectionName = `${abbreviation}-kb-col-${uniqueId}`.toLowerCase();

// 验证函数确保名称符合规则
const validateName = (name: string): string => {
  // 必须以小写字母开头
  let validName = name.charAt(0).match(/[a-z]/) ? name : `a${name}`;
  // 长度不超过 32
  validName = validName.substring(0, 32);
  return validName;
};

// 使用验证函数生成安全的名称
const safeCollectionName = validateName(collectionName);
```

## 2025-04-10: 修复 OpenSearch Serverless 集合 ARN 格式和自动创建集合

### 问题描述

在使用 AWS CDK 部署 Bedrock Agent 时，遇到了以下几个问题：

1. 嵌入模型 ARN 格式不正确，导致 CloudFormation 验证失败
2. OpenSearch Serverless 集合 ARN 格式不正确，需要使用 AWS 生成的集合 ID
3. 缺少自动创建 OpenSearch Serverless 集合的功能

### 解决方案

1. **修复嵌入模型 ARN 格式**

   将嵌入模型 ARN 格式从：

   ```typescript
   const embeddingModelArn = `arn:aws:bedrock:${region}:${accountId}:embedding-model/${modelId}`;
   ```

   修改为正确的格式：

   ```typescript
   const embeddingModelArn = `arn:aws:bedrock:${region}::foundation-model/${modelId}`;
   ```

   注意关键区别：

   - 账户 ID 部分为空（两个冒号之间没有内容）
   - 服务名称为"foundation-model"而不是"embedding-model"

2. **添加 OpenSearch Serverless 集合的自动创建**

   修改`KnowledgeBase`构造，添加以下功能：

   - 添加`collectionName`和`vectorIndexName`可选参数
   - 如果提供了`collectionName`，使用现有集合
   - 如果没有提供`collectionName`，自动创建新的集合
   - 创建必要的安全策略（加密策略、网络策略和数据访问策略）
   - 使用 Lambda 自定义资源创建向量索引
   - 使用生成的集合 ARN 配置知识库

3. **使用动态生成的集合 ARN 和索引名称**

   将知识库配置中的硬编码 ARN：

   ```typescript
   collectionArn: `arn:aws:aoss:${region}:${accountId}:collection/bedrock-kb-collection`,
   vectorIndexName: "bedrock-kb-index",
   ```

   修改为动态生成的值：

   ```typescript
   collectionArn: collectionArn,
   vectorIndexName: vectorIndexName,
   ```

### 实现细节

1. **导入必要的模块**

   ```typescript
   import * as opensearch from "aws-cdk-lib/aws-opensearchserverless";
   import * as lambda from "aws-cdk-lib/aws-lambda";
   import * as cr from "aws-cdk-lib/custom-resources";
   ```

2. **扩展 KnowledgeBaseProps 接口**

   ```typescript
   export interface KnowledgeBaseProps {
     // 现有属性
     collectionName?: string; // 如果提供，使用现有OpenSearch Serverless集合，否则创建新的
     vectorIndexName?: string; // 如果提供，使用此名称作为向量索引，否则使用默认值
   }
   ```

3. **创建 OpenSearch Serverless 集合和安全策略**

   ```typescript
   // 创建OpenSearch Serverless集合
   const collection = new opensearch.CfnCollection(this, "Collection", {
     name: collectionName,
     type: "VECTORSEARCH",
     description: `Collection for ${props.knowledgeBaseName} knowledge base`,
   });

   // 创建加密策略
   const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, "EncryptionPolicy", {
     name: `${collectionName}-encryption-policy`,
     type: "encryption",
     policy: JSON.stringify({
       Rules: [{ ResourceType: "collection", Resource: [`collection/${collection.name}`] }],
       AWSOwnedKey: true,
     }),
   });
   collection.addDependsOn(encryptionPolicy);

   // 创建网络策略
   const networkPolicy = new opensearch.CfnSecurityPolicy(this, "NetworkPolicy", {
     name: `${collectionName}-network-policy`,
     type: "network",
     policy: JSON.stringify([
       {
         Rules: [
           { Resource: [`collection/${collection.name}`], ResourceType: "dashboard" },
           { Resource: [`collection/${collection.name}`], ResourceType: "collection" },
         ],
         AllowFromPublic: true,
       },
     ]),
   });
   collection.addDependsOn(networkPolicy);

   // 创建数据访问策略
   const dataAccessPolicy = new opensearch.CfnAccessPolicy(this, "DataAccessPolicy", {
     name: `${collectionName}-access-policy`,
     type: "data",
     policy: JSON.stringify([
       {
         Rules: [
           {
             Resource: [`collection/${collection.name}`],
             Permission: ["aoss:CreateCollectionItems", "aoss:DeleteCollectionItems", "aoss:UpdateCollectionItems", "aoss:DescribeCollectionItems"],
             ResourceType: "collection",
           },
           {
             Resource: [`index/${collection.name}/*`],
             Permission: ["aoss:CreateIndex", "aoss:DeleteIndex", "aoss:UpdateIndex", "aoss:DescribeIndex", "aoss:ReadDocument", "aoss:WriteDocument"],
             ResourceType: "index",
           },
         ],
         Principal: [kbRole.roleArn],
         Description: "Knowledge base data access policy",
       },
     ]),
   });
   collection.addDependsOn(dataAccessPolicy);
   ```

4. **创建索引**

   使用 Lambda 自定义资源创建向量索引，包括：

   - 创建 Lambda 函数角色
   - 创建 Lambda 函数
   - 创建自定义资源提供者
   - 创建自定义资源

5. **使用生成的集合 ARN**

   ```typescript
   collectionArn = collection.attrArn;
   ```

### 测试和验证

1. 运行`cdk synth`命令验证 CloudFormation 模板生成是否成功
2. 运行`cdk deploy --verbose --all --require-approval never`命令部署资源
3. 验证 OpenSearch Serverless 集合是否成功创建
4. 验证知识库是否成功创建并关联到集合

### 注意事项

1. 创建 OpenSearch Serverless 集合需要一定的时间，部署过程可能需要几分钟
2. 如果已经有现有的集合，可以通过`collectionName`参数使用它
3. 默认的向量索引名称为"bedrock-kb-index"，可以通过`vectorIndexName`参数自定义
4. Lambda 函数使用 Node.js 18.x 运行时，如果需要其他运行时，需要修改代码
