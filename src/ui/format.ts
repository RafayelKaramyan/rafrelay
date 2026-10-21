export const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);
export const date = (at: number) =>
  new Date(at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
export const policyNames = {
  healthy: 'Healthy',
  intermittent: 'Intermittent',
  unavailable: 'Unavailable',
  rate_limited: 'Rate limited',
};
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The action could not be completed.';
