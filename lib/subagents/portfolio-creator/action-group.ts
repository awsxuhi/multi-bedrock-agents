import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { LambdaFunction, RuntimeLanguage } from "../../common/constructs/lambda-function";
import { ActionGroup } from "../../common/constructs/action-group";
import { PortfolioCreatorPermissions } from "./permissions";
import { ACTION_GROUP_SCHEMA } from "./schema";

export interface PortfolioCreatorActionGroupProps {
  functionName?: string;
  agentId?: string; // 添加可选的agentId参数
}

export class PortfolioCreatorActionGroup extends Construct {
  public readonly actionGroup: ActionGroup;
  public readonly lambda: LambdaFunction;

  constructor(scope: Construct, id: string, props: PortfolioCreatorActionGroupProps = {}) {
    super(scope, id);

    // Create Python Lambda function
    this.lambda = new LambdaFunction(this, "Lambda", {
      functionName: props.functionName || "portfolio-creator-lambda",
      description: "Portfolio Creator Action Group Lambda",
      codePath: path.join(__dirname, "lambda"),
      handler: "index.lambda_handler",
      language: RuntimeLanguage.PYTHON,
      languageVersion: "3.12",
      timeout: cdk.Duration.seconds(60),
      additionalPolicies: PortfolioCreatorPermissions.getLambdaPermissions(),
    });

    // Create Action Group
    this.actionGroup = new ActionGroup(this, "ActionGroup", {
      actionGroupName: "portfolio-creator-action-group",
      description: "Action group for portfolio creation and company research",
      lambdaFunction: this.lambda.function,
      apiSchema: ACTION_GROUP_SCHEMA,
      agentId: props.agentId, // 传递agentId参数
    });
  }
}
