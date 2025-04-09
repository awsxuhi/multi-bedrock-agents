import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { BedrockAgent, AgentMode } from "../../common/constructs/bedrock-agent";
import { PortfolioCreatorKnowledgeBase } from "./knowledge-base";
import { PortfolioCreatorActionGroup } from "./action-group";
import { PortfolioCreatorPermissions } from "./permissions";
import { PORTFOLIO_CREATOR_INSTRUCTIONS } from "./instructions";

export interface PortfolioCreatorAgentProps {
  modelKey?: string;
  agentMode?: AgentMode;
}

export class PortfolioCreatorAgent extends Construct {
  public readonly agent: BedrockAgent;
  public readonly knowledgeBase: PortfolioCreatorKnowledgeBase;
  public readonly actionGroup: PortfolioCreatorActionGroup;

  constructor(scope: Construct, id: string, props: PortfolioCreatorAgentProps = {}) {
    super(scope, id);

    // Create Knowledge Base
    this.knowledgeBase = new PortfolioCreatorKnowledgeBase(this, "KnowledgeBase");

    // Create Action Group
    this.actionGroup = new PortfolioCreatorActionGroup(this, "ActionGroup");

    // Create Agent
    this.agent = new BedrockAgent(this, "Agent", {
      agentName: "portfolio-creator-agent",
      description: "Agent for creating investment portfolios and analyzing company data",
      instruction: PORTFOLIO_CREATOR_INSTRUCTIONS,
      modelKey: props.modelKey || "claude-3-haiku",
      agentMode: props.agentMode || AgentMode.SUBAGENT,
      knowledgeBases: [
        {
          knowledgeBaseId: this.knowledgeBase.knowledgeBase.knowledgeBase.attrKnowledgeBaseId,
          description: "Knowledge base for company documents and FOMC reports",
        },
      ],
      actionGroups: [
        {
          actionGroupName: "portfolio-creator-action-group",
          description: "Action group for portfolio creation and company research",
        },
      ],
      additionalPolicies: PortfolioCreatorPermissions.getAgentPermissions(this.knowledgeBase.bucket.bucketArn),
    });

    // Output important information
    new cdk.CfnOutput(this, "AgentId", {
      value: this.agent.agent.attrAgentId,
      description: "Portfolio Creator Agent ID",
    });

    new cdk.CfnOutput(this, "AgentAliasId", {
      value: this.agent.agentAlias.attrAgentAliasId,
      description: "Portfolio Creator Agent Alias ID",
    });
  }
}
