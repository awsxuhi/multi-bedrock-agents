import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ActionGroupProps {
  actionGroupName: string;
  description?: string;
  lambdaFunction: lambda.Function;
  apiSchema: string;
  additionalPolicies?: iam.PolicyStatement[];
}

export class ActionGroup extends Construct {
  public readonly actionGroup: cdk.CfnResource;

  constructor(scope: Construct, id: string, props: ActionGroupProps) {
    super(scope, id);

    // Create Action Group using CfnResource since CfnAgentActionGroup is not available
    this.actionGroup = new cdk.CfnResource(this, "ActionGroup", {
      type: "AWS::Bedrock::AgentActionGroup",
      properties: {
        ActionGroupName: props.actionGroupName,
        Description: props.description,
        ActionGroupExecutor: {
          Lambda: props.lambdaFunction.functionArn,
        },
        ApiSchema: {
          Payload: props.apiSchema,
        },
      },
    });

    // Grant Lambda permissions to be invoked by Bedrock
    props.lambdaFunction.addPermission("BedrockInvoke", {
      principal: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    // Output important information
    new cdk.CfnOutput(this, "ActionGroupId", {
      value: cdk.Fn.getAtt(this.actionGroup.logicalId, "ActionGroupId").toString(),
      description: "Bedrock Action Group ID",
    });
  }
}
