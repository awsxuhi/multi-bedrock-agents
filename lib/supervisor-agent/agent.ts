import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BedrockAgent, AgentMode } from "../common/constructs/bedrock-agent";
import { SupervisorPermissions } from "./permissions";
import { SUPERVISOR_INSTRUCTIONS } from "./instructions";

export interface SupervisorAgentProps {
  subAgentIds: string[];
  modelKey?: string;
}

export class SupervisorAgent extends Construct {
  public readonly agent: BedrockAgent;

  constructor(scope: Construct, id: string, props: SupervisorAgentProps) {
    super(scope, id);

    // Create Supervisor Agent
    this.agent = new BedrockAgent(this, "SupervisorAgent", {
      agentName: "portfolio-supervisor-agent",
      description: "Supervisor agent for routing and coordinating subagents",
      instruction: SUPERVISOR_INSTRUCTIONS,
      modelKey: props.modelKey || "claude-3-haiku",
      agentMode: AgentMode.SUPERVISOR_ROUTER,
      subAgentIds: props.subAgentIds,
      additionalPolicies: SupervisorPermissions.getAgentPermissions(),
    });

    // Output important information
    new cdk.CfnOutput(this, "SupervisorAgentId", {
      value: this.agent.agent.attrAgentId,
      description: "Supervisor Agent ID",
    });

    new cdk.CfnOutput(this, "SupervisorAgentAliasId", {
      value: this.agent.agentAlias.attrAgentAliasId,
      description: "Supervisor Agent Alias ID",
    });
  }
}
