import * as iam from "aws-cdk-lib/aws-iam";
import { BasePermissions } from "../../common/permissions/base-permissions";

export class PortfolioCreatorPermissions {
  // Get all permissions needed for the Portfolio Creator Agent
  public static getAgentPermissions(knowledgeBaseBucketArn?: string): iam.PolicyStatement[] {
    return [
      BasePermissions.getBedrockBasePermissions(),
      BasePermissions.getLambdaInvokePermission(),
      BasePermissions.getS3ReadPermission(knowledgeBaseBucketArn),
      // Additional permissions specific to Portfolio Creator
      new iam.PolicyStatement({
        actions: [
          "ses:SendEmail", // For sending emails
          "bedrock:RetrieveAndGenerate", // For knowledge base retrieval
        ],
        resources: ["*"],
      }),
    ];
  }

  // Get permissions needed for the Portfolio Creator Lambda
  public static getLambdaPermissions(): iam.PolicyStatement[] {
    return [
      // Permissions specific to Lambda
      BasePermissions.getCloudWatchLogsPermission(),
      new iam.PolicyStatement({
        actions: [
          "ses:SendEmail", // For sending emails
        ],
        resources: ["*"],
      }),
    ];
  }
}
