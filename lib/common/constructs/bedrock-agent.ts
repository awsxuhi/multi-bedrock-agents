import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { ModelRegistry } from "../models/model-registry";

export enum AgentMode {
  STANDALONE = "STANDALONE",
  SUPERVISOR = "SUPERVISOR",
  SUPERVISOR_ROUTER = "SUPERVISOR_ROUTER",
  SUBAGENT = "SUBAGENT",
}

// Custom type for action groups that can accept either CDK's type or our custom type
export type ActionGroupProperty =
  | bedrock.CfnAgent.AgentActionGroupProperty
  | {
      actionGroupName: string;
      description?: string;
    };

export interface BedrockAgentProps {
  agentName: string;
  description?: string;
  instruction: string;
  modelKey: string; // Key from ModelRegistry
  actionGroups?: ActionGroupProperty[];
  knowledgeBases?: bedrock.CfnAgent.AgentKnowledgeBaseProperty[];
  agentMode?: AgentMode;
  subAgentIds?: string[]; // For SUPERVISOR and SUPERVISOR_ROUTER modes
  additionalPolicies?: iam.PolicyStatement[];
}

export class BedrockAgent extends Construct {
  public readonly agent: bedrock.CfnAgent;
  public readonly agentAlias: bedrock.CfnAgentAlias;

  constructor(scope: Construct, id: string, props: BedrockAgentProps) {
    super(scope, id);

    // Get model ID from ModelRegistry
    const modelId = ModelRegistry.getModelId(props.modelKey);

    // Create Agent role
    const agentRole = this.createAgentRole(props);

    // Create Agent
    this.agent = new bedrock.CfnAgent(this, "Agent", {
      agentName: props.agentName,
      description: props.description,
      instruction: props.instruction,
      foundationModel: modelId,
      actionGroups: props.actionGroups || [],
      knowledgeBases: props.knowledgeBases || [],
      agentResourceRoleArn: agentRole.roleArn,
      // Multi-agent collaboration configuration
      ...(props.agentMode &&
        props.agentMode !== AgentMode.STANDALONE && {
          customerEncryptionKeyArn: undefined, // Optional KMS key
          idleSessionTtlInSeconds: 1800, // 30 minutes
          agentMode: props.agentMode,
          ...(props.subAgentIds && {
            subAgentConfigurations: props.subAgentIds.map((id) => ({
              subAgentId: id,
            })),
          }),
        }),
    });

    // Create Agent alias without specifying routingConfiguration
    this.agentAlias = new bedrock.CfnAgentAlias(this, "AgentAlias", {
      agentId: this.agent.attrAgentId,
      agentAliasName: "latest",
    });

    // Make sure alias is created after agent
    this.agentAlias.addDependsOn(this.agent);

    // Output important information
    new cdk.CfnOutput(this, "AgentId", {
      value: this.agent.attrAgentId,
      description: "Bedrock Agent ID",
    });

    new cdk.CfnOutput(this, "AgentAliasId", {
      value: this.agentAlias.attrAgentAliasId,
      description: "Bedrock Agent Alias ID",
    });
  }

  private createAgentRole(props: BedrockAgentProps): iam.Role {
    const role = new iam.Role(this, "AgentRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    // Basic permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // Can be restricted as needed
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
