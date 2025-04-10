import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface ActionGroupProps {
  actionGroupName: string;
  description?: string;
  lambdaFunction: lambda.Function;
  apiSchema: string;
  additionalPolicies?: iam.PolicyStatement[];
  agentId?: string; // 添加可选的agentId参数
}

export class ActionGroup extends Construct {
  public readonly actionGroupId: string;
  public readonly actionGroupArn: string;

  constructor(scope: Construct, id: string, props: ActionGroupProps) {
    super(scope, id);

    // Grant Lambda permissions to be invoked by Bedrock
    props.lambdaFunction.addPermission("BedrockInvoke", {
      principal: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    // Create a custom resource to create the action group using AWS SDK
    const createActionGroupProvider = new cr.Provider(this, "CreateActionGroupProvider", {
      onEventHandler: new lambda.Function(this, "CreateActionGroupFunction", {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromInline(`
          // 使用AWS SDK v3
          const { BedrockAgentClient, CreateAgentActionGroupCommand, DeleteAgentActionGroupCommand } = require('@aws-sdk/client-bedrock-agent');
          
          exports.handler = async (event) => {
            console.log('Event:', JSON.stringify(event, null, 2));
            
            // 创建BedrockAgent客户端
            const client = new BedrockAgentClient({ region: process.env.AWS_REGION });
            
            if (event.RequestType === 'Create' || event.RequestType === 'Update') {
              try {
                // 检查是否提供了agentId
                if (!event.ResourceProperties.agentId) {
                  throw new Error('agentId is required for creating an action group');
                }
                
                const params = {
                  agentId: event.ResourceProperties.agentId, // 添加agentId参数
                  actionGroupName: event.ResourceProperties.actionGroupName,
                  description: event.ResourceProperties.description,
                  actionGroupExecutor: {
                    lambda: event.ResourceProperties.lambdaArn
                  },
                  apiSchema: {
                    payload: event.ResourceProperties.apiSchema
                  }
                };
                
                console.log('Creating action group with params:', JSON.stringify(params, null, 2));
                
                const command = new CreateAgentActionGroupCommand(params);
                const response = await client.send(command);
                console.log('Action group created:', JSON.stringify(response, null, 2));
                
                return {
                  PhysicalResourceId: response.actionGroupId,
                  Data: {
                    actionGroupId: response.actionGroupId,
                    actionGroupArn: response.actionGroupArn
                  }
                };
              } catch (error) {
                console.error('Error creating action group:', error);
                throw error;
              }
            } else if (event.RequestType === 'Delete') {
              try {
                // 检查是否提供了agentId
                if (!event.ResourceProperties.agentId) {
                  console.log('agentId not provided, skipping delete operation');
                  return {
                    PhysicalResourceId: event.PhysicalResourceId || 'default'
                  };
                }
                
                const params = {
                  agentId: event.ResourceProperties.agentId, // 添加agentId参数
                  actionGroupId: event.PhysicalResourceId
                };
                
                console.log('Deleting action group with params:', JSON.stringify(params, null, 2));
                
                const command = new DeleteAgentActionGroupCommand(params);
                await client.send(command);
                console.log('Action group deleted');
                
                return {
                  PhysicalResourceId: event.PhysicalResourceId
                };
              } catch (error) {
                console.error('Error deleting action group:', error);
                throw error;
              }
            }
            
            return {
              PhysicalResourceId: event.PhysicalResourceId || 'default'
            };
          }
        `),
        timeout: cdk.Duration.minutes(5),
        initialPolicy: [
          new iam.PolicyStatement({
            actions: ["bedrock:CreateAgentActionGroup", "bedrock:DeleteAgentActionGroup"],
            resources: ["*"],
          }),
        ],
        environment: {
          NODE_OPTIONS: "--use-openssl-ca", // 确保HTTPS请求能正常工作
        },
      }),
    });

    // Create the custom resource
    const actionGroupResource = new cdk.CustomResource(this, "ActionGroupResource", {
      serviceToken: createActionGroupProvider.serviceToken,
      properties: {
        actionGroupName: props.actionGroupName,
        description: props.description || "",
        lambdaArn: props.lambdaFunction.functionArn,
        apiSchema: props.apiSchema,
        agentId: props.agentId, // 传递agentId参数
      },
    });

    // Store the action group ID and ARN
    this.actionGroupId = actionGroupResource.getAttString("actionGroupId");
    this.actionGroupArn = actionGroupResource.getAttString("actionGroupArn");

    // Output important information
    new cdk.CfnOutput(this, "ActionGroupId", {
      value: this.actionGroupId,
      description: "Bedrock Action Group ID",
    });
  }
}
