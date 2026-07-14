import fs from "node:fs/promises";
import path from "node:path";
import { safeJsonParse } from "../shared/utils.mjs";

export class FogBufferStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "[]", "utf8");
    }
  }

  async readAll() {
    await this.ensure();
    const content = await fs.readFile(this.filePath, "utf8");
    return safeJsonParse(content, []);
  }

  async writeAll(batches) {
    await this.ensure();
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(batches, null, 2), "utf8");
    await fs.rename(temporaryPath, this.filePath);
  }

  async append(batch) {
    const batches = await this.readAll();
    batches.push(batch);
    await this.writeAll(batches);
    return batches.length;
  }
}
