/**
 * learning-paths.seed.ts
 *
 * Seeds authentic, real-world healthcare learning paths for Pharmacy, Nursing, and Medicine.
 * Includes Kenyatta University BPharm Level IV Trimester III Clinical Clerkship (PPF 430 / PPF 433).
 */

import 'dotenv/config';
import {
  PrismaClient,
  CourseStatus,
  CourseDifficulty,
  LearningPathType,
} from '@prisma/client';
import { createSeedPrisma } from './seed-db';

const { pool: _pool, prisma } = createSeedPrisma();

export async function seedLearningPaths() {
  console.log('🌿 Seeding authentic Healthcare Learning Paths...');

  // 1. Get or create Admin user for path authoring
  let admin = await prisma.user.findFirst({
    where: { email: 'admin@medical.edu' },
  });

  if (!admin) {
    admin = await prisma.user.findFirst();
  }

  const adminId = admin ? admin.id : null;

  // 2. Ensure Categories exist
  const categoriesToEnsure = [
    { slug: 'clinical-pharmacy', name: 'Clinical Pharmacy' },
    { slug: 'pharmacology', name: 'Pharmacology' },
    { slug: 'nursing', name: 'Nursing' },
    { slug: 'internal-medicine', name: 'Internal Medicine' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesToEnsure) {
    const record = await prisma.courseCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: {
        slug: cat.slug,
        name: cat.name,
        description: `${cat.name} curricula and learning pathways`,
      },
    });
    categoryMap.set(cat.slug, record.id);
  }

  // 3. Find relevant courses to link
  const ppf420 = await prisma.course.findFirst({ where: { code: 'PPF-420' } });
  const ppb420 = await prisma.course.findFirst({ where: { code: 'PPB-420' } });
  const ppb520 = await prisma.course.findFirst({ where: { code: 'PPB-520' } });
  const hmb110 = await prisma.course.findFirst({ where: { code: 'HMB-110' } });

  // Fallback course ID if specific codes are not yet seeded
  const defaultCourse = ppf420 || ppb420 || (await prisma.course.findFirst());
  const defaultCourseId = defaultCourse ? defaultCourse.id : 'course-placeholder-1';

  // 4. Learning Path 1: Kenyatta University BPharm Level IV Trimester III Clerkship
  const bpharmPathStructure = {
    phases: [
      {
        id: 'phase-1-neuro',
        title: 'Foundation & Neuropharmacology Clerkship (Weeks 1-5)',
        description:
          'Inpatient neurological clerkship covering SOAPE formulation, ischemic/hemorrhagic stroke, epilepsy, and movement disorders.',
        order: 1,
        modules: [
          {
            id: 'mod-ppf430-theory',
            title: 'PPF 433: Neurological Disorders Pharmacotherapy',
            type: 'course',
            resourceId: ppf420 ? ppf420.id : defaultCourseId,
            order: 1,
            estimatedMinutes: 600,
          },
          {
            id: 'mod-stroke-clerkship',
            title: 'Clinical Case: Acute Ischemic Stroke & Emergency Thrombolysis Protocol',
            type: 'clinical_case',
            resourceId: 'case-stroke-management-01',
            order: 2,
            estimatedMinutes: 180,
          },
          {
            id: 'mod-cat-1',
            title: 'Continuous Assessment Test 1 (CAT 1): Neuropharmacology & AED Selection',
            type: 'milestone',
            resourceId: 'milestone-cat-1-neuro',
            order: 3,
            estimatedMinutes: 60,
          },
        ],
      },
      {
        id: 'phase-2-msk',
        title: 'Neurodegenerative & Musculoskeletal Disorders (Weeks 6-10)',
        description:
          'Pharmacotherapy of dementia, migraine, rheumatoid arthritis, osteoarthritis, and gout hyperuricemia management.',
        order: 2,
        modules: [
          {
            id: 'mod-ppb420-chemo',
            title: 'PPB 420: Systemic Pharmacotherapy & Biological DMARDs',
            type: 'course',
            resourceId: ppb420 ? ppb420.id : defaultCourseId,
            order: 1,
            estimatedMinutes: 500,
          },
          {
            id: 'mod-ra-case',
            title: 'Clinical Case: Severe Rheumatoid Arthritis Escalation & Safety Monitoring',
            type: 'clinical_case',
            resourceId: 'case-ra-escalation-02',
            order: 2,
            estimatedMinutes: 180,
          },
          {
            id: 'mod-cat-2',
            title: 'Continuous Assessment Test 2 (CAT 2): Musculoskeletal Pharmacotherapy',
            type: 'milestone',
            resourceId: 'milestone-cat-2-msk',
            order: 3,
            estimatedMinutes: 60,
          },
        ],
      },
      {
        id: 'phase-3-ward-rounds',
        title: 'Kiambu Hospital Ward Clerkship, Case Defense & Final Exam (Weeks 11-14)',
        description:
          '105 hours of inpatient ward rounds at Kiambu Level 5 Hospital, prescription audit, case defense, and oral examination.',
        order: 3,
        modules: [
          {
            id: 'mod-kiambu-rounds',
            title: 'Kiambu Level 5 Hospital: Inpatient Ward Rounds & Prescription Audit',
            type: 'clinical_case',
            resourceId: 'case-kiambu-inpatient-rounds',
            order: 1,
            estimatedMinutes: 1200,
          },
          {
            id: 'mod-final-written',
            title: 'Final Written Examination: PPF 433 Clinical Pharmacy III',
            type: 'assessment',
            resourceId: 'assessment-final-written-ppf433',
            order: 2,
            estimatedMinutes: 180,
          },
          {
            id: 'mod-viva-voce',
            title: 'Final Clinical Oral Examination (VIVA VOCE) & Case Defense',
            type: 'milestone',
            resourceId: 'milestone-viva-voce-clerkship',
            order: 3,
            estimatedMinutes: 60,
          },
        ],
      },
    ],
  };

  const bpharmPath = await prisma.learningPath.upsert({
    where: { id: 'path-bpharm-iv-clerkship' },
    update: {
      title: 'BPharm Level IV: Clinical Pharmacy & Clerkship (Trimester III)',
      description:
        '14-week accredited clinical clerkship curriculum integrating hospital ward rounds at Kiambu Level 5 Hospital, SOAPE case presentation, therapeutic drug monitoring, and continuous assessment tests for Neurological & Musculoskeletal Disorders (PPF 430 / PPF 433).',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 14,
      estimatedHoursPerWeek: 12,
      status: CourseStatus.published,
      specialization: 'Clinical Pharmacy',
      pathType: LearningPathType.CLINICAL_COMPETENCY,
      categoryId: categoryMap.get('clinical-pharmacy'),
      createdBy: adminId,
    },
    create: {
      id: 'path-bpharm-iv-clerkship',
      title: 'BPharm Level IV: Clinical Pharmacy & Clerkship (Trimester III)',
      description:
        '14-week accredited clinical clerkship curriculum integrating hospital ward rounds at Kiambu Level 5 Hospital, SOAPE case presentation, therapeutic drug monitoring, and continuous assessment tests for Neurological & Musculoskeletal Disorders (PPF 430 / PPF 433).',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 14,
      estimatedHoursPerWeek: 12,
      status: CourseStatus.published,
      specialization: 'Clinical Pharmacy',
      pathType: LearningPathType.CLINICAL_COMPETENCY,
      categoryId: categoryMap.get('clinical-pharmacy'),
      createdBy: adminId,
    },
  });

  // 5. Learning Path 2: BPharm Level IV Chemotherapy & Systemic Pharmacotherapy
  const chemoPathStructure = {
    phases: [
      {
        id: 'phase-1-antimicrobial',
        title: 'Antimicrobial Stewardship & Chemotherapy (Weeks 1-6)',
        description: 'Chemotherapy of bacterial, parasitic, and viral infections.',
        order: 1,
        modules: [
          {
            id: 'mod-ppb420-chemo-full',
            title: 'PPB 420: Pharmacology V (Chemotherapy)',
            type: 'course',
            resourceId: ppb420 ? ppb420.id : defaultCourseId,
            order: 1,
            estimatedMinutes: 540,
          },
          {
            id: 'mod-amr-case',
            title: 'Clinical Case: MDR-Tuberculosis & Hospital AMR Protocol',
            type: 'clinical_case',
            resourceId: 'case-amr-tb-01',
            order: 2,
            estimatedMinutes: 120,
          },
        ],
      },
      {
        id: 'phase-2-systemic',
        title: 'Respiratory & Cardiovascular Pharmacology (Weeks 7-12)',
        description: 'Advanced pharmacotherapy of obstructive lung diseases and cardiac failure.',
        order: 2,
        modules: [
          {
            id: 'mod-ppb520-respiratory',
            title: 'PPB 520: Respiratory & Cardiovascular Pharmacology',
            type: 'course',
            resourceId: ppb520 ? ppb520.id : defaultCourseId,
            order: 1,
            estimatedMinutes: 500,
          },
          {
            id: 'mod-asthma-case',
            title: 'Clinical Case: Status Asthmaticus & Biologic Therapy Initiation',
            type: 'clinical_case',
            resourceId: 'case-asthma-mab-02',
            order: 2,
            estimatedMinutes: 120,
          },
        ],
      },
    ],
  };

  const chemoPath = await prisma.learningPath.upsert({
    where: { id: 'path-bpharm-iv-pharmacotherapy' },
    update: {
      title: 'BPharm Level IV: Chemotherapy & Systemic Pharmacotherapy',
      description:
        'Comprehensive 12-week advanced pharmacotherapy curriculum covering antimicrobial stewardship, oncology principles, and respiratory/cardiovascular therapeutics.',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 12,
      estimatedHoursPerWeek: 8,
      status: CourseStatus.published,
      specialization: 'Pharmacotherapy',
      pathType: LearningPathType.STANDARD_STUDY,
      categoryId: categoryMap.get('pharmacology'),
      createdBy: adminId,
    },
    create: {
      id: 'path-bpharm-iv-pharmacotherapy',
      title: 'BPharm Level IV: Chemotherapy & Systemic Pharmacotherapy',
      description:
        'Comprehensive 12-week advanced pharmacotherapy curriculum covering antimicrobial stewardship, oncology principles, and respiratory/cardiovascular therapeutics.',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 12,
      estimatedHoursPerWeek: 8,
      status: CourseStatus.published,
      specialization: 'Pharmacotherapy',
      pathType: LearningPathType.STANDARD_STUDY,
      categoryId: categoryMap.get('pharmacology'),
      createdBy: adminId,
    },
  });

  // 6. Learning Path 3: BSc Nursing Critical Care & Clinical Rotations
  const nursingPathStructure = {
    phases: [
      {
        id: 'phase-1-nursing-icu',
        title: 'Hemodynamic Monitoring & ICU Care (Weeks 1-6)',
        description: 'Advanced physiological monitoring, arterial line management, and ventilator care.',
        order: 1,
        modules: [
          {
            id: 'mod-icu-foundations',
            title: 'Critical Care Nursing: Hemodynamics & Vasoactive Titration',
            type: 'course',
            resourceId: defaultCourseId,
            order: 1,
            estimatedMinutes: 480,
          },
          {
            id: 'mod-sepsis-nursing',
            title: 'Clinical Simulation: Early Sepsis Resuscitation & Nursing Interventions',
            type: 'clinical_case',
            resourceId: 'case-nursing-sepsis-bundle',
            order: 2,
            estimatedMinutes: 150,
          },
        ],
      },
      {
        id: 'phase-2-nursing-emergency',
        title: 'Emergency Resuscitation & Clinical Handover (Weeks 7-12)',
        description: 'Advanced life support nursing, trauma triage, and multi-team clinical communication.',
        order: 2,
        modules: [
          {
            id: 'mod-code-blue-sim',
            title: 'Clinical Case: Code Blue Resuscitation & Defibrillation Protocols',
            type: 'clinical_case',
            resourceId: 'case-code-blue-sim',
            order: 1,
            estimatedMinutes: 180,
          },
          {
            id: 'mod-osce-nursing',
            title: 'OSCE Clinical Exam: High-Acuity Patient Handover & Safety Verification',
            type: 'milestone',
            resourceId: 'milestone-nursing-osce',
            order: 2,
            estimatedMinutes: 60,
          },
        ],
      },
    ],
  };

  const nursingPath = await prisma.learningPath.upsert({
    where: { id: 'path-bsc-nursing-critical-care' },
    update: {
      title: 'BSc Nursing: Advanced Adult Health & Critical Care Clerkship',
      description:
        '12-week clinical rotation curriculum covering ICU hemodynamic monitoring, mechanical ventilation support, acute septic resuscitation, and emergency nursing protocols.',
      difficulty: CourseDifficulty.intermediate,
      estimatedDurationWeeks: 12,
      estimatedHoursPerWeek: 10,
      status: CourseStatus.published,
      specialization: 'Critical Care Nursing',
      pathType: LearningPathType.CLINICAL_COMPETENCY,
      categoryId: categoryMap.get('nursing'),
      createdBy: adminId,
    },
    create: {
      id: 'path-bsc-nursing-critical-care',
      title: 'BSc Nursing: Advanced Adult Health & Critical Care Clerkship',
      description:
        '12-week clinical rotation curriculum covering ICU hemodynamic monitoring, mechanical ventilation support, acute septic resuscitation, and emergency nursing protocols.',
      difficulty: CourseDifficulty.intermediate,
      estimatedDurationWeeks: 12,
      estimatedHoursPerWeek: 10,
      status: CourseStatus.published,
      specialization: 'Critical Care Nursing',
      pathType: LearningPathType.CLINICAL_COMPETENCY,
      categoryId: categoryMap.get('nursing'),
      createdBy: adminId,
    },
  });

  // 7. Learning Path 4: MBChB Internal Medicine & Clinical Diagnostics
  const medicinePathStructure = {
    phases: [
      {
        id: 'phase-1-cardio-resp',
        title: 'Cardiovascular & Respiratory Inpatient Care (Weeks 1-8)',
        description: 'Clinical examination, diagnostic workups, and inpatient management of acute cardiac and pulmonary conditions.',
        order: 1,
        modules: [
          {
            id: 'mod-cardio-clerkship',
            title: 'Internal Medicine: Cardiovascular Ward Rotations',
            type: 'course',
            resourceId: defaultCourseId,
            order: 1,
            estimatedMinutes: 600,
          },
          {
            id: 'mod-chest-pain-case',
            title: 'Clinical Case: Acute Coronary Syndrome Differential & Biomarker Triage',
            type: 'clinical_case',
            resourceId: 'case-acs-triage',
            order: 2,
            estimatedMinutes: 180,
          },
        ],
      },
      {
        id: 'phase-2-neuro-nephro',
        title: 'Neurological & Renal Inpatient Care (Weeks 9-16)',
        description: 'Advanced bedside neurological diagnosis, acute kidney injury management, and OSCE examination.',
        order: 2,
        modules: [
          {
            id: 'mod-aki-case',
            title: 'Clinical Case: Acute Kidney Injury on CKD & Fluid Balance Optimization',
            type: 'clinical_case',
            resourceId: 'case-aki-fluid-balance',
            order: 1,
            estimatedMinutes: 180,
          },
          {
            id: 'mod-medicine-osce',
            title: 'Senior Clinical Examination: Bedside Diagnostic OSCE & Case Presentation',
            type: 'milestone',
            resourceId: 'milestone-medicine-osce',
            order: 2,
            estimatedMinutes: 90,
          },
        ],
      },
    ],
  };

  const medicinePath = await prisma.learningPath.upsert({
    where: { id: 'path-mbchb-internal-medicine' },
    update: {
      title: 'MBChB Level IV: Internal Medicine & Clinical Diagnostics',
      description:
        '16-week senior medical clerkship integrating bedside diagnosis, inpatient management of complex multisystem disorders, and clinical OSCE examinations.',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 16,
      estimatedHoursPerWeek: 14,
      status: CourseStatus.published,
      specialization: 'Internal Medicine',
      pathType: LearningPathType.STANDARD_STUDY,
      categoryId: categoryMap.get('internal-medicine'),
      createdBy: adminId,
    },
    create: {
      id: 'path-mbchb-internal-medicine',
      title: 'MBChB Level IV: Internal Medicine & Clinical Diagnostics',
      description:
        '16-week senior medical clerkship integrating bedside diagnosis, inpatient management of complex multisystem disorders, and clinical OSCE examinations.',
      difficulty: CourseDifficulty.advanced,
      estimatedDurationWeeks: 16,
      estimatedHoursPerWeek: 14,
      status: CourseStatus.published,
      specialization: 'Internal Medicine',
      pathType: LearningPathType.STANDARD_STUDY,
      categoryId: categoryMap.get('internal-medicine'),
      createdBy: adminId,
    },
  });

  // 8. Sync relational tables (learning_path_phases & learning_path_modules)
  await syncRelationalPhases(bpharmPath.id, bpharmPathStructure);
  await syncRelationalPhases(chemoPath.id, chemoPathStructure);
  await syncRelationalPhases(nursingPath.id, nursingPathStructure);
  await syncRelationalPhases(medicinePath.id, medicinePathStructure);

  console.log('✅  Successfully seeded Healthcare Learning Paths:');
  console.log(`   - ${bpharmPath.title} (${bpharmPath.id})`);
  console.log(`   - ${chemoPath.title} (${chemoPath.id})`);
  console.log(`   - ${nursingPath.title} (${nursingPath.id})`);
  console.log(`   - ${medicinePath.title} (${medicinePath.id})`);
}

async function syncRelationalPhases(pathId: string, pathStructure: any) {
  if (!pathStructure?.phases) return;

  await prisma.learningPathPhase.deleteMany({
    where: { learningPathId: pathId },
  });

  for (let pIdx = 0; pIdx < pathStructure.phases.length; pIdx++) {
    const phase = pathStructure.phases[pIdx];
    const createdPhase = await prisma.learningPathPhase.create({
      data: {
        id: `${pathId}-${phase.id}`,
        learningPathId: pathId,
        title: phase.title,
        description: phase.description,
        order: phase.order ?? pIdx + 1,
        estimatedWeeks: phase.estimatedWeeks,
      },
    });

    for (let mIdx = 0; mIdx < (phase.modules || []).length; mIdx++) {
      const mod = phase.modules[mIdx];
      let courseId: string | null = null;
      let quizId: string | null = null;

      if (mod.type === 'course' && mod.resourceId) {
        const course = await prisma.course.findUnique({
          where: { id: mod.resourceId },
          select: { id: true },
        });
        if (course) courseId = course.id;
      } else if (mod.type === 'assessment' && mod.resourceId) {
        const quiz = await prisma.quiz.findUnique({
          where: { id: mod.resourceId },
          select: { id: true },
        });
        if (quiz) quizId = quiz.id;
      }

      const validTypes = ['course', 'assessment', 'clinical_case', 'milestone', 'resource'];
      const modType = validTypes.includes(mod.type) ? (mod.type as any) : 'course';

      await prisma.learningPathModule.create({
        data: {
          id: `${createdPhase.id}-${mod.id}`,
          phaseId: createdPhase.id,
          title: mod.title,
          description: mod.description,
          type: modType,
          resourceId: mod.resourceId,
          courseId,
          quizId,
          order: mod.order ?? mIdx + 1,
          estimatedMinutes:
            mod.estimatedMinutes ||
            (mod.estimatedHours ? mod.estimatedHours * 60 : 60),
          isRequired: mod.isRequired ?? true,
          unlockConditions: mod.unlockConditions || [],
        },
      });
    }
  }
}

// Self-invoking when run standalone
if (require.main === module) {
  seedLearningPaths()
    .catch((err) => {
      console.error('❌  Learning path seeder failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await _pool.end();
    });
}
