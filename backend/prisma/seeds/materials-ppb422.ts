/**
 * PPB-422 MATERIAL REFERENCES - GENERATED FROM R2 INVENTORY
 * 
 * These materials are already in R2 and can be referenced in topics
 * by using their R2 keys in the 'content' field
 * 
 * To update seed data:
 * 1. Add these constants at the top of courses.seed.ts
 * 2. Reference materials by their R2 keys in topic.materials[] arrays
 * 3. Run prisma db seed
 */

// ========================================
// PPB-422 COURSE-LEVEL MATERIALS
// ========================================
export const PPB422_COURSE_MATERIALS = [
  {
    title: 'PPB 422: Skin and Ocular Diseases - The Eye 2021',
    type: 'presentation' as const,
    content: 'materials/675a157c1daa411c4cc31e0cd3415929867f92eb6ed78e8c17a78aea1d1a55ac-PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt',
    description: 'Primary course presentation covering skin and eye anatomy, pathophysiology, and treatment',
  },
  {
    title: 'Course Outline: PPB 422 - Dermatology and Ocular Diseases (March-June 2026)',
    type: 'document' as const,
    content: 'materials/f82ad2756a5c12bbd5dfb1069e37c45932dc726ae31344a1693f69bc5da09a16-Course Outline PPB 422-DERMATOLOGY AND OCULAR DISEASES MARCH-JUNE 2026.docx',
    description: 'Official course outline with learning objectives and schedule',
  },
  {
    title: 'Katzung - Basic and Clinical Pharmacology 14th Edition',
    type: 'pdf' as const,
    content: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
    description: 'Reference for dermatological and ophthalmological drug therapy',
  },
  {
    title: 'KDT - Essentials of Medical Pharmacology 7th Edition',
    type: 'pdf' as const,
    content: 'textbooks/pharmacology/kdt-essentials-of-medical-pharmacology-7th-edition.pdf',
    description: 'Primary textbook covering dermatology and ocular pharmacology',
  },
];

// ========================================
// UNIT 1: DERMATOLOGY FOUNDATIONS - MATERIALS
// ========================================
export const UNIT1_MATERIALS = {
  // Topic: Skin Anatomy and Physiology
  skin_anatomy: [
    {
      title: 'Anatomy at a Glance',
      type: 'pdf' as const,
      content: 'textbooks/anatomy/anatomyataglance.pdf',
      description: 'Visual reference for skin anatomy and structures',
    },
    {
      title: 'BRS Gross Anatomy - 5th Edition',
      type: 'pdf' as const,
      content: 'textbooks/anatomy/brs-gross-anatomy-5th-edition.pdf',
      description: 'Comprehensive anatomy reference covering skin and integumentary system',
    },
    {
      title: 'Anatomy and Physiology Study and Exam Questions',
      type: 'pdf' as const,
      content: 'textbooks/anatomy/anatomy-physiology-study-and-exam-questions.pdf',
      description: 'Practice questions and study material on skin anatomy',
    },
    {
      title: 'BRS Physiology - 5th Edition',
      type: 'pdf' as const,
      content: 'textbooks/medical-physiology/brs.physiology.5.edition.pdf',
      description: 'Physiology of skin including thermoregulation and sensory function',
    },
    {
      title: 'Ganong\'s Review of Medical Physiology - 25th Edition',
      type: 'pdf' as const,
      content: 'textbooks/medical-physiology/ganong-s-review-of-medical-physiology-25th-edition-2016-pdf-.pdf-filen.pdf',
      description: 'Detailed physiological mechanisms of skin function and homeostasis',
    },
  ],
};

// ========================================
// UNIT 2: TOPICAL THERAPY PRINCIPLES - MATERIALS
// ========================================
export const UNIT2_MATERIALS = {
  // Topic: Topical Drug Delivery
  topical_delivery: [
    {
      title: 'Katzung - Basic and Clinical Pharmacology 14th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
      description: 'Comprehensive pharmacology reference including topical delivery systems',
    },
    {
      title: 'KDT - Essentials of Medical Pharmacology 7th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/kdt-essentials-of-medical-pharmacology-7th-edition.pdf',
      description: 'Essential reference for pharmacological principles of topical therapy',
    },
    {
      title: 'KD Tripathi - Essentials of Medical Pharmacology 6th Edition',
      type: 'pdf' as const,
      content: 'Pharmacy/PHARMACOLOGY/KD Tripathi - Essentials of Medical Pharmacology  6th Edition 1477380487135 ( PDFDrive ).pdf',
      description: 'Alternative pharmacology text covering topical formulations',
    },
  ],
};

// ========================================
// UNIT 3: DERMATOLOGICAL AGENTS - MATERIALS
// ========================================
export const UNIT3_MATERIALS = {
  // Topic: Antimicrobial Agents
  antimicrobial: [
    {
      title: 'WHO Antibiotics Guidelines',
      type: 'pdf' as const,
      content: 'materials/98b7d1317b9889f8f65c92603519a32a19d917de91e53b34ab8d168d991914e9-Antibiotics book WHO.pdf',
      description: 'WHO guidelines for appropriate antibiotic use in dermatological infections',
    },
    {
      title: 'Goodman & Gilman\'s Pharmacological Basis of Therapeutics 13th Ed',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
      description: 'Comprehensive pharmacology reference including antimicrobial agents',
    },
  ],
  // Topic: Corticosteroids in Dermatology
  corticosteroids: [
    {
      title: 'Katzung - Basic and Clinical Pharmacology 14th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
      description: 'Corticosteroid pharmacology and dermatological applications',
    },
    {
      title: 'Rang & Dale\'s Pharmacology',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/rang-dales-pharmacology-pdfdrive-.pdf',
      description: 'Detailed mechanistic understanding of corticosteroid action',
    },
  ],
  // Topic: Retinoids and Keratolytic Agents
  retinoids: [
    {
      title: 'Goodman & Gilman\'s Pharmacological Basis of Therapeutics 13th Ed',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
      description: 'Retinoid pharmacology and mechanism of action',
    },
  ],
};

// ========================================
// UNIT 4: ACNE - MATERIALS
// ========================================
export const UNIT4_MATERIALS = {
  // Topic: Acne Causes and Pathogenesis
  acne_pathogenesis: [
    {
      title: 'Fundamentals of Pathology (Pathoma) - 2018',
      type: 'pdf' as const,
      content: 'textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf',
      description: 'Pathology of acne vulgaris and inflammatory cascade',
    },
  ],
  // Topic: Topical Acne Treatment
  acne_topical: [
    {
      title: 'Katzung - Basic and Clinical Pharmacology 14th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
      description: 'Topical agents for acne including benzoyl peroxide and retinoids',
    },
  ],
  // Topic: Systemic Acne Treatment
  acne_systemic: [
    {
      title: 'Goodman & Gilman\'s Pharmacological Basis of Therapeutics 13th Ed',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
      description: 'Systemic antibiotics and isotretinoin therapy for acne',
    },
    {
      title: 'KDT - Essentials of Medical Pharmacology 7th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/kdt-essentials-of-medical-pharmacology-7th-edition.pdf',
      description: 'Practical guidance on systemic acne medications',
    },
  ],
};

// ========================================
// DERMATOLOGICAL CONDITIONS - MATERIALS
// ========================================
export const DERMATOLOGY_CONDITIONS_MATERIALS = {
  // For all skin condition topics (infections, eczema, psoriasis, etc.)
  general_pathology: [
    {
      title: 'Fundamentals of Pathology (Pathoma) - 2018',
      type: 'pdf' as const,
      content: 'textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf',
      description: 'Pathological basis of dermatological conditions',
    },
    {
      title: 'Harsh Mohan - Textbook of Pathology 6th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pathology/harsh-mohan-textbook-of-pathology-6th-ed.pdf',
      description: 'Comprehensive pathology reference for skin diseases',
    },
    {
      title: 'Robbins Basic Pathology',
      type: 'pdf' as const,
      content: 'textbooks/pathology/robbins-basic-pathology-vinay-kumar-abul-k.-abbas-jon-c.-aster-z-lib.org.pdf',
      description: 'Fundamental pathology principles applied to dermatological conditions',
    },
  ],
};

// ========================================
// OCULAR DISEASES - MATERIALS
// ========================================
export const OCULAR_DISEASES_MATERIALS = {
  eye_anatomy: [
    {
      title: 'Clinical Neuroanatomy Made Ridiculously Simple',
      type: 'pdf' as const,
      content: 'textbooks/anatomy/clinical-neuroanatomy-made-ridiculously-simple.pdf',
      description: 'Simplified anatomy of eye and related structures',
    },
    {
      title: 'PPB 422: Skin and Ocular Diseases - The Eye 2021',
      type: 'presentation' as const,
      content: 'materials/675a157c1daa411c4cc31e0cd3415929867f92eb6ed78e8c17a78aea1d1a55ac-PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt',
      description: 'Course presentation with detailed coverage of eye diseases',
    },
  ],
  ophthalmic_pharmacology: [
    {
      title: 'Katzung - Basic and Clinical Pharmacology 14th Edition',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf',
      description: 'Ophthalmic drug therapy including glaucoma and conjunctivitis treatments',
    },
    {
      title: 'Goodman & Gilman\'s Pharmacological Basis of Therapeutics 13th Ed',
      type: 'pdf' as const,
      content: 'textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf',
      description: 'Comprehensive reference on ophthalmic pharmacology',
    },
  ],
};

// ========================================
// ASSESSMENT MATERIALS
// ========================================
export const ASSESSMENT_MATERIALS = [
  {
    title: 'PPB 422 CAT 1 October 2022 - Marking Scheme',
    type: 'pdf' as const,
    content: 'materials/e9d005609d08e7964c782ee4e9ef08b59b29bf898dd4892c4acb961dea02c996-PPB 422 CAT 1 OCT 2022 MARKING SCHEME.pdf',
    description: 'Reference marking scheme for assessment and evaluation',
  },
];

// ========================================
// USAGE INSTRUCTIONS
// ========================================
/**
 * TO APPLY THESE MATERIALS TO YOUR SEED DATA:
 * 
 * 1. Import these constants at the top of courses.seed.ts:
 *    import {
 *      PPB422_COURSE_MATERIALS,
 *      UNIT1_MATERIALS,
 *      UNIT2_MATERIALS,
 *      // ... etc
 *    } from './materials-ppb422';
 * 
 * 2. Replace the materials array in the PPB-422 course object:
 *    materials: PPB422_COURSE_MATERIALS,
 * 
 * 3. Add materials to each topic that needs them. For example, in
 *    UNIT 1 > Topic "Skin Anatomy and Physiology":
 *    materials: [...UNIT1_MATERIALS.skin_anatomy]
 * 
 * 4. For topics covering common conditions, add general pathology materials:
 *    materials: [...DERMATOLOGY_CONDITIONS_MATERIALS.general_pathology]
 * 
 * 5. For ocular disease topics:
 *    materials: [
 *      ...OCULAR_DISEASES_MATERIALS.eye_anatomy,
 *      ...OCULAR_DISEASES_MATERIALS.ophthalmic_pharmacology
 *    ]
 * 
 * 6. Run the seed:
 *    npx prisma db seed
 */
