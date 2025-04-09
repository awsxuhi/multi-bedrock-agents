import * as iam from "aws-cdk-lib/aws-iam";
import { BasePermissions } from "../common/permissions/base-permissions";

export class SupervisorPermissions {
  // Get all permissions needed for the Supervisor Agent
  public static getAgentPermissions(): iam.PolicyStatement[] {
    return [
      BasePermissions.getBedrockBasePermissions(),
      // Additional permissions specific to Supervisor Agent
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeAgent", "bedrock:Retrieve"],
        resources: ["*"],
      }),
    ];
  }
}
