import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from "next/server";

// Mock prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
    $transaction: async (cb: (tx: unknown) => unknown) => {
      // Execute the callback with a transaction-like object that forwards updates to our mocks
      return cb({
        submission: {
          findUnique: async () => ({ grantee: { status: "ACTIVE" } }),
          update: (...args: unknown[]) => mockUpdate(...args),
        },
        auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
      });
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

function createRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockAuditCreate.mockReset();
});

describe('admin review route', () => {
  it('approves grades without requiring or writing a GWA', async () => {
    const submission = {
      id: 's1',
      coeFileUrl: 'coe.pdf',
      gradeFileUrl: 'grades.pdf',
      flaggedFields: [],
      status: 'PENDING',
      coeStatus: 'APPROVED',
      gradesStatus: 'PENDING',
      generalAverage: null,
      grantee: { status: 'ACTIVE' },
    };

    mockFindUnique.mockResolvedValue(submission);
    mockUpdate.mockResolvedValue({
      ...submission,
      status: 'APPROVED',
      gradesStatus: 'APPROVED',
    });

    const request = createRequest({
      documentType: 'grades',
      action: 'APPROVE',
      reviewNotes: '',
    });

    const response = await POST(request, createContext('s1'));

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(callArg.where).toEqual({ id: 's1' });
    expect(callArg.data.status).toBe('APPROVED');
    expect(callArg.data).not.toHaveProperty('generalAverage');
    expect(callArg.data.requiresStrictManualReview).toBe(false);
  });

  it.each([
    { documentType: 'grades', coeStatus: 'PENDING', gradesStatus: 'APPROVED' },
    { documentType: 'coe', coeStatus: 'APPROVED', gradesStatus: 'PENDING' },
  ])('prevents approving an already approved $documentType document', async ({
    documentType,
    coeStatus,
    gradesStatus,
  }) => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      coeFileUrl: 'coe.pdf',
      gradeFileUrl: 'grades.pdf',
      flaggedFields: [],
      status: 'PENDING',
      coeStatus,
      gradesStatus,
      generalAverage: 90,
      grantee: { generalAverage: 90 },
    });

    const res = await POST(createRequest({
      documentType,
      action: 'APPROVE',
      reviewNotes: 'Please correct the document.',
    }), createContext('s1'));
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error).toContain('already been approved');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
