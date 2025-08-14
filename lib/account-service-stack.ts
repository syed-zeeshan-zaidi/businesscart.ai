import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "..", "account-service", ".env") });

export class AccountServiceStack extends cdk.Stack {
  public readonly handler: lambda.Function;
  public readonly api: apigw.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda
    this.handler = new lambda.Function(this, "AccountHandler", {
      runtime: lambda.Runtime.GO_1_X,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(join(__dirname, "..", "account-service"), {
        bundling: {
          image: lambda.Runtime.GO_1_X.bundlingImage,
          command: [
            "bash",
            "-c",
            "go build -o /asset-output/bootstrap ./cmd/server/main.go",
          ],
          user: "root",
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        MONGO_URI: process.env.MONGO_URI || "",
        JWT_SECRET: process.env.JWT_SECRET || "",
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
        NODE_ENV: "development",
      },
    });

    // API Gateway
    this.api = new apigw.RestApi(this, "AccountApi", {
      restApiName: "AccountService",
      deployOptions: { stageName: "prod" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization", "Cookie"],
      },
    });

    // Helper integration that forwards headers + body
    const integ = new apigw.LambdaIntegration(this.handler, {
      requestTemplates: {
        "application/json": JSON.stringify({
          resourcePath: "$context.resourcePath",
          httpMethod: "$context.httpMethod",
          pathParameters: "$input.params()",
          queryStringParameters: "$input.params()",
          headers: {
            "#foreach($h in $input.params().header.keySet())":
              '"$h": "$util.escapeJavaScript($input.params().header.get($h))"',
            "#if($foreach.hasNext),#end": "",
            "#end": "",
          },
          body: "$input.json('$')",
        }),
      },
    });

    // Routes (same style as checkout-service)
    const accounts = this.api.root.addResource("accounts");
    accounts.addResource("register").addMethod("POST", integ);
    accounts.addResource("login").addMethod("POST", integ);
    accounts.addResource("refresh").addMethod("POST", integ);
    accounts.addResource("logout").addMethod("POST", integ);
    accounts.addMethod("GET", integ);

    const accountById = accounts.addResource("{id}");
    accountById.addMethod("GET", integ);
    accountById.addMethod("PATCH", integ);
    accountById.addMethod("DELETE", integ);
    accountById.addMethod("PUT", integ);

    const codes = this.api.root.addResource("codes");
    codes.addMethod("POST", integ);
    const codeByCode = codes.addResource("{code}");
    codeByCode.addMethod("GET", integ);

    

    // Output
    new cdk.CfnOutput(this, "AccountApiUrl", { value: this.api.url });
  }
}