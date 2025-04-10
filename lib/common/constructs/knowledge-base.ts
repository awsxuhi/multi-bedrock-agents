import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as opensearch from "aws-cdk-lib/aws-opensearchserverless";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import * as path from "path";
import { Construct } from "constructs";
import { ModelRegistry } from "../models/model-registry";

export interface KnowledgeBaseProps {
  knowledgeBaseName: string;
  description?: string;
  embeddingModelKey: string; // Key from ModelRegistry
  s3BucketName?: string; // If provided, use existing S3 bucket, otherwise create new one
  collectionName?: string; // If provided, use existing OpenSearch Serverless collection, otherwise create new one
  vectorIndexName?: string; // If provided, use this name for the vector index, otherwise use default
  additionalPolicies?: iam.PolicyStatement[];
}

export class KnowledgeBase extends Construct {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    // Get embedding model ID and construct proper ARN
    const modelId = ModelRegistry.getModel(props.embeddingModelKey).id;
    const region = cdk.Stack.of(this).region;
    const accountId = cdk.Stack.of(this).account;
    // 对于公共模型，ARN格式为：arn:aws:bedrock:${region}::foundation-model/${modelId}
    // eg., arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0
    const embeddingModelArn = `arn:aws:bedrock:${region}::foundation-model/${modelId}`;

    // Create or use existing S3 bucket
    if (props.s3BucketName) {
      this.bucket = s3.Bucket.fromBucketName(this, "ImportedBucket", props.s3BucketName) as s3.Bucket;
    } else {
      this.bucket = new s3.Bucket(this, "KnowledgeBaseBucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
        autoDeleteObjects: true, // For development; set to false for production
      });
    }

    // Create Knowledge Base role
    const kbRole = this.createKnowledgeBaseRole(props);

    // Define vector index name - use collection name as prefix to ensure uniqueness
    const vectorIndexName = props.vectorIndexName || "vector-index";

    // Create or use existing OpenSearch Serverless collection
    let collectionArn: string;
    let actualIndexName: string;
    let collection: opensearch.CfnCollection | undefined;

    if (props.collectionName) {
      // Use existing collection
      collectionArn = `arn:aws:aoss:${region}:${accountId}:collection/${props.collectionName}`;
      actualIndexName = vectorIndexName;
    } else {
      // Create new collection with shortened name (max 32 chars)
      // Generate a base name from the knowledge base name
      const baseNameParts = props.knowledgeBaseName.split("-");
      // Create an abbreviated name using first letters of each part
      const abbreviation = baseNameParts.map((part) => part.charAt(0)).join("");
      // Create a unique identifier using timestamp
      const uniqueId = Math.floor(Date.now() / 1000).toString(36);
      // Combine to create a collection name that's guaranteed to be under 32 chars
      const collectionName = `${abbreviation}-kb-col-${uniqueId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      // Ensure the name is valid and not too long
      const validateName = (name: string): string => {
        // Must start with a lowercase letter
        let validName = name.charAt(0).match(/[a-z]/) ? name : `a${name}`;
        // Must be between 3-32 chars
        validName = validName.substring(0, 32);
        return validName;
      };

      const safeCollectionName = validateName(collectionName);

      // Create OpenSearch Serverless collection
      collection = new opensearch.CfnCollection(this, "Collection", {
        name: safeCollectionName,
        type: "VECTORSEARCH",
        description: `Collection for ${props.knowledgeBaseName} knowledge base`,
      });

      // Create encryption policy with shortened name
      const encryptionPolicy = new opensearch.CfnSecurityPolicy(this, "EncryptionPolicy", {
        name: validateName(`${safeCollectionName}-enc-pol`),
        type: "encryption",
        policy: JSON.stringify(
          {
            Rules: [{ ResourceType: "collection", Resource: [`collection/${collection.name}`] }],
            AWSOwnedKey: true,
          },
          null,
          2
        ),
      });
      collection.addDependsOn(encryptionPolicy);

      // Create network policy with shortened name
      const networkPolicy = new opensearch.CfnSecurityPolicy(this, "NetworkPolicy", {
        name: validateName(`${safeCollectionName}-net-pol`),
        type: "network",
        policy: JSON.stringify(
          [
            {
              Rules: [
                { Resource: [`collection/${collection.name}`], ResourceType: "dashboard" },
                { Resource: [`collection/${collection.name}`], ResourceType: "collection" },
              ],
              AllowFromPublic: true,
            },
          ],
          null,
          2
        ),
      });
      collection.addDependsOn(networkPolicy);

      // Create data access policy with shortened name
      const dataAccessPolicy = new opensearch.CfnAccessPolicy(this, "DataAccessPolicy", {
        name: validateName(`${safeCollectionName}-acc-pol`),
        type: "data",
        policy: JSON.stringify(
          [
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
          ],
          null,
          2
        ),
      });
      collection.addDependsOn(dataAccessPolicy);

      // Create index creator Lambda function
      const indexCreatorRole = new iam.Role(this, "IndexCreatorRole", {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
      });

      indexCreatorRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["aoss:APIAccessAll"],
          resources: [collection.attrArn],
        })
      );

      // Create Lambda function for index creation
      const indexCreatorFunction = new lambda.Function(this, "IndexCreatorFunction", {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "lambda-index-creator")),
        timeout: cdk.Duration.minutes(10), // 增加超时时间，确保有足够的时间创建索引
      });

      // Create custom resource provider
      const provider = new cr.Provider(this, "IndexCreatorProvider", {
        onEventHandler: indexCreatorFunction,
      });

      // Create custom resource for index creation
      const indexCreator = new cdk.CustomResource(this, "IndexCreator", {
        serviceToken: provider.serviceToken,
        properties: {
          collection: collection.name,
          endpoint: collection.attrCollectionEndpoint,
          vectorIndexName: vectorIndexName,
          vectorSize: 1536, // Titan Embeddings v2 dimension
        },
      });

      indexCreator.node.addDependency(collection);

      // 使用集合名称和向量索引名称组合作为实际索引名称
      actualIndexName = `${safeCollectionName}-${vectorIndexName}`;

      // Use the collection ARN
      collectionArn = collection.attrArn;

      // Output collection information
      new cdk.CfnOutput(this, "CollectionName", {
        value: collection.name,
        description: "OpenSearch Serverless Collection Name",
      });

      new cdk.CfnOutput(this, "CollectionArn", {
        value: collectionArn,
        description: "OpenSearch Serverless Collection ARN",
      });

      new cdk.CfnOutput(this, "VectorIndexName", {
        value: actualIndexName,
        description: "Vector Index Name",
      });
    }

    // Create Knowledge Base with proper configuration
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: props.knowledgeBaseName,
      description: props.description,
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR", // Allowed values: VECTOR | KENDRA | SQL
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: embeddingModelArn,
        },
      },
      storageConfiguration: {
        // Allowed values: OPENSEARCH_SERVERLESS | PINECONE | RDS | MONGO_DB_ATLAS | NEPTUNE_ANALYTICS | OPENSEARCH_MANAGED_CLUSTER
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: collectionArn,
          vectorIndexName: actualIndexName, // 使用自定义资源的输出作为索引名称
          fieldMapping: {
            textField: "text",
            vectorField: "vector",
            metadataField: "metadata",
          },
        },
      } as any,
    });

    // 如果我们创建了集合，确保知识库在集合创建后创建
    if (collection) {
      this.knowledgeBase.addDependsOn(collection);

      // 添加索引状态检查函数，确保索引已经创建好了
      const indexCheckerCode = `
        const https = require('https');
        const { URL } = require("url");

        exports.handler = async (event) => {
          console.log("Event:", JSON.stringify(event, null, 2));
          
          if (event.RequestType === "Delete") {
            console.log("处理删除事件...");
            try {
              // 在删除事件中，我们不需要实际执行任何操作
              // 但我们需要确保正确响应CloudFormation
              console.log("成功处理删除事件");
              return await sendResponse(event, "SUCCESS", {});
            } catch (error) {
              console.error("删除事件处理失败:", error);
              return await sendResponse(event, "SUCCESS", {}); // 即使出错也返回成功，以确保CloudFormation可以继续
            }
          }

          const { endpoint, indexName } = event.ResourceProperties;
          
          try {
            // 检查索引是否存在并可用
            console.log(\`检查索引 \${indexName} 是否可用...\`);
            
            // 最多尝试30次，每次间隔10秒
            const maxAttempts = 30;
            const delay = 10000;
            let attempts = 0;
            let indexReady = false;
            
            while (!indexReady && attempts < maxAttempts) {
              try {
                attempts++;
                console.log(\`检查索引 (尝试 \${attempts}/\${maxAttempts})...\`);
                
                // 检查索引健康状态
                const healthUrl = new URL(\`https://\${endpoint}/_cluster/health/\${indexName}\`);
                const healthResponse = await makeRequest(healthUrl.toString(), "GET");
                
                if (healthResponse.status === "green" || healthResponse.status === "yellow") {
                  console.log(\`索引健康状态: \${healthResponse.status}\`);
                  
                  // 检查索引是否可写
                  const testDocUrl = new URL(\`https://\${endpoint}/\${indexName}/_doc/test-doc-id\`);
                  const testDoc = {
                    vector: Array(1536).fill(0),
                    text: "This is a test document",
                    metadata: { test: true }
                  };
                  
                  await makeRequest(testDocUrl.toString(), "PUT", testDoc);
                  await makeRequest(testDocUrl.toString(), "DELETE");
                  
                  console.log("索引验证成功，可读可写");
                  indexReady = true;
                } else {
                  console.log(\`索引健康状态: \${healthResponse.status}，等待变为 green 或 yellow...\`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              } catch (error) {
                console.log(\`检查索引失败: \${error.message}，等待重试...\`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            
            if (!indexReady) {
              throw new Error(\`索引在\${maxAttempts * delay / 1000}秒内未准备好\`);
            }
            
            return await sendResponse(event, "SUCCESS", {
              IndexStatus: "Ready",
              IndexName: indexName
            });
          } catch (error) {
            console.error("Error:", error);
            return await sendResponse(event, "FAILED", {}, error.message);
          }
        };

        function makeRequest(url, method, body) {
          return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
              hostname: urlObj.hostname,
              port: 443,
              path: \`\${urlObj.pathname}\${urlObj.search}\`,
              method: method,
              headers: {
                'Content-Type': 'application/json',
              },
              rejectUnauthorized: false // 禁用SSL证书验证，仅用于开发环境
            };
            
            const req = https.request(options, (res) => {
              let responseData = '';
              
              res.on('data', (chunk) => {
                responseData += chunk;
              });
              
              res.on('end', () => {
                try {
                  const parsedData = JSON.parse(responseData);
                  resolve(parsedData);
                } catch (e) {
                  resolve(responseData);
                }
              });
            });
            
            req.on('error', (error) => {
              reject(new Error(\`Request failed: \${error.message}\`));
            });
            
            if (body) {
              req.write(JSON.stringify(body));
            }
            
            req.end();
          });
        }

        function sendResponse(event, status, data, reason) {
          return new Promise((resolve, reject) => {
            const responseBody = JSON.stringify({
              Status: status,
              Reason: reason || "See the details in CloudWatch Log Stream",
              PhysicalResourceId: event.LogicalResourceId,
              StackId: event.StackId,
              RequestId: event.RequestId,
              LogicalResourceId: event.LogicalResourceId,
              Data: data,
            });
            
            const parsedUrl = new URL(event.ResponseURL);
            const options = {
              hostname: parsedUrl.hostname,
              port: 443,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'PUT',
              headers: {
                'Content-Type': '',
                'Content-Length': responseBody.length
              },
              rejectUnauthorized: false // 禁用SSL证书验证，仅用于开发环境
            };
            
            const req = https.request(options, (res) => {
              let responseData = '';
              
              res.on('data', (chunk) => {
                responseData += chunk;
              });
              
              res.on('end', () => {
                resolve({ status, data });
              });
            });
            
            req.on('error', (error) => {
              console.error("Error sending response:", error);
              reject(error);
            });
            
            req.write(responseBody);
            req.end();
          });
        }
      `;

      // 创建索引检查函数
      const indexChecker = new lambda.Function(this, "IndexCheckerFunction", {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromInline(indexCheckerCode),
        timeout: cdk.Duration.minutes(10), // 给予足够的时间进行检查
        environment: {
          NODE_OPTIONS: "--use-openssl-ca", // 确保HTTPS请求能正常工作
        },
      });

      // 创建自定义资源，调用索引检查函数
      const indexCheckerProvider = new cr.Provider(this, "IndexCheckerProvider", {
        onEventHandler: indexChecker,
      });

      const indexCheckerResource = new cdk.CustomResource(this, "IndexCheckerResource", {
        serviceToken: indexCheckerProvider.serviceToken,
        properties: {
          endpoint: collection.attrCollectionEndpoint,
          indexName: actualIndexName,
          timestamp: Date.now().toString(), // 确保每次部署都会触发
        },
      });

      // 确保索引检查在索引创建后进行
      // 不需要显式添加依赖，因为indexCheckerResource已经依赖于collection
      // 而indexCreator也依赖于collection，所以顺序已经隐式确定

      // 将知识库与索引检查资源关联
      this.knowledgeBase.node.addDependency(indexCheckerResource);
    }

    // 使用CloudFormation escape hatch添加数据源配置
    const cfnKnowledgeBase = this.knowledgeBase.node.defaultChild as cdk.CfnResource;
    if (cfnKnowledgeBase) {
      cfnKnowledgeBase.addPropertyOverride("DataSource", {
        DataSourceConfiguration: {
          S3Configuration: {
            BucketArn: this.bucket.bucketArn,
          },
          Type: "S3",
        },
      });
    }

    // Output important information
    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: this.knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseBucketName", {
      value: this.bucket.bucketName,
      description: "S3 Bucket Name for Knowledge Base",
    });
  }

  private createKnowledgeBaseRole(props: KnowledgeBaseProps): iam.Role {
    const role = new iam.Role(this, "KnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    // Add S3 access permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
        resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
      })
    );

    // Add OpenSearch Serverless permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "aoss:APIAccessAll",
          "aoss:BatchGetCollection",
          "aoss:CreateCollection",
          "aoss:CreateSecurityPolicy",
          "aoss:GetSecurityPolicy",
          "aoss:ListCollections",
          "aoss:UpdateCollection",
        ],
        resources: ["*"],
      })
    );

    // Add additional policies
    if (props.additionalPolicies) {
      props.additionalPolicies.forEach((policy) => {
        role.addToPolicy(policy);
      });
    }

    return role;
  }
}
