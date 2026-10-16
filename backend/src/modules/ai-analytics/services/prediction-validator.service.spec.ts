import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { PredictionValidatorService } from './prediction-validator.service';

describe('PredictionValidatorService', () => {
  const createService = () => {
    const prisma = {
      predictionValidation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue(undefined),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
      },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn() },
    };
    return {
      service: new PredictionValidatorService(prisma as unknown as PrismaService),
      prisma,
    };
  };

  it('reports accuracy as unknown when no outcomes are available', async () => {
    const { service, prisma } = createService();

    const report = await service.runValidation();

    expect(report.totalValidated).toBe(0);
    expect(report.isAccurate).toBeNull();
    expect(prisma.predictionValidation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects scores that are not probabilities', async () => {
    const { service, prisma } = createService();

    await expect(
      service.recordPrediction('user-1', 'assessment-1', 85),
    ).rejects.toThrow('predictedScore must be a finite probability between 0 and 1');
    expect(prisma.predictionValidation.create).not.toHaveBeenCalled();
  });
});
