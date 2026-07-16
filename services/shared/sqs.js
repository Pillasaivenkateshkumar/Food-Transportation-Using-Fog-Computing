import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: "us-east-1"
});

const queueUrl = process.env.QUEUE_URL;

export async function sendTelemetryMessage(batch) {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(batch)
  });

  await client.send(command);
}

export async function receiveTelemetryMessages() {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 10
  });

  const response = await client.send(command);

  return response.Messages ?? [];
}

export async function deleteTelemetryMessage(receiptHandle) {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle
  });

  await client.send(command);
}