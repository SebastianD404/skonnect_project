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
  it('persists the admin-verified GWA when approving grades', async () => {
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

    const request = createRequest({
        documentType: 'grades',
        action: 'APPROVE',
        reviewNotes: '',
        verifiedNoFailingGrades: true,
        verifiedNoFailingGradesCheck: true,
        verifiedNoIncGrades: true,
        verifiedNoDroppedSubjects: true,
        verifiedGwa: '91.5',
      });

    await POST(request, createContext('s1'));

    // Expect update called and included generalAverage
    expect(mockUpdate).toHaveBeenCalled();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(callArg.where).toEqual({ id: 's1' });
    expect(callArg.data).toBeDefined();
    expect(callArg.data.generalAverage).toBe(91.5);
  });

  it('accepts Philippine grading-scale GWA values', async () => {
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
    mockUpdate.mockResolvedValue({ ...submission, generalAverage: 1.25 });

    const request = createRequest({
        documentType: 'grades',
        action: 'APPROVE',
        reviewNotes: '',
        verifiedNoFailingGrades: true,
        verifiedNoFailingGradesCheck: true,
        verifiedNoIncGrades: true,
        verifiedNoDroppedSubjects: true,
        verifiedGwa: '1.25',
      });

    await POST(request, createContext('s2'));

    expect(mockUpdate).toHaveBeenCalled();
    const callArg = mockUpdate.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 's2' });
    expect(callArg.data.generalAverage).toBe(1.25);
  });

  it('rejects grade approval without the manual verification checklist', async () => {
    const request = createRequest({ documentType: 'grades', action: 'APPROVE', reviewNotes: '' });

    const res = await POST(request, createContext('s1'));
    const payload = await res.json();

    expect(payload).toHaveProperty('error');
    expect(payload.error).toContain('Confirm that you verified');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each([
    'verifiedNoFailingGradesCheck',
    'verifiedNoIncGrades',
    'verifiedNoDroppedSubjects',
  ])('rejects grade approval when %s is not confirmed', async (check) => {
    const request = createRequest({
      documentType: 'grades',
      action: 'APPROVE',
      verifiedNoFailingGrades: true,
      verifiedNoFailingGradesCheck: true,
      verifiedNoIncGrades: true,
      verifiedNoDroppedSubjects: true,
      verifiedGwa: '1.25',
      [check]: false,
    });

    const res = await POST(request, createContext('s1'));
    const payload = await res.json();

    expect(payload.error).toContain('Confirm that you verified');
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid verified GWA values', async () => {
    const request = createRequest({
        documentType: 'grades',
        action: 'APPROVE',
        verifiedNoFailingGrades: true,
        verifiedNoFailingGradesCheck: true,
        verifiedNoIncGrades: true,
        verifiedNoDroppedSubjects: true,
        verifiedGwa: '74',
      });

    const res = await POST(request, createContext('s1'));
    const payload = await res.json();

    expect(payload.error).toContain('Enter a valid verified GWA');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    { documentType: 'grades', coeStatus: 'PENDING', gradesStatus: 'APPROVED' },
    { documentType: 'coe', coeStatus: 'APPROVED', gradesStatus: 'PENDING' },
  ])('prevents returning an already approved $documentType document', async ({
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
      action: 'RETURN_FOR_UPDATE',
      reviewNotes: 'Please correct the document.',
    }), createContext('s1'));
    const payload = await res.json();

    expect(res.status).toBe(409);
    expect(payload.error).toContain('already been approved');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
