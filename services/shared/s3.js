import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-1"
});

const bucketName = "edgeguard-telemetry-2026";

export async function uploadTelemetry(key, data) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json"
  });

  await client.send(command);

  console.log(`[S3] Uploaded ${key}`);
}