import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    $transaction: async (cb: any) => {
      // Execute the callback with a transaction-like object that forwards updates to our mocks
      return cb({ submission: { update: (...args: unknown[]) => mockUpdate(...args) } });
    },
  },
}));

// Mock supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'admin-user', email: 'admin@example.com' } } }),
    },
  }),
}));

// Mock ensureProfile
vi.mock('@/lib/auth', () => ({
  ensureProfile: async () => ({ id: 'admin-id', role: 'SK_OFFICIAL' }),
}));

// Import the POST handler after mocks
import { POST } from '../app/api/admin/submissions/[id]/review/route';

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
});

describe('admin review route', () => {
  it('persists grantee.generalAverage when submission becomes APPROVED and submission average missing', async () => {
    const submission = {
      id: 's1',
      coeFileUrl: 'coe.pdf',
      gradeFileUrl: 'grades.pdf',
      flaggedFields: [],
      status: 'PENDING',
      generalAverage: null,
      grantee: { generalAverage: 91.5 },
    };

    mockFindUnique.mockResolvedValue(submission);
    mockUpdate.mockResolvedValue({ ...submission, generalAverage: 91.5 });

    const request = {
      json: async () => ({ documentType: 'grades', action: 'APPROVE', reviewNotes: '' }),
    } as any;

    const context = { params: Promise.resolve({ id: 's1' }) } as any;

    const res = await POST(request, context);

    // Expect update called and included generalAverage
    expect(mockUpdate).toHaveBeenCalled();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(callArg.where).toEqual({ id: 's1' });
    expect(callArg.data).toBeDefined();
    expect(callArg.data.generalAverage).toBe(91.5);
  });

  it('persists gradeRows average when submission becomes APPROVED and submission average missing', async () => {
    const submission = {
      id: 's2',
      coeFileUrl: 'coe.pdf',
      gradeFileUrl: 'grades.pdf',
      flaggedFields: [],
      status: 'PENDING',
      generalAverage: null,
      gradeRows: [
        { subject: 'Math', grade: 90 },
        { subject: 'Science', grade: 95 },
      ],
      grantee: { generalAverage: null },
    };

    mockFindUnique.mockResolvedValue(submission);
    mockUpdate.mockResolvedValue({ ...submission, generalAverage: 92.5 });

    const request = {
      json: async () => ({ documentType: 'grades', action: 'APPROVE', reviewNotes: '' }),
    } as any;

    const context = { params: Promise.resolve({ id: 's2' }) } as any;

    const res = await POST(request, context);

    expect(mockUpdate).toHaveBeenCalled();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 's2' });
    expect(callArg.data.generalAverage).toBe(92.5);
  });

  it('rejects grade approval when submission and grantee average are both missing', async () => {
    const submission = {
      id: 's1',
      coeFileUrl: 'coe.pdf',
      gradeFileUrl: 'grades.pdf',
      flaggedFields: [],
      status: 'PENDING',
      generalAverage: null,
      grantee: { generalAverage: null },
    };

    mockFindUnique.mockResolvedValue(submission);

    const request = {
      json: async () => ({ documentType: 'grades', action: 'APPROVE', reviewNotes: '' }),
    } as any;

    const context = { params: Promise.resolve({ id: 's1' }) } as any;

    const res = await POST(request, context);
    const payload = await res.json();

    expect(payload).toHaveProperty('error');
    expect(payload.error).toContain('Cannot approve this submission');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
