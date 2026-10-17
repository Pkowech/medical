import { EnrollmentStatus, ProgressStatus } from '@prisma/client';
import { MasteryGateService, MAX_ACTIVE_UNITS } from './mastery-gate.service';

describe('MasteryGateService active unit enrollment', () => {
  const transaction = {
    unit: {
      findUnique: jest.fn(),
    },
    courseEnrollment: {
      findFirst: jest.fn(),
    },
    progress: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };

  let service: MasteryGateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MasteryGateService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    transaction.unit.findUnique.mockResolvedValue({
      id: 'unit-37',
      courseId: 'course-1',
    });
    transaction.courseEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      status: EnrollmentStatus.active,
    });
    transaction.progress.findFirst.mockResolvedValue(null);
    transaction.progress.findMany.mockResolvedValue([]);
    transaction.progress.create.mockResolvedValue({});
    transaction.progress.update.mockResolvedValue({});
  });

  it('enforces the server-owned limit of 36 active units', async () => {
    transaction.progress.findMany.mockResolvedValue(
      Array.from({ length: MAX_ACTIVE_UNITS }, (_, index) => ({
        unitId: `unit-${index + 1}`,
      })),
    );

    await expect(service.activateUnit('user-1', 'unit-37')).resolves.toEqual({
      success: false,
      maxActiveUnits: 36,
      message: 'You already have 36 active units. Remove one before starting another.',
    });
    expect(transaction.progress.create).not.toHaveBeenCalled();
  });

  it('rejects activation when the active-unit count cannot be checked', async () => {
    transaction.progress.findMany.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      service.activateUnit('user-1', 'unit-37'),
    ).rejects.toThrow('database unavailable');
    expect(transaction.progress.create).not.toHaveBeenCalled();
  });

  it('allows a learner to remove an active unit without deleting its progress', async () => {
    transaction.progress.findFirst.mockResolvedValue({
      id: 'unit-progress-1',
      status: ProgressStatus.inProgress,
      progressPercentage: 45,
      timeSpent: 60,
    });

    await expect(
      service.deactivateUnit('user-1', 'unit-1'),
    ).resolves.toEqual({
      success: true,
      message: 'Unit removed from your active learning list. Progress was kept.',
    });
    expect(transaction.progress.update).toHaveBeenCalledWith({
      where: { id: 'unit-progress-1' },
      data: { status: ProgressStatus.dropped },
    });
    expect(transaction.progress.create).not.toHaveBeenCalled();
  });
});
