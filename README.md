# Start XRay with lambda TypeScript/Python/Go using ADOT  

Blog post explaining some [background](https://www.tecracer.com/blog/2022/12/spy/adot/)

ADOT=AWS Distro for OpenTelemetry

## Walkthrough

Assume you have cdk, node, python & go installed


1) Launch docker 

`task colima`

2) CDK bootstrap if not yet bootstrapped

`npm i`

`task boostrap`

3) Deploy

`task deploy`

4) Generate traffic

`task traffic`

5) Open Cloudwatch/XRay

E.g.:

`open https://eu-central-1.console.aws.amazon.com/cloudwatch/home?region=eu-central-1#xray:service-map/map`


## Install task.dev 

See # https://taskfile.dev


## Docker error

"pull access denied for public.ecr.aws/sam/build-nodejs16.x"

=> `docker logout public.ecr.aws`