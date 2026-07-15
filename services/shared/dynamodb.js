import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "us-east-1"
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "EdgeGuardTelemetry";

/**
 * Save one telemetry record
 */
export async function saveTelemetry(record) {

  try {

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record
      })
    );

    console.log(
      `[DynamoDB] Saved ${record.vehicleId} (${record.timestamp})`
    );

  } catch (err) {

    console.error(
      "[DynamoDB] Failed to save telemetry"
    );

    console.error(err);

    throw err;

  }

}

/**
 * Get telemetry history for one vehicle
 */
export async function getTelemetry(vehicleId) {

  try {

    const response = await docClient.send(
      new QueryCommand({

        TableName: TABLE_NAME,

        KeyConditionExpression:
          "vehicleId = :vehicleId",

        ExpressionAttributeValues: {

          ":vehicleId": vehicleId

        }

      })
    );

    return response.Items ?? [];

  } catch (err) {

    console.error(
      "[DynamoDB] Query failed"
    );

    console.error(err);

    throw err;

  }

}