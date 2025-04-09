import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { KnowledgeBase } from "../../common/constructs/knowledge-base";

export interface PortfolioCreatorKnowledgeBaseProps {
  bucketName?: string;
}

export class PortfolioCreatorKnowledgeBase extends Construct {
  public readonly knowledgeBase: KnowledgeBase;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PortfolioCreatorKnowledgeBaseProps = {}) {
    super(scope, id);

    // Create Knowledge Base
    this.knowledgeBase = new KnowledgeBase(this, "KnowledgeBase", {
      knowledgeBaseName: "portfolio-creator-knowledge-base",
      description: "Knowledge base for company documents and FOMC reports",
      embeddingModelKey: "titan-embedding",
      s3BucketName: props.bucketName,
      additionalPolicies: [
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel"],
          resources: ["*"],
        }),
      ],
    });

    this.bucket = this.knowledgeBase.bucket;

    // Output important information
    new cdk.CfnOutput(this, "KnowledgeBaseBucketName", {
      value: this.bucket.bucketName,
      description: "S3 Bucket Name for Portfolio Creator Knowledge Base",
    });
  }
}
