declare module 'ai/rsc' {
  export interface StreamableValue<T = unknown> {
    value: ReadableStream<T>;
    update(value: T): void;
    done(): void;
  }

  export function createStreamableValue<T = string>(
    initialValue?: T
  ): StreamableValue<T>;

  export function readStreamableValue<T = string>(
    streamable: StreamableValue<T>
  ): AsyncIterable<T>;
}

