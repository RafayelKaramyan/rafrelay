import { simulate, workSchema } from './model';

self.onmessage = (event: MessageEvent<unknown>) => {
  const parsed = workSchema.safeParse(event.data);
  if (!parsed.success) return;
  const work = parsed.data;
  const result = simulate(work);
  setTimeout(
    () =>
      self.postMessage({
        token: work.token,
        runId: work.runId,
        deliveryId: work.deliveryId,
        ...result,
      }),
    Math.max(80, result.latencyMs),
  );
};
