import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";

import { loadConfig } from "./config.mjs";

const config = await loadConfig();

const client = new SQSClient({
  region: config.aws.region
});

const queueUrl = config.aws.queueUrl;

/**
 * Send a telemetry batch to Amazon SQS
 */
export async function sendTelemetryMessage(batch) {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(batch)
  });

  await client.send(command);

  console.log("[SQS] Telemetry batch sent");
}

/**
 * Receive telemetry batches from Amazon SQS
 */
export async function receiveTelemetryMessages() {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 10
  });

  const response = await client.send(command);

  return response.Messages ?? [];
}

/**
 * Delete a processed message from Amazon SQS
 */
export async function deleteTelemetryMessage(receiptHandle) {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle
  });

  await client.send(command);

  console.log("[SQS] Message deleted");
}