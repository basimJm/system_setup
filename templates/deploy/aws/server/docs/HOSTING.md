# Hosting: AWS (ECS on Fargate)

`ecs-task-definition.json` in `__PART_DIR__` is a Fargate task definition for the image the template builds. Every `<...>` is yours to fill in; every secret is a reference to a Parameter Store entry, never a value.

1. Create an ECR repository `__SERVICE_NAME__`, then `docker build -t __SERVICE_NAME__ .` here and push the image; put its URI and tag in `image`.
2. Create the task execution role (the managed `AmazonECSTaskExecutionRolePolicy` plus read access to the parameters) and put its ARN in `executionRoleArn`.
3. Create one Parameter Store entry (SecureString) per key and keep the names in `secrets`: __ENV_KEYS__. Keys that are not secret (`NODE_ENV`, `LOG_LEVEL`) can move to `environment`.
4. The server needs MongoDB and Redis reachable from the task's subnets (`MONGODB_URI`, `REDIS_URL`).
5. `aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json`, then create a service behind an Application Load Balancer whose target group health check is `__PART_HEALTH__` on port __PART_PORT__.
6. App Runner is the lighter option: create the service from the same ECR image with port __PART_PORT__ and health check `__PART_HEALTH__`; set the same keys as secrets in its console.
7. First boot: `npm run seed` and `npm run seed:admin` once (an ECS exec session or a one-off task).
