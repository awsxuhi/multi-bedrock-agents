import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { PortfolioCreatorAgent } from "./subagents/portfolio-creator";
import { SupervisorAgent } from "./supervisor-agent";

export class MultiBedrockAgentsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Portfolio Creator Subagent
    const portfolioCreatorAgent = new PortfolioCreatorAgent(this, "PortfolioCreatorAgent");

    // Create Supervisor Agent (after subagent creation)
    const supervisorAgent = new SupervisorAgent(this, "SupervisorAgent", {
      subAgentIds: [portfolioCreatorAgent.agent.agent.attrAgentId],
    });

    // Output important information
    new cdk.CfnOutput(this, "SupervisorAgentId", {
      value: supervisorAgent.agent.agent.attrAgentId,
      description: "Supervisor Agent ID",
    });

    new cdk.CfnOutput(this, "SupervisorAgentAliasId", {
      value: supervisorAgent.agent.agentAlias.attrAgentAliasId,
      description: "Supervisor Agent Alias ID",
    });

    new cdk.CfnOutput(this, "PortfolioCreatorAgentId", {
      value: portfolioCreatorAgent.agent.agent.attrAgentId,
      description: "Portfolio Creator Agent ID",
    });
  }
}
