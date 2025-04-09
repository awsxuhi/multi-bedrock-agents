import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { ModelRegistry } from "../models/model-registry";

export interface KnowledgeBaseProps {
  knowledgeBaseName: string;
  description?: string;
  embeddingModelKey: string; // Key from ModelRegistry
  s3BucketName?: string; // If provided, use existing S3 bucket, otherwise create new one
  additionalPolicies?: iam.PolicyStatement[];
}

export class KnowledgeBase extends Construct {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    // Get embedding model ID from ModelRegistry
    const embeddingModelId = ModelRegistry.getModelId(props.embeddingModelKey);

    // Create or use existing S3 bucket
    if (props.s3BucketName) {
      this.bucket = s3.Bucket.fromBucketName(this, "ImportedBucket", props.s3BucketName) as s3.Bucket;
    } else {
      this.bucket = new s3.Bucket(this, "KnowledgeBaseBucket", {
        removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
        autoDeleteObjects: true, // For development; set to false for production
      });
    }

    // Create Knowledge Base role
    const kbRole = this.createKnowledgeBaseRole(props);

    // Create Knowledge Base using 'any' type to bypass type checking
    // This is a temporary solution until we can properly determine the correct types
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: props.knowledgeBaseName,
      description: props.description,
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: embeddingModelId,
        },
      },
    } as any);

    // Add S3 bucket configuration using CloudFormation escape hatch
    const cfnKnowledgeBase = this.knowledgeBase.node.defaultChild as cdk.CfnResource;
    cfnKnowledgeBase.addPropertyOverride("StorageConfiguration", {
      Type: "S3",
      S3Configuration: {
        BucketArn: this.bucket.bucketArn,
      },
    });

    // Output important information
    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: this.knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID",
    });

    new cdk.CfnOutput(this, "KnowledgeBaseBucketName", {
      value: this.bucket.bucketName,
      description: "S3 Bucket Name for Knowledge Base",
    });
  }

  private createKnowledgeBaseRole(props: KnowledgeBaseProps): iam.Role {
    const role = new iam.Role(this, "KnowledgeBaseRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
    });

    // Add S3 access permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
        resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
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
