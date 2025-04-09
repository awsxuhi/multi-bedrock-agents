import * as iam from "aws-cdk-lib/aws-iam";

export class BasePermissions {
  // 基础Bedrock权限
  public static getBedrockBasePermissions(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeAgent"],
      resources: ["*"],
    });
  }

  // 基础Lambda权限
  public static getLambdaInvokePermission(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      actions: ["lambda:InvokeFunction"],
      resources: ["*"],
    });
  }

  // 基础S3权限
  public static getS3ReadPermission(bucketArn?: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:ListBucket"],
      resources: bucketArn ? [bucketArn, `${bucketArn}/*`] : ["*"],
    });
  }

  // 基础CloudWatch Logs权限
  public static getCloudWatchLogsPermission(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      resources: ["*"],
    });
  }
}
