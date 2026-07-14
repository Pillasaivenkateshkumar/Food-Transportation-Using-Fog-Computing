import assert from "node:assert/strict";
import test from "node:test";
import { AsyncQueue } from "../services/backend/queue.mjs";

test("AsyncQueue preserves FIFO ordering", async () => {
  const queue = new AsyncQueue();
  queue.enqueue("first");
  queue.enqueue("second");

  assert.equal(await queue.dequeue(), "first");
  assert.equal(await queue.dequeue(), "second");
});

test("AsyncQueue reports depth correctly", () => {
  const queue = new AsyncQueue();
  queue.enqueue({ id: 1 });
  queue.enqueue({ id: 2 });

  assert.equal(queue.depth, 2);
});
