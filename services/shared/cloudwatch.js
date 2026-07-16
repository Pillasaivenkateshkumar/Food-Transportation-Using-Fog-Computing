import {
  CloudWatchClient,
  PutMetricDataCommand
} from "@aws-sdk/client-cloudwatch";

const client = new CloudWatchClient({
  region: "us-east-1"
});

const NAMESPACE = "EdgeGuard";

export async function publishMetric(metricName, value, unit = "Count") {
  try {
    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date()
        }
      ]
    });

    await client.send(command);

    console.log(`[CloudWatch] ${metricName} = ${value}`);
  } catch (err) {
    console.error("[CloudWatch]", err.message);
  }
}