import { join } from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_dynamodb, aws_iam, aws_lambda, aws_lambda_event_sources, aws_logs, aws_s3, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';
import * as aws_sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as s3_notifications from 'aws-cdk-lib/aws-s3-notifications';



export class XraystarterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // *** TypeScript ***
    const layerTS = "arn:aws:lambda:"+this.region+":901920570463:layer:aws-otel-nodejs-amd64-ver-1-7-0:2"

    const fnTS = new NodejsFunction(this, "adotstarter-ts", {
      entry: 'lambda/ts/index.ts',
      functionName: "adotstarter-ts",
      handler: 'lambdaHandler',
      runtime: aws_lambda.Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: Duration.seconds(3),
      description: "adotstarter-ts",
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      tracing: aws_lambda.Tracing.ACTIVE, 
      //  The requested image's platform (linux/amd64) does not match
      // the detected host platform (linux/arm64/v8) and no specific platform was requested
      bundling: {
        environment: {
          DOCKER_DEFAULT_PLATFORM: "linux/amd64"
        }
      },
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-handler"
      },      
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(this, "layerts",layerTS)
      ],
      architecture: aws_lambda.Architecture.X86_64,
    })

    fnTS.addToRolePolicy( new aws_iam.PolicyStatement(
      {
        sid: "xraywrite",
        actions: [
          "xray:*"
        ],
        resources: ["*"],
        effect: aws_iam.Effect.ALLOW,
      }
    ))
    new CfnOutput(this, "LambdaNameTS", {
      value: fnTS.functionName,
      exportName: 'adotstarter-ts-name',
    })

    // *** Python ***
    const layerPy = "arn:aws:lambda:"+this.region+":901920570463:layer:aws-otel-python-amd64-ver-1-14-0:1"

    const fnPy = new PythonFunction(this, 'adotstarter-py', {
      entry: './lambda/py', // required
      functionName: "adotstarter-py",
      index: 'app.py',
      handler: 'lambda_handler',
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      memorySize: 1024,
      timeout: Duration.seconds(3),
      description: 'adotstarter-py',
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument"
      },
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(this, "layerpy",layerPy)
      ],
      tracing: aws_lambda.Tracing.ACTIVE,
    });

 
    new CfnOutput(this, 'LambdaNamePy', {
      value: fnPy.functionName,
      exportName: 'adotstarter-py-name',
    });

    
    // *** GO ***
    const layerGo = "arn:aws:lambda:"+this.region+":901920570463:layer:aws-otel-collector-amd64-ver-0-62-1:1"

    const fnGO = new aws_lambda.Function(this, 'adotstarter-go', {
      code: aws_lambda.Code.fromAsset(join(__dirname, '../lambda/go/dist/main.zip')),
      handler: 'main',
      functionName: "adotstarter-go",
      description: 'adotstarter-go',
      memorySize: 1024,
      timeout: Duration.seconds(3),
      logRetention: aws_logs.RetentionDays.ONE_MONTH,
      layers: [
        aws_lambda.LayerVersion.fromLayerVersionArn(this, "layerGO",layerGo)
      ],
      runtime: aws_lambda.Runtime.PROVIDED_AL2,
      tracing: aws_lambda.Tracing.ACTIVE,
    });
    new CfnOutput(this, 'LambdaNameGo', {
      value: fnGO.functionName,
      exportName: 'adotstarter-GO-name',
    });
    


    // Bucket start ****************
    // *
    const bucky = new aws_s3.Bucket(this, 'incoming', {
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
    });
    new CfnOutput(this, 'BucketName', {
      value: bucky.bucketName,
    });
    // Tell Lambda the dynamic bucket name
    fnTS.addEnvironment('Bucket', bucky.bucketName);
    fnPy.addEnvironment('Bucket', bucky.bucketName);
    fnGO.addEnvironment('Bucket', bucky.bucketName);

    // *
    // give lambda read rights
    bucky.grantRead(fnTS);
    bucky.grantRead(fnPy);
    bucky.grantRead(fnGO);
    // *
    // Bucket end *******************

    // Event start *******************
    const topic = new aws_sns.Topic(this, 's3eventTopic');
    
    bucky.addEventNotification(
      aws_s3.EventType.OBJECT_CREATED,
      new s3_notifications.SnsDestination(topic)
      )
      // Event End   *******************
      
      //** Dynamodb start */
      const table = new aws_dynamodb.Table(this, 'items', {
        partitionKey: {
          name: 'itemID',
          type: aws_dynamodb.AttributeType.STRING,
        },
        tableName: 'items',
        removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
        billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      });
      
    const functions = [fnTS, fnPy, fnGO]
    functions.forEach(function(value){
      topic.addSubscription(new subscriptions.LambdaSubscription(value));
      value.addEnvironment('TableName', table.tableName);
      table.grantReadWriteData(value);
      value.addToRolePolicy( new aws_iam.PolicyStatement(
        {
          sid: "xraywrite",
          actions: [
            "xray:*"
          ],
          resources: ["*"],
          effect: aws_iam.Effect.ALLOW,
        }
      ))
    })

    
    new CfnOutput(this, 'TableName', {
      value: table.tableName,
    });
    //** Dynamodb End */
  }
}
