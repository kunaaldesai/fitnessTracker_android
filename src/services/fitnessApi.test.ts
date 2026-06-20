import { describe, expect, it, vi } from 'vitest';

import { buildApiUrl, createFitnessApiClient } from './fitnessApi';

vi.mock('@/services/authService', () => ({
  getCurrentIdToken: vi.fn(async () => 'mock-token'),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fitnessApi', () => {
  it('builds API URLs while omitting empty query values', () => {
    expect(
      buildApiUrl('https://api.example.com/root', '/api/fitness/day/', {
        date: '2026-06-20',
        q: '',
        page: 2,
        ignored: null,
      }),
    ).toBe('https://api.example.com/api/fitness/day/?date=2026-06-20&page=2');
  });

  it('attaches bearer tokens and GET query params', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: 'ok', error: null, user: {}, day: {}, summary: {}, exercises: [] }),
    );
    const client = createFitnessApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'id-token',
      fetchImpl,
    });

    await client.getDay('2026-06-20');

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/fitness/day/?date=2026-06-20', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer id-token',
      },
      body: undefined,
    });
  });

  it('sends JSON bodies for mutations', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        status: 'ok',
        error: null,
        user: {},
        profile: {},
        metrics: {},
        missing_fields: {},
        activity_level_options: [],
        bmr_formula_options: [],
      }),
    );
    const client = createFitnessApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'id-token',
      fetchImpl,
    });

    await client.saveProfile({ weight_lbs: 180, activity_level: 'moderate' });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/api/fitness/profile/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer id-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ weight_lbs: 180, activity_level: 'moderate' }),
    });
  });

  it('returns backend error envelopes without throwing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'error', error: 'Not authenticated' }, 401));
    const client = createFitnessApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'expired-token',
      fetchImpl,
    });

    await expect(client.getRecords({ page: 1 })).resolves.toEqual({
      status: 'error',
      error: 'Not authenticated',
    });
  });

  it('falls back to an HTTP status error when the server response is not JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('No JSON');
      },
    } as unknown as Response));
    const client = createFitnessApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'id-token',
      fetchImpl,
    });

    await expect(client.getAnalytics({ range: '30d' })).resolves.toEqual({
      status: 'error',
      error: 'Request failed (500).',
    });
  });
});
