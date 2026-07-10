
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ProgressService } from '../src/modules/education/courses/services/progress.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';

describe('ProgressService Debug', () => {
  let progressService: ProgressService;
  let prisma: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    progressService = module.get<ProgressService>(ProgressService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should reproduce the database error in getUserProgress', async () => {
    const courseId = '09fb9f6a-b96d-4d56-b24c-02796c9ad989';
    
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { courseId }
    });
    
    if (!enrollment) {
      console.log('No enrollment found for course', courseId);
      return;
    }
    
    console.log('Testing with userId:', enrollment.userId);
    
    try {
      const result = await progressService.getUserProgress(enrollment.userId, courseId);
      console.log('Result found, length:', JSON.stringify(result).length);
    } catch (e: any) {
      console.log('--- REPRODUCED ERROR ---');
      console.log('Code:', e.code);
      console.log('Message:', e.message);
      if (e.meta) console.log('Meta:', JSON.stringify(e.meta));
      console.log('Stack:', e.stack);
      console.log('------------------------');
      throw e;
    }
  });
});
