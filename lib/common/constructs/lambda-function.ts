import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { Construct } from "constructs";

export enum RuntimeLanguage {
  PYTHON = "python",
  NODEJS = "nodejs",
}

export interface LambdaFunctionProps {
  functionName: string;
  description?: string;
  codePath: string;
  handler: string;
  language: RuntimeLanguage;
  languageVersion?: string; // 例如 '3.12' 或 '22'
  timeout?: cdk.Duration;
  memorySize?: number;
  environment?: Record<string, string>;
  additionalPolicies?: iam.PolicyStatement[];
}

export class LambdaFunction extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);

    // 根据语言和版本确定运行时
    let runtime: lambda.Runtime;

    if (props.language === RuntimeLanguage.PYTHON) {
      switch (props.languageVersion) {
        case "3.12":
          runtime = lambda.Runtime.PYTHON_3_12;
          break;
        case "3.11":
          runtime = lambda.Runtime.PYTHON_3_11;
          break;
        case "3.10":
          runtime = lambda.Runtime.PYTHON_3_10;
          break;
        default:
          runtime = lambda.Runtime.PYTHON_3_12; // 默认使用Python 3.12
      }
    } else if (props.language === RuntimeLanguage.NODEJS) {
      switch (props.languageVersion) {
        case "22":
          runtime = lambda.Runtime.NODEJS_22_X;
          break;
        case "20":
          runtime = lambda.Runtime.NODEJS_20_X;
          break;
        case "18":
          runtime = lambda.Runtime.NODEJS_18_X;
          break;
        default:
          runtime = lambda.Runtime.NODEJS_22_X; // 默认使用Node.js 22
      }
    } else {
      throw new Error(`Unsupported language: ${props.language}`);
    }

    // 创建Lambda函数
    this.function = new lambda.Function(this, "Function", {
      functionName: props.functionName,
      description: props.description,
      runtime: runtime,
      handler: props.handler,
      code: lambda.Code.fromAsset(props.codePath),
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 128,
      environment: props.environment,
    });

    // 添加额外的策略
    if (props.additionalPolicies) {
      props.additionalPolicies.forEach((policy, index) => {
        this.function.addToRolePolicy(policy);
      });
    }
  }
}
