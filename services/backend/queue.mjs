export class AsyncQueue {
  #items = [];
  #resolvers = [];

  enqueue(item) {
    const waiter = this.#resolvers.shift();

    if (waiter) {
      waiter(item);
      return;
    }

    this.#items.push(item);
  }

  async dequeue() {
    if (this.#items.length) {
      return this.#items.shift();
    }

    return new Promise((resolve) => {
      this.#resolvers.push(resolve);
    });
  }

  get depth() {
    return this.#items.length;
  }
}
