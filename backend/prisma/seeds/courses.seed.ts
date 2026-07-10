/**
 * seed-courses.ts
 *
 * Kenyatta University Pharmacy Programme – Course Seeder
 *
 * Hierarchy:
 *   Discipline Course  (e.g. "Pharmacology I"  code PPB-310)
 *     └─ Unit          (e.g. PPB 311 / PPB 312 / PPB 313 …)
 *          └─ Topic
 *               └─ Material
 *
 * KEY DESIGN RULE
 * ───────────────
 * All units that share the same discipline prefix AND semester block
 * (PPB 3xx → Pharmacology I, PPB 32x → Pharmacology II, etc.)
 * are children of a single Course row.  No unit is its own course.
 *
 * Schema alignment notes
 * ──────────────────────
 * • Unit      @@unique([courseId, order])
 * • Unit      @@unique([courseId, slug])
 * • Topic     @@unique([unitId, order])
 * • Topic     @@unique([unitId, slug])
 * • Material  @id supplied deterministically → idempotent re-runs
 * • Option    @id supplied deterministically
 * • Quiz      @id supplied deterministically
 * • Question.category → QuestionCategory enum
 * • Material.type     → MaterialType enum  (no `as any`)
 */

import 'dotenv/config';
import {
  PrismaClient,
  CourseStatus,
  CourseDifficulty,
  QuestionType,
  QuestionDifficulty,
  QuestionCategory,
  MaterialType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Prisma setup ─────────────────────────────────────────────────────────────

const _pool = new Pool({ connectionString: process.env.DATABASE_URL });
const _adapter = new PrismaPg(_pool);
const prisma = new PrismaClient({ adapter: _adapter });

// ─── Types ────────────────────────────────────────────────────────────────────

type SupportedMaterialType = Extract<MaterialType, 'pdf' | 'video' | 'notes'>;

interface MaterialDef {
  title: string;
  type: SupportedMaterialType;
  content: string;
  description: string;
}

interface TopicDef {
  name: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  materials?: MaterialDef[];
}

interface UnitDef {
  /** Sub-unit code, e.g. "PPB 311" */
  code: string;
  name: string;
  title: string;
  description: string;
  order: number;
  estimatedHours: number;
  topics: TopicDef[];
}

interface CourseDef {
  /** Parent block code, e.g. "PPB-310" */
  code: string;
  name: string;
  title: string;
  description: string;
  difficulty: CourseDifficulty;
  status: CourseStatus;
  categoryName: string;
  questionCategory: QuestionCategory;
  tags: string[];
  isFeatured?: boolean;
  materials?: MaterialDef[];
  units: UnitDef[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function deterministicId(...parts: string[]): string {
  return parts
    .map((p) => slugify(p))
    .join('--')
    .substring(0, 120);
}

// ─── Course catalogue ─────────────────────────────────────────────────────────
//
// Naming convention used throughout KU:
//   PPA = Pharmaceutics          PPB = Pharmacology
//   PPC = Pharmaceutical Chem    PPD = Pharmacognosy
//   PPF = Clinical Pharmacy      PPL = Pharmacy Law
//
// Each semester block (e.g. PPB 310, PPB 320, PPB 330 …) becomes ONE Course.
// Its sub-units (PPB 311, PPB 312, PPB 313 …) become Unit rows under it.

const COURSES: CourseDef[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 1 · SEMESTER 1
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: 'HMB-110',
    name: 'biochemistry-i',
    title: 'Biochemistry I',
    description:
      'Introduction to medical biochemistry covering biomolecules, enzymology and biological membranes.',
    difficulty: CourseDifficulty.beginner,
    status: CourseStatus.published,
    categoryName: 'Biochemistry',
    questionCategory: QuestionCategory.biochemistry,
    isFeatured: true,
    tags: ['biochemistry', 'biomolecules', 'enzymology', 'year-1', 'semester-1'],
    materials: [
      {
        title: 'Textbook of Medical Biochemistry 8th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/BIOCHEMISTRY/TEXTBOOK OF MEDICAL BIOCHEMISTRY 8TH EDITION 2012 PP894.pdf',
        description: 'Primary textbook for Biochemistry I',
      },
    ],
    units: [
      {
        code: 'HMB 111',
        name: 'chemical-foundations',
        title: 'Chemical Foundations of Life',
        description: 'Basic chemical principles underlying biological processes',
        order: 1,
        estimatedHours: 15,
        topics: [
          {
            name: 'Atomic Structure in Biology',
            description: 'Atoms, isotopes, valence and electrons in bonding',
            order: 1,
            estimatedMinutes: 20,
            materials: [
              {
                title: 'Atomic Structure for Biochemistry',
                type: 'notes',
                content: 'Brief notes on electrons, orbitals and bonding relevant to biomolecules.',
                description: 'Atomic structure in a biological context',
              },
            ],
          },
          {
            name: 'Chemical Bonds',
            description: 'Covalent, ionic, hydrogen bonds and van der Waals forces',
            order: 2,
            estimatedMinutes: 15,
            materials: [
              {
                title: 'Chemical Bonds Overview',
                type: 'notes',
                content: 'Concise overview of chemical bonds relevant to biological molecules.',
                description: 'Bonding in biomolecules',
              },
            ],
          },
        ],
      },
      {
        code: 'HMB 112',
        name: 'carbohydrate-chemistry',
        title: 'Carbohydrate Chemistry',
        description: 'Structure, properties and metabolism of mono-, di- and polysaccharides',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Monosaccharides',
            description: 'Glucose, fructose, stereochemistry and isomers',
            order: 1,
            estimatedMinutes: 25,
            materials: [
              {
                title: 'Chemistry of Monosaccharides',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/3_Chemistry_of_Monosaccharides.pdf',
                description: 'Monosaccharide structure and biological implications',
              },
            ],
          },
          {
            name: 'Polysaccharides and Glycogen Metabolism',
            description: 'Glycogen structure, metabolism and storage disorders',
            order: 2,
            estimatedMinutes: 20,
            materials: [
              {
                title: 'Chemistry of Polysaccharides',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/4_Chemistry_of_Polysaccharides.pdf',
                description: 'Polysaccharide structures and glycogen metabolism',
              },
            ],
          },
        ],
      },
      {
        code: 'HMB 113',
        name: 'amino-acids-proteins',
        title: 'Amino Acids, Peptides and Proteins',
        description: 'Structure and function of amino acids, peptide bonds and protein folding',
        order: 3,
        estimatedHours: 25,
        topics: [
          {
            name: 'Amino Acid Structure and Properties',
            description: 'Amino acid properties, side chain chemistry and titration curves',
            order: 1,
            estimatedMinutes: 25,
            materials: [
              {
                title: 'Amino Acids – Structure & Properties',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/5_Amino_acids_Peptides_Proteins.pdf',
                description: 'Amino acid notes',
              },
            ],
          },
          {
            name: 'Protein Structure and Folding',
            description: 'Primary to quaternary structure, folding and chaperones',
            order: 2,
            estimatedMinutes: 25,
            materials: [
              {
                title: 'Protein Structure',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/Protein Structure.pdf',
                description: 'Protein folding overview',
              },
            ],
          },
        ],
      },
      {
        code: 'HMB 114',
        name: 'enzymology',
        title: 'Enzymology',
        description: 'Enzyme kinetics, mechanisms, inhibition and clinical enzymology',
        order: 4,
        estimatedHours: 25,
        topics: [
          {
            name: 'Enzyme Kinetics',
            description: 'Michaelis–Menten kinetics and Lineweaver-Burk plots',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Enzyme Kinetics PDF',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/ENZYMOLOGY/ENZYME KINETICS.pdf',
                description: 'Enzyme kinetics with practice problems',
              },
              {
                title: 'LEC02 Enzyme Kinetics',
                type: 'notes',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/ENZYMOLOGY/LEC02 Enzyme kinetics.docx',
                description: 'Lecture notes on kinetics',
              },
            ],
          },
          {
            name: 'Enzyme Inhibition',
            description: 'Competitive and non-competitive inhibition, clinical correlates',
            order: 2,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Enzyme Inhibition Notes',
                type: 'notes',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/ENZYMOLOGY/ENZYME INHIBITION.docx',
                description: 'Inhibition types with clinical examples',
              },
            ],
          },
        ],
      },
      {
        code: 'HMB 115',
        name: 'biological-membranes',
        title: 'Biological Membranes',
        description: 'Structure, composition and transport across biological membranes',
        order: 5,
        estimatedHours: 20,
        topics: [
          {
            name: 'Membrane Structure',
            description: 'Lipid bilayer, membrane proteins and the fluid mosaic model',
            order: 1,
            estimatedMinutes: 20,
            materials: [
              {
                title: 'Membrane Transport PDF',
                type: 'pdf',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/Diff & Trans Membranes.pdf',
                description: 'Membranes and transport mechanisms',
              },
            ],
          },
          {
            name: 'Membrane Transport',
            description: 'Passive vs active transport, channels, carriers and pumps',
            order: 2,
            estimatedMinutes: 20,
            materials: [
              {
                title: 'Solute Transport Across Membranes',
                type: 'notes',
                content: 'LEVEL 1/Level 1.1/BIOCHEMISTRY I/medical membranes and transport.pdf',
                description: 'Transport mechanisms across biological membranes',
              },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 3 · SEMESTER 1
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pharmaceutics I (PPA 310) ─────────────────────────────────────────────
  {
    code: 'PPA-310',
    name: 'pharmaceutics-i',
    title: 'Pharmaceutics I',
    description: 'Introduction to pharmaceutical dosage forms, particle science and dosage form technology.',
    difficulty: CourseDifficulty.beginner,
    status: CourseStatus.published,
    categoryName: 'Pharmaceutics',
    questionCategory: QuestionCategory.pharmaceutics,
    tags: ['pharmaceutics', 'dosage-forms', 'year-3', 'semester-1'],
    units: [
      {
        code: 'PPA 311',
        name: 'intro-dosage-forms',
        title: 'Introduction to Pharmaceutical Dosage Forms',
        description: 'History, classification and fundamentals of dosage form design',
        order: 1,
        estimatedHours: 20,
        topics: [
          {
            name: 'History of Pharmacy and Dosage Forms',
            description: 'Evolution of pharmacy practice and dosage form development',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'PPA 311 Lesson 1 – History of Pharmacy',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPA 310 PHARMACEUTICS I/introduction to pharmaceutical dosage forms/PPA 311 LESSON 1 PHARMACEUTICS ppa 311 history of pharmacy (1).pptx',
                description: 'History of pharmacy and introduction to dosage forms',
              },
            ],
          },
          {
            name: 'Classification of Dosage Forms',
            description: 'Solid, liquid and semi-solid dosage forms – overview',
            order: 2,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'PPA 311 Lesson 2',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPA 310 PHARMACEUTICS I/introduction to pharmaceutical dosage forms/PPA 311 LESSON 2 (1).pptx',
                description: 'Classification of dosage forms',
              },
              {
                title: 'PPA 311 Lesson 3',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPA 310 PHARMACEUTICS I/introduction to pharmaceutical dosage forms/LESSON 3.pptx',
                description: 'Dosage form fundamentals continued',
              },
            ],
          },
          {
            name: 'Particle Size Analysis',
            description: 'Sieving, particle size distribution and pharmaceutical significance',
            order: 3,
            estimatedMinutes: 25,
            materials: [
              {
                title: 'Particle Size Analysis by Sieving',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPA 310 PHARMACEUTICS I/PARTICLE SIZE ANALYSIS BY SIEVING.doc',
                description: 'Sieving methods for particle size analysis',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmacology I (PPB 310) ──────────────────────────────────────────────
  {
    code: 'PPB-310',
    name: 'pharmacology-i',
    title: 'Pharmacology I',
    description:
      'Pharmacokinetics, pharmacodynamics, drug development, autacoids, pain and inflammation.',
    difficulty: CourseDifficulty.intermediate,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    isFeatured: true,
    tags: ['pharmacology', 'pharmacokinetics', 'pharmacodynamics', 'year-3', 'semester-1'],
    materials: [
      {
        title: 'KDT – Essentials of Medical Pharmacology 7th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACOLOGY/KDT - Essentials of Medical Pharmacology [7th Edition].pdf',
        description: 'Primary pharmacology textbook',
      },
      {
        title: 'Katzung – Basic and Clinical Pharmacology 14th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACOLOGY/Katzung - Basic and Clinical Pharmacology 14th Edition.pdf',
        description: 'Clinical pharmacology reference',
      },
      {
        title: "Rang & Dale's Pharmacology",
        type: 'pdf',
        content: "TEXTBOOKS/PHARMACOLOGY/Rang & Dale's Pharmacology ( PDFDrive ).pdf",
        description: 'Concise pharmacology reference',
      },
    ],
    units: [
      {
        code: 'PPB 311',
        name: 'basic-pharmacology',
        title: 'Basics of Pharmacology',
        description: 'Drug sources, nomenclature, routes of administration, pharmacokinetics and pharmacodynamics',
        order: 1,
        estimatedHours: 30,
        topics: [
          {
            name: 'Introduction and Drug Sources',
            description: 'Natural vs synthetic drugs, nomenclature and ATC classification',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Lesson 1 – Introduction to Pharmacology',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 1.pdf',
                description: 'Introduction to pharmacology basics',
              },
            ],
          },
          {
            name: 'Pharmacokinetics – ADME',
            description: 'Absorption, distribution, metabolism, excretion and pharmacokinetic calculations',
            order: 2,
            estimatedMinutes: 90,
            materials: [
              {
                title: 'Lesson 2 – Pharmacokinetics & Drug Routes',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 2 Pharmacokinetics & Drug routes.pdf',
                description: 'ADME overview',
              },
              {
                title: 'Lesson 3 – Absorption',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 3 Absoprtion.pdf',
                description: 'Drug absorption and bioavailability',
              },
              {
                title: 'Lesson 4 – Drug Distribution',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 4 Drug Distribution.pdf',
                description: 'Volume of distribution and protein binding',
              },
              {
                title: 'Lesson 6 – Pharmacodynamics Signal Transduction',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 6 Pharmacodynamics (signal transduction).pdf',
                description: 'Signal transduction pathways',
              },
              {
                title: 'Lesson 7 – Variation in PK/PD',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 7 Variation in Pharmaco-kinetic & -dybamics.pdf',
                description: 'Sources of pharmacokinetic and pharmacodynamic variability',
              },
              {
                title: 'Lesson 8 – Pharmacogenetics',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 8 Pharmacogenetics.pdf',
                description: 'Genetic factors in drug response',
              },
            ],
          },
          {
            name: 'Pharmacodynamics – Drug Targets',
            description: 'Drug-receptor interactions, dose-response relationships, efficacy and potency',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 5 – Pharmacodynamics (Drug Targets)',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 5 Pharmacodynamics (Drug Targets).pdf',
                description: 'Receptor types and drug-target interactions',
              },
              {
                title: 'Lesson 9 – ADRs & Drug-Drug Interactions',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/basics of pharmacology-chege/Lesson 9 ADRs & Drug-Drug Interactions.pdf',
                description: 'Adverse drug reactions and interactions',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 312',
        name: 'drug-development',
        title: 'Drug Development',
        description: 'Drug discovery, pre-clinical studies, clinical trials (GCP/GLP) and regulatory approval',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Drug Discovery Process',
            description: 'Lead identification, optimisation and candidate selection',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'PPB 312 Lecture 1A – Introduction to Drug Development',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/PPB 312 Lecture 1A - Introduction to Drug Discovery Development & regulation - 23 (1).pptx',
                description: 'Introduction to drug development pipeline',
              },
              {
                title: 'PPB 312 Lecture 1B – Drug Discovery',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/PPB 312 Lecture 1B - Drug discovery.pdf',
                description: 'Drug discovery pipeline details',
              },
              {
                title: 'Lesson 1 – Drug Discovery Process',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/Lesson 1 Drug Discovery Process.ppt',
                description: 'Drug discovery overview slides',
              },
            ],
          },
          {
            name: 'Pre-clinical Studies and GLP',
            description: 'In-vitro and in-vivo pre-clinical studies, Good Laboratory Practice',
            order: 2,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Lesson 2 – Pre-clinical Studies',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/Lesson 2 Pre(non)- Clinical Studies.pdf',
                description: 'Pre-clinical study design',
              },
              {
                title: 'PPB 312 Lecture 2B – GLP',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/PPB 312 Lecture 2B - GLP.pdf',
                description: 'Good Laboratory Practice',
              },
            ],
          },
          {
            name: 'Clinical Trials and GCP',
            description: 'Phases I–IV, GCP, ethics and regulatory submissions',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPB 312 Lecture 3B – GCP',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/PPB 312 Lecture 3B - GCP.pdf',
                description: 'Good Clinical Practice',
              },
              {
                title: 'PPB 312 Lecture 4 – Clinical Trials Design',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/drug development-makanga/PPB 312 Lecture 4 - Clinical trials design & implementation.pdf',
                description: 'Clinical trial design and implementation',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 313',
        name: 'autacoids-pain-inflammation',
        title: 'Autacoids, Pain and Inflammation',
        description: 'Histamine, serotonin, prostaglandins, NSAIDs, opioids, DMARDs and gout drugs',
        order: 3,
        estimatedHours: 25,
        topics: [
          {
            name: 'Histamine and Antihistamines',
            description: 'H1/H2 receptors, first- and second-generation antihistamines',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Introduction and Histamine',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/INTRODUCTION AND HISTAMINE.ppt',
                description: 'Histamine pharmacology',
              },
            ],
          },
          {
            name: 'Serotonin and Eicosanoids',
            description: '5-HT receptors, serotonin pharmacology, prostaglandins and leukotrienes',
            order: 2,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Serotonin',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/serotonin.medicine,21 nov 2011 - Copy.ppt',
                description: 'Serotonin pharmacology',
              },
              {
                title: 'Eicosanoids',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/EISCANOSIDS,final - Copy,i.ppt',
                description: 'Eicosanoid pharmacology',
              },
              {
                title: 'Nitric Oxide',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/Nitric oxide,medicine.ppt',
                description: 'Nitric oxide as a pharmacological mediator',
              },
            ],
          },
          {
            name: 'NSAIDs and Antipyretics',
            description: 'COX-1/COX-2 inhibition, aspirin, ibuprofen, diclofenac, paracetamol',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: '1. NSAIDs – Lecture 4',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/1.Non steroidal anti-inflammatory drugs(nsaids),lecture 4.ppt',
                description: 'Overview of NSAID pharmacology',
              },
              {
                title: '2. Aspirin',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/2.aspirin.ppt',
                description: 'Aspirin mechanism and adverse effects',
              },
              {
                title: '3. Paracetamol',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/3.Paracetamol(acetominophen).ppt',
                description: 'Paracetamol pharmacology and toxicity',
              },
              {
                title: '5. Indomethacin',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/5.Indomethacin.ppt',
                description: 'Indomethacin pharmacology',
              },
              {
                title: '6. Diclofenac',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/6.diclofenac.ppt',
                description: 'Diclofenac pharmacology',
              },
              {
                title: '12. Selective COX-2 Inhibitors',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/12.Selective,cox,2 inhibitors.ppt',
                description: 'COX-2 selective inhibitors',
              },
            ],
          },
          {
            name: 'Opioid Analgesics',
            description: 'Opioid receptors, morphine, fentanyl, naloxone and opioid use disorder',
            order: 4,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Opioids',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/OPIODS NOV 2106.ppt',
                description: 'Opioid pharmacology',
              },
            ],
          },
          {
            name: 'DMARDs and Biological Agents',
            description: 'Disease-modifying anti-rheumatic drugs, biologicals and targeted therapies',
            order: 5,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Lecture 1 – DMARDs',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/LECTURE 1,DMARD.ppt',
                description: 'DMARD pharmacology',
              },
              {
                title: 'Lecture 2 – DMARDs',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/LECTURE 2 DMARDS.ppt',
                description: 'DMARDs continued',
              },
              {
                title: 'Lecture 4 – Biologicals',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/LECTURE 4 MEDICINE ,BIOLOGICALS.ppt',
                description: 'Biological agents in rheumatic diseases',
              },
            ],
          },
          {
            name: 'Migraine and Gout',
            description: 'Migraine pharmacotherapy; allopurinol, colchicine and uricosurics',
            order: 6,
            estimatedMinutes: 35,
            materials: [
              {
                title: 'Drugs for Migraine',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/DRUGS FOR MIGRAINE.pptx',
                description: 'Migraine treatment',
              },
              {
                title: 'Antigout',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/autocoids pain and inflammation/ppb 313 antgout.ppt',
                description: 'Gout pharmacotherapy',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmaceutical Chemistry I (PPC 310) ──────────────────────────────────
  {
    code: 'PPC-310',
    name: 'pharmaceutical-chemistry-i',
    title: 'Pharmaceutical Chemistry I',
    description: 'Physicochemical properties of drugs, drug design and quality control principles.',
    difficulty: CourseDifficulty.intermediate,
    status: CourseStatus.published,
    categoryName: 'Pharmaceutical Chemistry',
    questionCategory: QuestionCategory.pharmaceutical_chemistry,
    tags: ['pharmaceutical-chemistry', 'physicochemical', 'drug-design', 'year-3', 'semester-1'],
    materials: [
      {
        title: 'Essentials of Pharmaceutical Chemistry',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACEUTICAL CHEMISTRY/Essentials of Pharmaceutical Chemistry ( PDFDrive ) (1).pdf',
        description: 'Primary pharmaceutical chemistry textbook',
      },
    ],
    units: [
      {
        code: 'PPC 311',
        name: 'physicochemical-properties',
        title: 'Physicochemical Properties of Drugs',
        description: 'Solubility, ionisation, partition coefficient and pharmaceutical implications',
        order: 1,
        estimatedHours: 20,
        topics: [
          {
            name: 'Physicochemical Properties – Part A',
            description: 'Solubility, dissolution and drug ionisation',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPC 311 Notes Part A',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPC 310 PHARMACEUTICAL CHEMISTRY I/ppc 311-physicochemical properties of drugs/PPC 311 notes Part A 2023-24 AY.pdf',
                description: 'Physicochemical properties part A',
              },
            ],
          },
          {
            name: 'Physicochemical Properties – Part B',
            description: 'Partition coefficient, stereochemistry and bioisosterism',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPC 311 Notes Part B',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPC 310 PHARMACEUTICAL CHEMISTRY I/ppc 311-physicochemical properties of drugs/PPC 311-2023-2024 notes Part B.pdf',
                description: 'Physicochemical properties part B',
              },
            ],
          },
        ],
      },
      {
        code: 'PPC 312',
        name: 'drug-development-design',
        title: 'Drug Development and Design',
        description: 'Structure-activity relationships, lead optimisation and rational drug design',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Drug Development and Design – Part A',
            description: 'SAR, pharmacophore and lead compound optimisation',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPC 312 Notes Part A',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPC 310 PHARMACEUTICAL CHEMISTRY I/ppc 312-drug development and design/PPC 312 Sem I 2023-24 Notes Part A.pdf',
                description: 'Drug design – part A',
              },
            ],
          },
          {
            name: 'Drug Development and Design – Part B',
            description: 'Computer-aided drug design and prodrug strategies',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPC 312 Notes Part B',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPC 310 PHARMACEUTICAL CHEMISTRY I/ppc 312-drug development and design/PPC 312 -2023-2024 Acad Year notes Part B.pdf',
                description: 'Drug design – part B',
              },
            ],
          },
        ],
      },
      {
        code: 'PPC 313',
        name: 'drug-quality-control',
        title: 'Principles of Drug Quality Control',
        description: 'Quality assurance, pharmacopoeial standards and analytical testing',
        order: 3,
        estimatedHours: 15,
        topics: [
          {
            name: 'Quality Control Principles',
            description: 'GMP, pharmacopoeial standards and quality assurance frameworks',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'PPC 313 Slides 2023',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/principles of drug quality control/PPC 313_2023 ppt.ppt',
                description: 'Quality control principles slides',
              },
              {
                title: 'PPC 313 Notes 2023',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPB 310 PHARMACOLOGY I/principles of drug quality control/PPC 313_2023.pptx',
                description: 'Quality control notes',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmacognosy I (PPD 310) ─────────────────────────────────────────────
  {
    code: 'PPD-310',
    name: 'pharmacognosy-i',
    title: 'Pharmacognosy I',
    description: 'Pharmaceutical botany, plant morphology, taxonomy and introduction to crude drugs.',
    difficulty: CourseDifficulty.beginner,
    status: CourseStatus.published,
    categoryName: 'Pharmacognosy',
    questionCategory: QuestionCategory.pharmacognosy,
    tags: ['pharmacognosy', 'botany', 'medicinal-plants', 'year-3', 'semester-1'],
    materials: [
      {
        title: 'Trease and Evans Pharmacognosy 16th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACOGNOSY/Trease and Evans Pharmacognosy 16th ed..pdf',
        description: 'Primary pharmacognosy textbook',
      },
    ],
    units: [
      {
        code: 'PPD 311',
        name: 'pharmaceutical-botany',
        title: 'Pharmaceutical Botany',
        description: 'Plant kingdom, morphology, anatomy and botanical techniques',
        order: 1,
        estimatedHours: 20,
        topics: [
          {
            name: 'Introduction to Pharmacognosy',
            description: 'Definition, scope and history of pharmacognosy',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Introduction to Pharmacognosy',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/introduction to pharmacognosy.pdf',
                description: 'Introduction to pharmacognosy discipline',
              },
              {
                title: 'Pharmacognosy Intro – Lecture 1',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/Pharmacognosy- intro-Lect 1.ppt',
                description: 'Introductory lecture slides',
              },
            ],
          },
          {
            name: 'Plant Kingdom and Taxonomy',
            description: 'Algae, fungi, gymnosperms, angiosperms and plant classification',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Intro to Plantae Kingdom',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/intro to plantae kingdom-4.ppt',
                description: 'Plant kingdom overview',
              },
              {
                title: 'Algae and Fungi',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/Algae, fungi,  lecture-3.ppt',
                description: 'Algae and fungi in pharmacognosy',
              },
              {
                title: 'Gymnosperms',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/gymnosperms- 5.ppt',
                description: 'Gymnosperm taxonomy',
              },
              {
                title: 'Angiosperms',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/angiosperms-6.ppt',
                description: 'Angiosperm taxonomy',
              },
            ],
          },
          {
            name: 'Plant Morphology and Anatomy',
            description: 'Root, stem, leaf, flower morphology and microscopic anatomy',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Plant Anatomy and Morphology',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/plant anatomy and morpholgy lecture- 9.ppt',
                description: 'Plant anatomy and morphology lecture',
              },
              {
                title: 'Angiosperm Morphology',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/angiosperm, morphology-lecture.ppt',
                description: 'Angiosperm morphology',
              },
            ],
          },
          {
            name: 'Botanical Techniques',
            description: 'Microscopy, staining and botanical identification techniques',
            order: 4,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Botanical Techniques',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 311-Pharmaceutical botany/Botanical Techniques.pdf',
                description: 'Botanical identification techniques',
              },
            ],
          },
        ],
      },
      {
        code: 'PPD 312',
        name: 'commerce-production-crude-drugs',
        title: 'Commerce and Production of Medicinal Plants',
        description: 'Trade, cultivation, quality and processing of medicinal plants and crude drugs',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Introduction to Commerce and Production',
            description: 'Global trade and production of medicinal plants',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'PPD 312 – Introduction to Commerce and Production',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 312/PPD 312 1 Introduction to Commerce and production of medicinal plants.pptx',
                description: 'Commerce and production of medicinal plants',
              },
            ],
          },
          {
            name: 'Cultivation and Processing of Medicinal Plants',
            description: 'GAP, cultivation methods, harvesting and post-harvest processing',
            order: 2,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'PPD 312 – Cultivation I',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 312/PPD 312 5 Cultivation of medicinal plants I.pptx',
                description: 'Medicinal plant cultivation – part 1',
              },
              {
                title: 'PPD 312 – Cultivation II',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 312/PPD 312 6 Cultivation of medicinal plants II.pdf',
                description: 'Medicinal plant cultivation – part 2',
              },
              {
                title: 'Good Agricultural Practices',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/good agricultural practices for medicinal plamnts.pdf',
                description: 'GAP for medicinal plants',
              },
            ],
          },
          {
            name: 'Characterisation of Crude Drugs',
            description: 'Macroscopic and microscopic characterisation of medicinal plant materials',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPD 312 – Microscopic Characterisation',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 312/PPD 312 7 Microscopic characterization of medicinal plants.pptx',
                description: 'Microscopic characterisation',
              },
              {
                title: 'PPD 312 – Macroscopic Characterisation',
                type: 'notes',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/PPD 312/PPD 312 8 Macroscopic characterization of medicinal plants.pptx',
                description: 'Macroscopic characterisation',
              },
            ],
          },
        ],
      },
      {
        code: 'PPD 313',
        name: 'pharmacognosy-carbohydrates',
        title: 'Pharmacognosy – Carbohydrates',
        description: 'Carbohydrates of pharmacognostic significance: gums, mucilages and starches',
        order: 3,
        estimatedHours: 10,
        topics: [
          {
            name: 'Carbohydrates in Pharmacognosy',
            description: 'Gums, mucilages, starch and their pharmaceutical applications',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'PPD 313 – Carbohydrates',
                type: 'pdf',
                content: 'LEVEL 3/3.1/PPD 310 PHARMACOGNOSY I/pharmacognosy-carbohydrates/PPD313 CARBOHYDRATES.pdf',
                description: 'Carbohydrates in pharmacognosy',
              },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 3 · SEMESTER 2
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pharmaceutics II (PPA 320) ────────────────────────────────────────────
  {
    code: 'PPA-320',
    name: 'pharmaceutics-ii',
    title: 'Pharmaceutics II',
    description: 'Physical pharmacy: colloids, interfacial phenomena, rheology and complexation.',
    difficulty: CourseDifficulty.intermediate,
    status: CourseStatus.published,
    categoryName: 'Pharmaceutics',
    questionCategory: QuestionCategory.pharmaceutics,
    tags: ['pharmaceutics', 'physical-pharmacy', 'rheology', 'year-3', 'semester-2'],
    units: [
      {
        code: 'PPA 321',
        name: 'physical-pharmacy-ii',
        title: 'Physical Pharmaceutical Sciences II',
        description: 'Colloids, adsorption, electrical properties, phase rule, complexation and solubility',
        order: 1,
        estimatedHours: 25,
        topics: [
          {
            name: 'Interfacial Phenomena',
            description: 'Surface tension, surfactants and interfacial adsorption',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Interfacial Phenomena',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/KU LEC INTERFACIAL PHENOMENON a.pdf',
                description: 'Interfacial phenomena lecture',
              },
              {
                title: 'Adsorption at Interfaces',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/ADSORPTION AT SOLID AND LIQUID INTERFACES lec 4.pdf',
                description: 'Adsorption at solid-liquid interfaces',
              },
            ],
          },
          {
            name: 'Colloids',
            description: 'Types of colloidal systems, stability and electrical properties',
            order: 2,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Colloids – Lecture 5a',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/COLLOIDS LEC 5a.pdf',
                description: 'Colloidal systems',
              },
              {
                title: 'Electrical Properties of Colloids',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/ELECTRICAL PROPERTIES OF COLLOIDS.pdf',
                description: 'Zeta potential and colloidal stability',
              },
            ],
          },
          {
            name: 'Drug Complexes and Solubility',
            description: 'Complexation, phase rule, solubility of liquids in liquids',
            order: 3,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Drug Complexes',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/DRUG COMLPEXES  AB.pdf',
                description: 'Drug complexation',
              },
              {
                title: 'Phase Rule',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/CHEROGONYI-PHYSICAL PHARMACEUTICAL 2/Phase Rule-KU LEC 7.pdf',
                description: 'Phase rule in pharmacy',
              },
            ],
          },
        ],
      },
      {
        code: 'PPA 322',
        name: 'rheology',
        title: 'Rheology',
        description: 'Viscosity, flow types, viscoelasticity and pharmaceutical applications',
        order: 2,
        estimatedHours: 15,
        topics: [
          {
            name: 'Fundamentals of Rheology',
            description: 'Newtonian vs non-Newtonian flow, viscosity and rheometers',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Rheology',
                type: 'notes',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/rheology/Rheology.pptx',
                description: 'Rheology fundamentals',
              },
              {
                title: 'Rheometers',
                type: 'notes',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/rheology/Rheometers.pptx',
                description: 'Rheometer types and measurements',
              },
              {
                title: 'Viscoelasticity',
                type: 'notes',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/rheology/Viscoelasticity.pptx',
                description: 'Viscoelastic behaviour of pharmaceutical systems',
              },
              {
                title: 'Time-Dependent Behaviour',
                type: 'notes',
                content: 'LEVEL 3/3.2/PPA 320 PHARMACEUTICS/rheology/Time dependent behavior.pptx',
                description: 'Thixotropy and rheopexy',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmacology II (PPB 320) ─────────────────────────────────────────────
  {
    code: 'PPB-320',
    name: 'pharmacology-ii',
    title: 'Pharmacology II',
    description: 'Autonomic nervous system pharmacology and central nervous system pharmacology.',
    difficulty: CourseDifficulty.intermediate,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    isFeatured: true,
    tags: ['pharmacology', 'autonomic', 'CNS', 'year-3', 'semester-2'],
    materials: [
      {
        title: 'KDT – Essentials of Medical Pharmacology 7th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACOLOGY/KDT - Essentials of Medical Pharmacology [7th Edition].pdf',
        description: 'Primary pharmacology textbook',
      },
    ],
    units: [
      {
        code: 'PPB 321',
        name: 'ans-pharmacology',
        title: 'Autonomic Nervous System Pharmacology',
        description: 'Cholinergic, adrenergic, ganglionic pharmacology and neuromuscular blockers',
        order: 1,
        estimatedHours: 30,
        topics: [
          {
            name: 'Overview of the Autonomic Nervous System',
            description: 'ANS anatomy, neurotransmitters and receptor types',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Lesson 1 – Overview of ANS',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 1 Overview of ANS.pdf',
                description: 'ANS overview',
              },
            ],
          },
          {
            name: 'Cholinergic Pharmacology',
            description: 'Parasympathomimetics, anticholinergics and ganglionic blocking agents',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 2 – Parasympathomimetics',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/lesson 2 Parasympathomimetics or Cholinoceptor-Activating Drugs.pdf',
                description: 'Cholinoceptor-activating drugs',
              },
              {
                title: 'Lesson 3 – Anticholinergic Drugs',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 3 AntCholinergic Drugs.pdf',
                description: 'Anticholinergic pharmacology',
              },
              {
                title: 'Lesson 4 – Ganglionic Blocking Agents',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 4 Ganglion BLocking agens.pdf',
                description: 'Ganglionic blocking agents',
              },
            ],
          },
          {
            name: 'Adrenergic Pharmacology',
            description: 'Sympathomimetics, sympatholytics and adrenoceptor types',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 4 – Sympathomimetic Drugs',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 4 Sympathomimetic Drugs.pdf',
                description: 'Sympathomimetic pharmacology',
              },
              {
                title: 'Lesson 5 – Sympathomimetic Agents II',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 5 SYMPATHOMIMETIC AGENTS - II.pdf',
                description: 'Sympathomimetics – continued',
              },
              {
                title: 'Lesson 6 – Sympatholytic Agents',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 6 Sympatholytic agents.pdf',
                description: 'Alpha- and beta-blockers',
              },
            ],
          },
          {
            name: 'Neuromuscular Blockers and Skeletal Muscle Relaxants',
            description: 'Depolarising and non-depolarising NMBs, centrally acting relaxants',
            order: 4,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Lesson 5 – Skeletal Muscle Relaxants',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 5 Skeletal Muscle Relaxants.pdf',
                description: 'Skeletal muscle relaxant pharmacology',
              },
              {
                title: 'Lesson 7 – Neuromuscular Blockers',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology ANS/Lesson 7 Neuromuscualr blocker.pdf',
                description: 'Neuromuscular blocking agents',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 322',
        name: 'cns-pharmacology',
        title: 'CNS Pharmacology',
        description: 'Sedatives, hypnotics, antiepileptics, antidepressants and antipsychotics',
        order: 2,
        estimatedHours: 30,
        topics: [
          {
            name: 'General CNS Pharmacology',
            description: 'CNS neurotransmitters, receptor pharmacology and drug classes overview',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'CNS Pharmacology – Overview',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology CNS/CNS PHARMACOLOGY.pdf',
                description: 'CNS pharmacology overview',
              },
            ],
          },
          {
            name: 'Antiseizure Drugs',
            description: 'Mechanism-based classification, phenytoin, valproate, carbamazepine and newer agents',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Antiseizure Drugs',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology CNS/CNS pharmacology antiseizure drugs.pdf',
                description: 'Antiepileptic drug pharmacology',
              },
            ],
          },
          {
            name: 'Antidepressants',
            description: 'TCAs, SSRIs, SNRIs, MAOIs and atypical antidepressants',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Antidepressants Notes',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology CNS/PPB 320 ANTIDEPRESSANTS NOTES.pdf',
                description: 'Antidepressant pharmacology',
              },
            ],
          },
          {
            name: 'Z-Compounds and Anxiolytics',
            description: 'Benzodiazepines, Z-drugs, buspirone and sleep pharmacology',
            order: 4,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Z-Compounds',
                type: 'pdf',
                content: 'LEVEL 3/3.2/PPB 320 PHARMACOLOGY/pharmacology CNS/CNS pharmacology z-compounds.pdf',
                description: 'Z-drugs and anxiolytics',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmacology III (PPB 330) ────────────────────────────────────────────
  {
    code: 'PPB-330',
    name: 'pharmacology-iii',
    title: 'Pharmacology III',
    description: 'Cardiovascular, renal (diuretics), endocrine, GIT and immunosuppressant pharmacology.',
    difficulty: CourseDifficulty.intermediate,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    isFeatured: true,
    tags: ['pharmacology', 'cardiovascular', 'endocrine', 'diuretics', 'year-3', 'semester-3'],
    units: [
      {
        code: 'PPB 331',
        name: 'diuretics',
        title: 'Diuretics',
        description: 'Mechanisms and clinical use of all major diuretic classes',
        order: 1,
        estimatedHours: 15,
        topics: [
          {
            name: 'Overview and Carbonic Anhydrase Inhibitors',
            description: 'Renal pharmacology overview and acetazolamide',
            order: 1,
            estimatedMinutes: 30,
            materials: [
              {
                title: 'Lesson 2 – Basic Pharmacology of Diuretics',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 2 Basic Pharmacology of Diuretics-12.pdf',
                description: 'Diuretic pharmacology overview',
              },
              {
                title: 'Lesson 3 – Carbonic Anhydrase Inhibitors',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 3 Carbonic Anyhydrase Inhibitors.pdf',
                description: 'Carbonic anhydrase inhibitors',
              },
              {
                title: 'Lesson 4 – Osmotic Diuretics',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 4 Osmotic Diuretics.pdf',
                description: 'Osmotic diuretics',
              },
            ],
          },
          {
            name: 'Loop, Thiazide and Potassium-Sparing Diuretics',
            description: 'Furosemide, hydrochlorothiazide, spironolactone and triamterene',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Lesson 5 – Loop Diuretics',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 5 Loop Diuretics.pdf',
                description: 'Loop diuretics',
              },
              {
                title: 'Lesson 6 – Thiazide Diuretics',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 6 Thiazides Diuretics.pdf',
                description: 'Thiazide diuretics',
              },
              {
                title: 'Lesson 7 – Potassium Sparing',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/Lesson 7 Potassium Sparing.pdf',
                description: 'Potassium-sparing diuretics',
              },
              {
                title: 'Lesson 7 – ADH Agonists and Antagonists',
                type: 'pdf',
                content: 'LEVEL 3/3.3/diuretics/lesson 7 ADH Agonists and Antagonists.pdf',
                description: 'ADH pharmacology',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 332',
        name: 'git-pharmacology',
        title: 'Gastrointestinal Pharmacology',
        description: 'Drugs for peptic ulcer, IBD, motility disorders, antiemetics and laxatives',
        order: 2,
        estimatedHours: 15,
        topics: [
          {
            name: 'GIT Pharmacology',
            description: 'Antacids, PPIs, H2 blockers, prokinetics and antiemetics',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'GIT Pharmacology Lecture 1',
                type: 'pdf',
                content: 'LEVEL 3/3.3/GIT PHARMACOLOGY/GIT LECT 1.pdf',
                description: 'GIT pharmacology introduction',
              },
              {
                title: 'GIT Pharmacology Notes',
                type: 'pdf',
                content: 'LEVEL 3/3.3/GIT PHARMACOLOGY/GIT COLOGY.pdf',
                description: 'Comprehensive GIT pharmacology notes',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 333',
        name: 'endocrine-pharmacology',
        title: 'Endocrine Pharmacology',
        description: 'Insulin, oral hypoglycaemics, corticosteroids, thyroid drugs and immunosuppressants',
        order: 3,
        estimatedHours: 25,
        topics: [
          {
            name: 'Insulin and Oral Hypoglycaemic Agents',
            description: 'Insulin types, sulphonylureas, biguanides, GLP-1 agonists and SGLT2 inhibitors',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'PPB 333 Lesson 1',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/PPB 333 LESSON 1.pdf',
                description: 'Endocrine pharmacology – introduction',
              },
              {
                title: 'PPB 333 Lesson 2',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/PPB 333 LESSON 2.pdf',
                description: 'Insulin and OHAs',
              },
              {
                title: 'Lesson 8 – Other OHA Agents',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/Lesson 8 Other OHA agents.pdf',
                description: 'Newer OHA agents',
              },
            ],
          },
          {
            name: 'Adrenocorticosteroids and Thyroid Drugs',
            description: 'Glucocorticoids, mineralocorticoids, antithyroid drugs and thyroid replacement',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPB 333 Lesson 4 – Corticosteroids',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/PPB 333 LESSON 4.pdf',
                description: 'Corticosteroid pharmacology',
              },
              {
                title: 'Lesson 9 – Adrenocorticosteroids Agonist & Antagonist',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/Lesson 9 Adrenocorticosteroids agonist & antagonist.pdf',
                description: 'Adrenocorticosteroid agonists and antagonists',
              },
            ],
          },
          {
            name: 'Immunosuppressants',
            description: 'Mechanism and clinical use of immunosuppressive drugs',
            order: 3,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Lesson 10 – Immunosuppressants',
                type: 'pdf',
                content: 'LEVEL 3/3.3/ENDOCRINE PHARMACOLOGY/lesson 10 Immunosuppresants.pdf',
                description: 'Immunosuppressant pharmacology',
              },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 4 · SEMESTER 1
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pharmacology IV (PPB 410) ─────────────────────────────────────────────
  {
    code: 'PPB-410',
    name: 'pharmacology-iv',
    title: 'Pharmacology IV',
    description: 'Reproductive pharmacology, chemotherapy of parasitic infections and antimicrobial agents.',
    difficulty: CourseDifficulty.advanced,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    isFeatured: true,
    tags: ['pharmacology', 'reproductive', 'antimicrobials', 'antiparasitic', 'year-4', 'semester-1'],
    units: [
      {
        code: 'PPB 411',
        name: 'reproductive-pharmacology',
        title: 'Reproductive Pharmacology',
        description: 'Oestrogens, progestins, androgens, contraceptives, fertility and pregnancy drugs',
        order: 1,
        estimatedHours: 25,
        topics: [
          {
            name: 'Oestrogens, Progestins and Contraceptives',
            description: 'Female sex hormones, mechanism of action and contraceptive pharmacology',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'PPB 411 Lecture 1 – Oestrogens and Progestins',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Dr Nderitu lecture 1 estrogens and progestins.pdf',
                description: 'Oestrogen and progestin pharmacology',
              },
              {
                title: 'Progestin Contraceptives',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Progestin contraceptives.pdf',
                description: 'Progestin-based contraceptives',
              },
            ],
          },
          {
            name: 'Androgens, Fertility and Menopause',
            description: 'Androgens, BPH drugs, fertility drugs and menopausal pharmacotherapy',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lecture 7 – Androgens',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Lecture 7 - Androgens - NOTES.pdf',
                description: 'Androgen pharmacology',
              },
              {
                title: 'Antiandrogens and BPH',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/antiandrogens and BPH.pdf',
                description: 'Antiandrogens and BPH management',
              },
              {
                title: 'Lecture 5 – Drugs Affecting Fertility',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Lecture 5 - Drugs for sexual maturation & affecting fertility- notes (1).pdf',
                description: 'Fertility drugs',
              },
              {
                title: 'Menopausal Drugs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Menopausal drugs.pdf',
                description: 'Menopausal hormone therapy',
              },
            ],
          },
          {
            name: 'Drugs in Pregnancy',
            description: 'Drug safety categories, oxytocics, tocolytics and teratogenicity',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Lecture 4 – Drugs in Pregnancy',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 411-REPRODUCTIVE PHARMACOLOGY/Lecture 4 - Drugs in Pregnancy (1).pdf',
                description: 'Drugs in pregnancy',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 412',
        name: 'parasitic-infections-chemotherapy',
        title: 'Chemotherapy of Parasitic Infections',
        description: 'Antimalarials, antiprotozoals, antihelminthics, scabicides and veterinary pharmacology',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Antimalarial Drugs',
            description: 'Chloroquine, mefloquine, artemisinin combinations and prophylaxis',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Anti-Malaria',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 412-PARASITIC INFECTIONS CHEMOTHERAPY/Anti-Malaria.pdf',
                description: 'Antimalarial pharmacology',
              },
            ],
          },
          {
            name: 'Antiprotozoals and Antihelminthics',
            description: 'Drugs for amoebiasis, giardiasis, leishmaniasis, helminths and scabies',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Drugs for Amoebiasis, Giardiasis and Trichomoniasis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 412-PARASITIC INFECTIONS CHEMOTHERAPY/Drugs For Amoebiasis,Giardiasis and Trichomoniasis.pdf',
                description: 'Antiprotozoal drugs',
              },
              {
                title: 'Anti-Helminthic Drugs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 412-PARASITIC INFECTIONS CHEMOTHERAPY/Anti-Helminthic Drugs.pdf',
                description: 'Antihelminthic pharmacology',
              },
              {
                title: 'Scabies and Lice',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 412-PARASITIC INFECTIONS CHEMOTHERAPY/SCABIES AND LICE.pdf',
                description: 'Ectoparasite treatment',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 413',
        name: 'antimicrobials',
        title: 'Antimicrobial Agents',
        description: 'Beta-lactams, aminoglycosides, macrolides, fluoroquinolones, antimycobacterials and antifungals',
        order: 3,
        estimatedHours: 30,
        topics: [
          {
            name: 'Principles of Antimicrobial Therapy',
            description: 'Classification, MIC, MBC and principles of rational antimicrobial use',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Principles of Antimicrobial Therapy',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/PPB 413 Principles of antimicrobial therapy.pdf',
                description: 'Antimicrobial therapy principles',
              },
              {
                title: 'Lecture 1 – Introduction to Antimicrobial Chemotherapy',
                type: 'notes',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/Lecture1- Introduction to Antimicrobial Chemotherapy.pptx',
                description: 'Introduction to antimicrobial agents',
              },
            ],
          },
          {
            name: 'Cell Wall Active Agents – Beta-Lactams',
            description: 'Penicillins, cephalosporins, carbapenems, monobactams and beta-lactamase inhibitors',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'KU Lecture 4 – Beta-Lactam Antibiotics',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 4 - Cell Wall Membrane Active agents - Beta Lactam Antibiotics.pdf',
                description: 'Beta-lactam antibiotics',
              },
            ],
          },
          {
            name: 'Protein Synthesis Inhibitors',
            description: 'Aminoglycosides, tetracyclines, macrolides, chloramphenicol, linezolid',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'KU Lecture 6 – Protein Synthesis Inhibitors I',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 6- Protein Synthesis Inhibitors I - 41.pdf',
                description: 'Protein synthesis inhibitors part 1',
              },
              {
                title: 'KU Lecture 7 – Protein Synthesis Inhibitors II',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 7- Protein Synthesis Inhibitors II - 47.pdf',
                description: 'Protein synthesis inhibitors part 2',
              },
              {
                title: 'KU Lecture 8 – Protein Synthesis Inhibitors III',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 8 - Protein Synthesis Inhibitors III - 45.pdf',
                description: 'Protein synthesis inhibitors part 3',
              },
            ],
          },
          {
            name: 'Fluoroquinolones, Antifolates and Miscellaneous',
            description: 'Quinolones, sulphonamides, trimethoprim and miscellaneous antimicrobials',
            order: 4,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPB 413 – Fluoroquinolones',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/PPB 413 Fluoroquinolones and urinary antiseptis .pdf',
                description: 'Fluoroquinolone pharmacology',
              },
              {
                title: 'PPB 413 – Folate Antagonists',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/PPB 413 Folate antagonists.pdf',
                description: 'Sulphonamides and trimethoprim',
              },
              {
                title: 'KU Lecture 9 – Miscellaneous Antimicrobials',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 9- Miscellanenous Antimicrobial Agents - 19.pdf',
                description: 'Miscellaneous antimicrobial agents',
              },
            ],
          },
          {
            name: 'Antimycobacterial Drugs',
            description: 'First- and second-line TB drugs, antileprosy agents',
            order: 5,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'KU Lecture 10 – Antimycobacterial Drugs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL 4.1/PPB 410 PHARMACOLOGY/PPB 413-ANTIMICROBIALS/KU - LECTURE 10- Antimycobacterial Drugs - I - 110pptx.pdf',
                description: 'Antimycobacterial pharmacology',
              },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 4 · SEMESTER 2
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pharmaceutics IV (PPA 420) ────────────────────────────────────────────
  {
    code: 'PPA-420',
    name: 'pharmaceutics-iv',
    title: 'Pharmaceutics IV',
    description: 'Advanced pharmacokinetics, suspensions, emulsions and semi-solid dosage forms.',
    difficulty: CourseDifficulty.advanced,
    status: CourseStatus.published,
    categoryName: 'Pharmaceutics',
    questionCategory: QuestionCategory.pharmaceutics,
    tags: ['pharmaceutics', 'pharmacokinetics', 'semi-solid', 'emulsions', 'year-4', 'semester-2'],
    units: [
      {
        code: 'PPA 421',
        name: 'advanced-pharmacokinetics',
        title: 'Advanced Pharmacokinetics',
        description: 'Drug distribution models, elimination, clearance and compartmental analysis',
        order: 1,
        estimatedHours: 25,
        topics: [
          {
            name: 'Drug Distribution',
            description: 'Compartmental distribution, volume of distribution and protein binding',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Drug Distribution 1',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 421/1. Drug Distribution1-1.pdf',
                description: 'Drug distribution – part 1',
              },
              {
                title: 'Drug Distribution 2',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 421/2. Drug Distribution2.pdf',
                description: 'Drug distribution – part 2',
              },
              {
                title: 'Drug Distribution 3',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 421/3. Drug Distribution3.pdf',
                description: 'Drug distribution – part 3',
              },
            ],
          },
          {
            name: 'Drug Elimination',
            description: 'Hepatic and renal clearance, half-life and elimination rate constant',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Drug Elimination – Hepatic Clearance',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 421/4. Drug Elimination - 1 Hepatic clearance.pdf',
                description: 'Hepatic drug clearance',
              },
              {
                title: 'Drug Elimination – Renal Clearance',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 421/5. Drug Elimination  1-Renal clearance.pdf',
                description: 'Renal drug clearance',
              },
            ],
          },
        ],
      },
      {
        code: 'PPA 422',
        name: 'suspensions-emulsions',
        title: 'Suspensions and Emulsions',
        description: 'Formulation, stability and evaluation of pharmaceutical suspensions and emulsions',
        order: 2,
        estimatedHours: 20,
        topics: [
          {
            name: 'Pharmaceutical Suspensions',
            description: 'Formulation, sedimentation theories and stability evaluation',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Suspensions – Part A',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 422/SUSPENSIONS a.pdf',
                description: 'Suspension formulation and stability – part A',
              },
              {
                title: 'Suspensions – Part B',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 422/SUSPENSIONS b.pdf',
                description: 'Suspension formulation and stability – part B',
              },
              {
                title: 'DLVO Theory',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 422/DLVO THEORY KU Lec 3.pdf',
                description: 'DLVO theory and colloidal stability',
              },
            ],
          },
          {
            name: 'Pharmaceutical Emulsions',
            description: 'O/W and W/O emulsions, HLB, emulsifiers and stability',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Emulsions – Lecture 5',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 422/5. EMULSIONS LEC 5.pdf',
                description: 'Emulsion formulation',
              },
              {
                title: 'Emulsion Identification',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 422/6. Emulsion Identification A2.pdf',
                description: 'Emulsion type identification',
              },
            ],
          },
        ],
      },
      {
        code: 'PPA 423',
        name: 'semi-solid-dosage-forms',
        title: 'Semi-Solid Dosage Forms',
        description: 'Ointments, creams, gels, pastes, suppositories and transdermal drug delivery',
        order: 3,
        estimatedHours: 25,
        topics: [
          {
            name: 'Semi-Solid Dosage Forms Overview',
            description: 'Classification, rheology and in-vitro characterisation',
            order: 1,
            estimatedMinutes: 40,
            materials: [
              {
                title: '1. Semi-Solid Dosage Forms',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 423/1. Semi-solid dosage forms.pdf',
                description: 'Overview of semi-solid dosage forms',
              },
            ],
          },
          {
            name: 'Ointments, Pastes and Gels',
            description: 'Bases, formulation principles, preparation and evaluation',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: '2. Ointments and Ointment Bases',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 423/2. Ointments and ointment bases.pdf',
                description: 'Ointment bases and formulation',
              },
              {
                title: '3. Ointments, Pastes and Gels',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 423/3. Ointments, pastes and Gels.pdf',
                description: 'Ointments, pastes and gels',
              },
            ],
          },
          {
            name: 'Topical and Transdermal Drug Delivery',
            description: 'Skin penetration, enhancers, patches and topical bioavailability',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: '4. Topical and Transdermal Drug Delivery',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPA 420/PPA 423/4. Topical and Transdermal Drug Delivery.pdf',
                description: 'Transdermal and topical delivery systems',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Pharmacology V (PPB 420) ──────────────────────────────────────────────
  {
    code: 'PPB-420',
    name: 'pharmacology-v',
    title: 'Pharmacology V',
    description:
      'Antifungal and antiviral agents, dermatological and ocular diseases, and antineoplastic pharmacology.',
    difficulty: CourseDifficulty.advanced,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    isFeatured: true,
    tags: ['pharmacology', 'antifungal', 'antiviral', 'dermatology', 'oncology', 'year-4', 'semester-2'],
    materials: [
      {
        title: 'KDT – Essentials of Medical Pharmacology 7th Edition',
        type: 'pdf',
        content: 'TEXTBOOKS/PHARMACOLOGY/KDT - Essentials of Medical Pharmacology [7th Edition].pdf',
        description: 'Primary pharmacology textbook',
      },
      {
        title: 'Goodman & Gilman – Pharmacological Basis of Therapeutics 13th Edition',
        type: 'pdf',
        content: "TEXTBOOKS/PHARMACOLOGY/Goodman & Gilman's The Pharmacological Basis of Therapeutics - 13th Ed.pdf",
        description: 'Comprehensive pharmacology reference',
      },
    ],
    units: [
      {
        code: 'PPB 421',
        name: 'antifungals-antivirals',
        title: 'Antifungal and Antiviral Agents',
        description: 'Classes of antifungals and antivirals relevant to dermatology and systemic infections',
        order: 1,
        estimatedHours: 18,
        topics: [
          {
            name: 'Antifungal Agents',
            description: 'Polyenes, azoles, allylamines and echinocandins – mechanisms and adverse effects',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPB 421 – Antifungal Agents (slides)',
                type: 'notes',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 421/PPB421ANTIFUNGAL1.pptx',
                description: 'Antifungal pharmacology slides',
              },
              {
                title: 'PPB 421 Notes',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 421/PPB 421 Notes.pdf',
                description: 'Comprehensive antifungal and antiviral notes',
              },
            ],
          },
          {
            name: 'Antiviral Agents',
            description: 'Nucleoside analogues, protease inhibitors and antiretroviral principles',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'PPB 421 – Antivirals I',
                type: 'notes',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 421/PPB421Antivirals1.pptx',
                description: 'Antiviral pharmacology slides – part 1',
              },
              {
                title: 'PPB 421 – Antivirals II (PDF)',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 421/SLIDE3PPB421antivirals.pdf',
                description: 'Antiviral pharmacology – part 2',
              },
              {
                title: 'PPB 421 – Antivirals III',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 421/SLIDE4PPB421Antiviral2.pdf',
                description: 'Antiviral pharmacology – part 3',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 422',
        name: 'dermatology-ocular-core',
        title: 'Dermatological and Ocular Diseases',
        description: 'Acne, psoriasis, drug-induced cutaneous reactions, photosensitivity, glaucoma and conjunctivitis',
        order: 2,
        estimatedHours: 40,
        topics: [
          {
            name: 'Acne and Psoriasis',
            description: 'Pathogenesis, classification and management of acne vulgaris and psoriasis',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Acne and Psoriasis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/2. ACNE  AND PSORIASIS.pdf',
                description: 'Acne and psoriasis management',
              },
            ],
          },
          {
            name: 'Drug-Induced Cutaneous Reactions',
            description: 'Types, presentation and management of adverse drug effects on skin',
            order: 2,
            estimatedMinutes: 50,
            materials: [
              {
                title: 'Drug Cutaneous Reactions (1)',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/3. DRUG CUTANEOUS REACTIONS-1.pdf',
                description: 'Drug-induced skin reactions – part 1',
              },
              {
                title: 'Drug Cutaneous Reactions (2)',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/3. DRUG CUTANEOUS REACTIONS-2.pdf',
                description: 'Drug-induced skin reactions – part 2',
              },
            ],
          },
          {
            name: 'Sunlight Exposure and Photosensitivity',
            description: 'UV radiation effects, drug-induced photosensitivity and photoprotection',
            order: 3,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Sunlight Exposure',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/4. SUNLIGHT EXPOSURE.pdf',
                description: 'UV radiation and photosensitivity',
              },
            ],
          },
          {
            name: 'Glaucoma',
            description: 'IOP, aqueous humour dynamics, drug classes and contraindicated drugs',
            order: 4,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Glaucoma PPB 422',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/5. GLAUCOMA PPB 422.pdf',
                description: 'Glaucoma pathophysiology and therapy',
              },
            ],
          },
          {
            name: 'Ocular Diseases',
            description: 'Anatomy, conjunctivitis, uveitis and ophthalmic drug delivery',
            order: 5,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Skin and Ocular Diseases – The Eye',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 422/6. PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.pdf',
                description: 'Ocular anatomy, diseases and pharmacotherapy',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 423',
        name: 'antineoplastic-agents',
        title: 'Antineoplastic Agents',
        description: 'Classification, mechanisms, resistance and clinical use of anticancer drugs and biologicals',
        order: 3,
        estimatedHours: 30,
        topics: [
          {
            name: 'Classification of Antineoplastic Agents',
            description: 'Alkylating agents, antimetabolites, natural products and miscellaneous cytotoxics',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lecture 1 – Classification of Antineoplastic Agents',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lecture 1 - Classification of Antineoplastic Agents.pdf',
                description: 'Antineoplastic agent classification',
              },
              {
                title: 'Lesson 2 – Overview of Cytotoxic Drugs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 2 - OVERVIEW OF CYTOTOXIC DRUGS.pdf',
                description: 'Cytotoxic drug overview',
              },
              {
                title: 'Lesson 3 – Alkylating Agents',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 3 -Alkylating agents.pdf',
                description: 'Alkylating agents',
              },
              {
                title: 'Lesson 4 – Antimetabolites',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 4 - Antimetabolites.pdf',
                description: 'Antimetabolite anticancer drugs',
              },
              {
                title: 'Lesson 5 – Natural Chemotherapy Products',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 5  - Natural chemotherapy products.pdf',
                description: 'Natural product anticancer drugs',
              },
              {
                title: 'Lesson 6 – Miscellaneous Agents',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 6 - Miscellaneous Agents.pdf',
                description: 'Miscellaneous antineoplastic agents',
              },
            ],
          },
          {
            name: 'Targeted and Biological Antineoplastic Drugs',
            description: 'Monoclonal antibodies, tyrosine kinase inhibitors and biological response modifiers',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 7B – Targeted Drugs Part 1',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 7 B- Targeted antineoplastic drugs - Part 1.pdf',
                description: 'Targeted therapy – part 1',
              },
              {
                title: 'Lesson 8 – Targeted Drugs Part 2',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 8 - Targeted antineoplastic drugs - Part 2 - summarised.pdf',
                description: 'Targeted therapy – part 2',
              },
              {
                title: 'Lesson 9 – Targeted Drugs Part 3',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 9 - Targeted antineoplastic drugs - Part 3.pdf',
                description: 'Targeted therapy – part 3',
              },
              {
                title: 'Lesson 10 – Biological Response Modifiers',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 10 - Biological Response Modifers.pdf',
                description: 'Immunotherapy and biological modifiers',
              },
            ],
          },
          {
            name: 'Resistance, Hormonal Therapy and Combination Regimens',
            description: 'Mechanisms of resistance, hormonal agents and rational combination therapy',
            order: 3,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Lesson 11 – Resistance to Anticancer Drugs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 11 - Resistance to anticancer drugs.pdf',
                description: 'Drug resistance mechanisms',
              },
              {
                title: 'Lesson 12 – Hormones & Hormone Antagonists',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPB 420/PPB 423/KU PPB 423 Lesson 12 - Hormones & Hormone Antagonists used in Neoplastic Diseases.pdf',
                description: 'Hormonal therapy in neoplastic disease',
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Clinical Pharmacy II (PPF 420) ────────────────────────────────────────
  {
    code: 'PPF-420',
    name: 'clinical-pharmacy-ii',
    title: 'Clinical Pharmacy II',
    description:
      'Chemotherapy of parasitic infections, respiratory and infectious diseases, and obstructive/restrictive lung diseases.',
    difficulty: CourseDifficulty.advanced,
    status: CourseStatus.published,
    categoryName: 'Clinical Pharmacy',
    questionCategory: QuestionCategory.clinical_pharmacy,
    isFeatured: true,
    tags: ['clinical-pharmacy', 'respiratory', 'tuberculosis', 'hiv-aids', 'year-4', 'semester-2'],
    materials: [
      {
        title: 'Pharmacotherapy Principles and Practice 5th Edition',
        type: 'pdf',
        content: 'LEVEL 4/LEVEL  4.2/Pharmacotherapy Principles and Practice - 5th Ed 2019.pdf',
        description: 'Primary clinical pharmacy textbook',
      },
      {
        title: 'Roger Walker – Clinical Pharmacy and Therapeutics 6th Edition',
        type: 'pdf',
        content: 'LEVEL 4/LEVEL  4.2/Roger Walker Clinical Pharmacy and Therapeutics, 6th Edition (2018).pdf',
        description: 'Clinical pharmacy and therapeutics reference',
      },
    ],
    units: [
      {
        code: 'PPF 421',
        name: 'chemotherapy-parasitic',
        title: 'Chemotherapy of Parasitic Infections',
        description: 'Pharmacotherapy of amoebiasis, leishmaniasis, trypanosomiasis, malaria and helminths',
        order: 1,
        estimatedHours: 20,
        topics: [
          {
            name: 'Chemotherapy of Protozoa and Amoebiasis',
            description: 'Metronidazole, chloroquine, mefloquine and antiprotozoal selection',
            order: 1,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'SLIDE 1 – PPF 421',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/SLIDE 1(ppf421).pdf',
                description: 'Antiprotozoal pharmacotherapy slides',
              },
              {
                title: 'Chemotherapy of Amoebiasis',
                type: 'notes',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/5CHEMO OF AMOEBIASIS....pptx',
                description: 'Amoebiasis treatment',
              },
              {
                title: 'Chemotherapy of Leishmaniasis and Trypanosomiasis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/0.CHEMO.OFLEISHand TRYPANO...pdf',
                description: 'Leishmaniasis and trypanosomiasis pharmacotherapy',
              },
              {
                title: 'SLIDE 2 – Malaria',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/SLIDE 2.pdf',
                description: 'Malaria chemotherapy',
              },
            ],
          },
          {
            name: 'Antihelminthic Drugs',
            description: 'Benzimidazoles, ivermectin, praziquantel and helminthic infections',
            order: 2,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'SLIDE 4 – Antihelminthics',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/SLIDE 4PPF421 1.pdf',
                description: 'Antihelminthic drug pharmacology',
              },
              {
                title: 'SLIDE 5 – PPF 421',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/SLIDE 5PPF421.pdf',
                description: 'Antihelminthics continued',
              },
              {
                title: 'SLIDE 6 – PPF 421',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 421/SLIDE 6PPF421.pdf',
                description: 'Antihelminthics and related infections',
              },
            ],
          },
        ],
      },
      {
        code: 'PPF 422',
        name: 'respiratory-infectious-diseases',
        title: 'Respiratory and Infectious Diseases',
        description: 'URTI, LRTI, tuberculosis, UTIs, STIs and HIV/AIDS from a clinical pharmacy perspective',
        order: 2,
        estimatedHours: 35,
        topics: [
          {
            name: 'Upper Respiratory Tract Infections',
            description: 'Common cold, sinusitis, pharyngitis, epiglottitis and laryngitis',
            order: 1,
            estimatedMinutes: 50,
            materials: [
              {
                title: 'Lesson 1 – Upper Respiratory Tract Infections',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 1 - Upper Respiratory Tract Infections - 90.pdf',
                description: 'URTI clinical pharmacy management',
              },
              {
                title: 'Lesson 1b – Acute Epiglottitis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/Lesson 1b - Acute epiglottitis.pdf',
                description: 'Epiglottitis management',
              },
              {
                title: 'Lesson 1c – Acute Laryngitis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/Lesson 1c - Acute Laryngitis.pdf',
                description: 'Laryngitis management',
              },
            ],
          },
          {
            name: 'Lower Respiratory Tract Infections',
            description: 'Pneumonia, bronchitis, community- vs hospital-acquired infections',
            order: 2,
            estimatedMinutes: 50,
            materials: [
              {
                title: 'Lesson 2 – Lower Respiratory Tract Infections',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 2 - Lower Respiratory Tract Infections - 52.pdf',
                description: 'LRTI clinical management',
              },
              {
                title: 'Lesson 3 – Lower Respiratory Tract Infections II',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 3 - Lower Respiratory Tract Infections - ii - pdf.pdf',
                description: 'LRTI – continued',
              },
            ],
          },
          {
            name: 'Tuberculosis',
            description: 'First- and second-line TB drugs, DOTS, MDR-TB management',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 4 – Tuberculosis',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 4 -TB -62 - version 9-2022.pdf',
                description: 'TB pharmacotherapy',
              },
            ],
          },
          {
            name: 'Urinary Tract Infections',
            description: 'Uncomplicated and complicated UTIs, catheter-associated UTIs and treatment',
            order: 4,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'Lesson 5 – UTIs',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 5 -UTIs - 55.pdf',
                description: 'UTI clinical management',
              },
            ],
          },
          {
            name: 'Sexually Transmitted Infections',
            description: 'Gonorrhoea, syphilis, chlamydia, herpes and other STIs',
            order: 5,
            estimatedMinutes: 75,
            materials: [
              {
                title: 'Lesson 6 – STIs Part I',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 6 -STIs - i - 77.pdf',
                description: 'STI management – part 1',
              },
              {
                title: 'Lesson 7 – STIs Part II',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 7 -STIs - ii - 68.pdf',
                description: 'STI management – part 2',
              },
              {
                title: 'Lesson 8 – STIs Part III',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 8 -STIs - iii - 19.pdf',
                description: 'STI management – part 3',
              },
            ],
          },
          {
            name: 'HIV/AIDS and Opportunistic Infections',
            description: 'ART regimens, HAART principles, opportunistic infection prophylaxis and monitoring',
            order: 6,
            estimatedMinutes: 90,
            materials: [
              {
                title: 'Lesson 9 – HIV-AIDS & Opportunistic Infections',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 422/PPF 422 - Lesson 9 -HIV-AIDS & OIs - 91 - UPDATED - 2022.pdf',
                description: 'HIV/AIDS clinical pharmacy management',
              },
            ],
          },
        ],
      },
      {
        code: 'PPF 423',
        name: 'obstructive-restrictive-lung',
        title: 'Obstructive and Restrictive Lung Diseases',
        description: 'Asthma, COPD, ARDS, occupational lung diseases and restrictive disorders',
        order: 3,
        estimatedHours: 25,
        topics: [
          {
            name: 'Asthma and COPD',
            description: 'Pathophysiology, stepwise management, inhaler devices and biologic therapies',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'PPF 423 – Asthma and Respiratory Disorders',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 423/PPF 423 RESPIRATORY DISORDERS (1).pdf',
                description: 'Asthma and COPD pharmacotherapy',
              },
            ],
          },
          {
            name: 'Occupational Lung Diseases',
            description: 'Pneumoconiosis, asbestosis, silicosis and occupational asthma',
            order: 2,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'Occupational Lung Disorders',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 423/OCCUPATIONAL LUNG DISORDERS.pdf',
                description: 'Occupational lung disease management',
              },
              {
                title: 'Lesson 8 – Occupational Lung Diseases',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 423/LESSON 8  PPF 423 OCCUPATIONAL LUNG DISEASES.pdf',
                description: 'Occupational lung disease lecture notes',
              },
            ],
          },
          {
            name: 'Acute Respiratory Distress Syndrome',
            description: 'ARDS pathophysiology, Berlin definition and supportive pharmacotherapy',
            order: 3,
            estimatedMinutes: 40,
            materials: [
              {
                title: 'ARDS',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 423/Acute Respiratory Distress Syndrome (ARDS).pdf',
                description: 'ARDS management',
              },
            ],
          },
          {
            name: 'Restrictive Lung Diseases',
            description: 'Interstitial lung diseases, pulmonary fibrosis and management',
            order: 4,
            estimatedMinutes: 35,
            materials: [
              {
                title: 'Restrictive Lung Diseases Notes',
                type: 'pdf',
                content: 'LEVEL 4/LEVEL  4.2/PPF 420/PPF 423/Restrictive lung diseases-notes (1).pdf',
                description: 'Restrictive lung disease pharmacotherapy',
              },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL 5 · SEMESTER 2
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pharmacology VI (PPB 520) ─────────────────────────────────────────────
  {
    code: 'PPB-520',
    name: 'pharmacology-vi',
    title: 'Pharmacology VI',
    description: 'Respiratory pharmacology and cardiovascular pharmacology.',
    difficulty: CourseDifficulty.advanced,
    status: CourseStatus.published,
    categoryName: 'Pharmacology',
    questionCategory: QuestionCategory.pharmacology,
    tags: ['pharmacology', 'cardiovascular', 'respiratory', 'year-5', 'semester-2'],
    units: [
      {
        code: 'PPB 521',
        name: 'respiratory-pharmacology',
        title: 'Respiratory Pharmacology',
        description: 'Bronchodilators, corticosteroids, mAbs in asthma and pulmonary pharmacology',
        order: 1,
        estimatedHours: 20,
        topics: [
          {
            name: 'Pulmonary Pharmacology Overview',
            description: 'Bronchodilators, anti-inflammatory drugs and mucolytics',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Respiratory Pharmacology Notes',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 521/Respiratory_Pharmacology_Notes.pdf',
                description: 'Comprehensive respiratory pharmacology notes',
              },
              {
                title: 'Chapter 44 – Pulmonary Pharmacology',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 521/Chapter 44_ Pulmonary Pharmacology.pdf',
                description: 'Pulmonary pharmacology chapter',
              },
            ],
          },
          {
            name: 'Monoclonal Antibodies in Asthma',
            description: 'Biologics, anti-IL-5, anti-IgE and anti-IL-4/13 therapies',
            order: 2,
            estimatedMinutes: 45,
            materials: [
              {
                title: 'MAbs in Asthma',
                type: 'notes',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 521/MABS IN ASTHMA ppb 523 F 16th NOV.pptx',
                description: 'Monoclonal antibodies in asthma management',
              },
              {
                title: 'Cough Pharmacology',
                type: 'notes',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 521/PPB 523-COUGH F.ppt',
                description: 'Cough pathophysiology and treatment',
              },
            ],
          },
        ],
      },
      {
        code: 'PPB 522',
        name: 'cardiovascular-pharmacology',
        title: 'Cardiovascular Pharmacology',
        description: 'Antihypertensives, antianginals, heart failure, antiarrhythmics and shock management',
        order: 2,
        estimatedHours: 25,
        topics: [
          {
            name: 'Antihypertensives and Diuretics',
            description: 'ACEIs, ARBs, CCBs, beta-blockers, diuretics and combination therapy',
            order: 1,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 5 – Hypertension and Diuretics',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 522/Lesson 5 HTN- Diuretics.pdf',
                description: 'Hypertension and diuretic pharmacotherapy',
              },
            ],
          },
          {
            name: 'Antianginals and Heart Failure',
            description: 'Nitrates, calcium channel blockers, ivabradine; inotropes and vasodilators in HF',
            order: 2,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 6 – Antianginal Drugs',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 522/Lesson 6-2 Antianginal Drugs (Vasodilator).pdf',
                description: 'Antianginal pharmacotherapy',
              },
              {
                title: 'Lesson 7 – Heart Failure Drugs',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 522/Lesson 7 Heart Failure Drugs.pdf',
                description: 'Heart failure pharmacotherapy',
              },
            ],
          },
          {
            name: 'Antiarrhythmics and Shock',
            description: 'Vaughan-Williams classification, digoxin, amiodarone, vasopressors and inotropes',
            order: 3,
            estimatedMinutes: 60,
            materials: [
              {
                title: 'Lesson 9 – Antiarrhythmics',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 522/lesson 9-2 Antiarrhythmics.pdf',
                description: 'Antiarrhythmic pharmacotherapy',
              },
              {
                title: 'Lesson 8 – Management of Shock',
                type: 'pdf',
                content: 'LEVEL 5/LEVEL 5.2/PPB 520/PPB 522/Lesson 8 Management of Shock.pdf',
                description: 'Pharmacological management of shock',
              },
            ],
          },
        ],
      },
    ],
  },

];

// ─── Question category mapping ────────────────────────────────────────────────

const CATEGORY_FOR_DISCIPLINE: Record<string, QuestionCategory> = {
  Biochemistry: QuestionCategory.biochemistry,
  Anatomy: QuestionCategory.anatomy,
  Chemistry: QuestionCategory.chemistry,
  Pharmacology: QuestionCategory.pharmacology,
  Pharmaceutics: QuestionCategory.pharmaceutics,
  'Pharmaceutical Chemistry': QuestionCategory.pharmaceutical_chemistry,
  Pharmacognosy: QuestionCategory.pharmacognosy,
  'Clinical Pharmacy': QuestionCategory.clinical_pharmacy,
  Pathology: QuestionCategory.pathology,
  Physiology: QuestionCategory.physiology,
  Microbiology: QuestionCategory.general,
  Genetics: QuestionCategory.general,
  Mathematics: QuestionCategory.general,
};

// ─── Seeder ───────────────────────────────────────────────────────────────────

async function seedCourses() {
  console.log('🌱  Starting KU Pharmacy course seeder…\n');

  const LOCAL_ROOT = 'C:\\Users\\user\\Pharmacy';

  // ── Load optional file-mappings ───────────────────────────────────────────
  let fileMappings: Record<string, { s3Url: string; key: string; fileId: string }> = {};
  try {
    const raw = await fs.readFile(path.resolve(__dirname, 'file-mappings.json'), 'utf-8');
    fileMappings = JSON.parse(raw);
    console.log('🔎  Loaded file-mappings.json');
  } catch {
    console.log('ℹ️   No file-mappings.json – using local paths');
  }

  function resolveContent(rawContent: string): string {
    if (rawContent.startsWith('http')) return rawContent;
    const byPath = fileMappings[rawContent];
    if (byPath) return byPath.s3Url;
    const localAbs = path.join(LOCAL_ROOT, rawContent).replace(/\\/g, '/');
    return `file:///${localAbs}`;
  }

  // ── Admin user ────────────────────────────────────────────────────────────
  let adminUser = await prisma.user.findFirst({ where: { email: 'admin@medical.edu' } });
  const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
  if (!adminRole) throw new Error('Admin role not found. Run role seeding first.');

  if (!adminUser) {
    adminUser = await prisma.user.upsert({
      where: { email: 'admin@medical.edu' },
      update: {},
      create: {
        email: 'admin@medical.edu',
        firstName: 'System',
        lastName: 'Administrator',
        isActive: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });
    console.log('✅  Admin user created');
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const uniqueCategories = [...new Set(COURSES.map((c) => c.categoryName))];
  const categoryMap = new Map<string, string>();

  for (const catName of uniqueCategories) {
    const slug = slugify(catName);
    const cat = await prisma.courseCategory.upsert({
      where: { slug },
      update: { name: catName },
      create: {
        name: catName,
        slug,
        description: `${catName} courses for pharmacy and medical sciences`,
      },
    });
    categoryMap.set(catName, cat.id);
    console.log(`  📂  Category: ${catName}`);
  }

  // ── Courses ───────────────────────────────────────────────────────────────
  for (const courseDef of COURSES) {
    const qCategory =
      courseDef.questionCategory ??
      CATEGORY_FOR_DISCIPLINE[courseDef.categoryName] ??
      QuestionCategory.general;

    // 1. Upsert course
    const course = await prisma.course.upsert({
      where: { code: courseDef.code },
      update: {
        title: courseDef.title,
        name: courseDef.name,
        description: courseDef.description,
        difficulty: courseDef.difficulty,
        status: courseDef.status,
        estimatedHours: courseDef.units.reduce((s, u) => s + u.estimatedHours, 0),
        categoryId: categoryMap.get(courseDef.categoryName)!,
        tags: courseDef.tags,
        isFeatured: courseDef.isFeatured ?? false,
        updatedAt: new Date(),
      },
      create: {
        code: courseDef.code,
        name: courseDef.name,
        title: courseDef.title,
        description: courseDef.description,
        difficulty: courseDef.difficulty,
        status: courseDef.status,
        estimatedHours: courseDef.units.reduce((s, u) => s + u.estimatedHours, 0),
        categoryId: categoryMap.get(courseDef.categoryName)!,
        createdById: adminUser.id,
        tags: courseDef.tags,
        isFeatured: courseDef.isFeatured ?? false,
        enrollmentCount: 0,
        rating: 0,
        price: 0,
      },
    });
    console.log(`\n📘  Course: ${courseDef.code} – ${courseDef.title}`);

    // 2. Course-level materials
    if (courseDef.materials?.length) {
      for (let mi = 0; mi < courseDef.materials.length; mi++) {
        const mat = courseDef.materials[mi];
        const matId = deterministicId('cmat', courseDef.code, String(mi));
        const fileId = deterministicId('file', courseDef.code, String(mi));

        await prisma.file.upsert({
          where: { id: fileId },
          update: { filename: mat.title, updatedAt: new Date() },
          create: {
            id: fileId,
            filename: mat.title,
            mimetype: mat.type === 'pdf' ? 'application/pdf' : 'application/octet-stream',
            size: 0,
            uploadedById: adminUser.id,
          },
        });

        await prisma.material.upsert({
          where: { id: matId },
          update: {
            title: mat.title,
            description: mat.description,
            content: resolveContent(mat.content),
            type: mat.type as MaterialType,
            fileId,
            updatedAt: new Date(),
          },
          create: {
            id: matId,
            title: mat.title,
            type: mat.type as MaterialType,
            content: resolveContent(mat.content),
            description: mat.description,
            fileId,
            courseId: course.id,
            userId: adminUser.id,
          },
        });
      }
      console.log(`   📎  ${courseDef.materials.length} course-level material(s) upserted`);
    }

    // 3. Units → Topics → Materials → Quiz → Questions
    for (const unitDef of courseDef.units) {
      const unitSlug = slugify(unitDef.code);

      const unit = await prisma.unit.upsert({
        where: { courseId_order: { courseId: course.id, order: unitDef.order } },
        update: {
          name: unitDef.name,
          title: unitDef.title,
          description: unitDef.description,
          estimatedDuration: unitDef.estimatedHours,
          estimatedMinutes: unitDef.estimatedHours * 60,
          slug: unitSlug,
          updatedAt: new Date(),
        },
        create: {
          name: unitDef.name,
          title: unitDef.title,
          description: unitDef.description,
          order: unitDef.order,
          estimatedDuration: unitDef.estimatedHours,
          estimatedMinutes: unitDef.estimatedHours * 60,
          courseId: course.id,
          slug: unitSlug,
          isPublished: true,
        },
      });
      console.log(`   📗  Unit ${unitDef.code}: ${unitDef.title}`);

      for (const topicDef of unitDef.topics) {
        const topicSlug = slugify(topicDef.name);

        const topic = await prisma.topic.upsert({
          where: { unitId_order: { unitId: unit.id, order: topicDef.order } },
          update: {
            name: topicDef.name,
            description: topicDef.description,
            estimatedMinutes: topicDef.estimatedMinutes,
            slug: topicSlug,
            updatedAt: new Date(),
          },
          create: {
            name: topicDef.name,
            description: topicDef.description,
            order: topicDef.order,
            unitId: unit.id,
            estimatedMinutes: topicDef.estimatedMinutes,
            slug: topicSlug,
          },
        });

        // Topic materials
        if (topicDef.materials?.length) {
          for (let mi = 0; mi < topicDef.materials.length; mi++) {
            const mat = topicDef.materials[mi];
            const matId = deterministicId(
              'tmat',
              courseDef.code,
              unitDef.code,
              String(topicDef.order),
              String(mi),
            );

            await prisma.material.upsert({
              where: { id: matId },
              update: {
                title: mat.title,
                description: mat.description,
                content: resolveContent(mat.content),
                type: mat.type as MaterialType,
                updatedAt: new Date(),
              },
              create: {
                id: matId,
                title: mat.title,
                type: mat.type as MaterialType,
                content: resolveContent(mat.content),
                description: mat.description,
                courseId: course.id,
                unitId: unit.id,
                topicId: topic.id,
                userId: adminUser.id,
              },
            });
          }
        }

        // Placeholder quiz
        const quizId = deterministicId('quiz', courseDef.code, unitDef.code, String(topicDef.order));
        const quiz = await prisma.quiz.upsert({
          where: { id: quizId },
          update: {
            title: `Quiz: ${unitDef.title} – ${topicDef.name}`,
            isPublished: true,
            updatedAt: new Date(),
          },
          create: {
            id: quizId,
            title: `Quiz: ${unitDef.title} – ${topicDef.name}`,
            description: `Review quiz for ${topicDef.name}`,
            unitId: unit.id,
            topicId: topic.id,
            categoryId: categoryMap.get(courseDef.categoryName)!,
            createdBy: adminUser.id,
            isPublished: true,
            questionCount: 0,
          },
        });

        // Placeholder question
        const questionId = deterministicId(
          'q', courseDef.code, unitDef.code, String(topicDef.order), '1',
        );
        const question = await prisma.question.upsert({
          where: { id: questionId },
          update: {
            text: `What is the primary concept covered in "${topicDef.name}"?`,
            updatedAt: new Date(),
          },
          create: {
            id: questionId,
            text: `What is the primary concept covered in "${topicDef.name}"?`,
            type: QuestionType.multiple_choice,
            difficulty: QuestionDifficulty.easy,
            category: qCategory,
            conceptsCovered: [],
            tags: [slugify(topicDef.name), slugify(unitDef.name)],
            points: 1,
            createdBy: adminUser.id,
            courseId: course.id,
            unitId: unit.id,
            topicIds: [topic.id],
          },
        });

        // Options
        const optionDefs = [
          { suffix: 'a', text: `Core concept of ${topicDef.name}`, isCorrect: true },
          { suffix: 'b', text: 'Distractor option B', isCorrect: false },
          { suffix: 'c', text: 'Distractor option C', isCorrect: false },
        ];
        for (let oi = 0; oi < optionDefs.length; oi++) {
          const od = optionDefs[oi];
          const optId = deterministicId(
            'opt', courseDef.code, unitDef.code, String(topicDef.order), '1', od.suffix,
          );
          await prisma.option.upsert({
            where: { id: optId },
            update: { text: od.text, isCorrect: od.isCorrect, order: oi + 1 },
            create: {
              id: optId,
              questionId: question.id,
              text: od.text,
              isCorrect: od.isCorrect,
              order: oi + 1,
            },
          });
        }

        // Link question → quiz
        await prisma.quizQuestion.upsert({
          where: { quizId_questionId: { quizId: quiz.id, questionId: question.id } },
          update: {},
          create: { quizId: quiz.id, questionId: question.id, order: 1, points: 1 },
        });
        await prisma.quiz.update({ where: { id: quiz.id }, data: { questionCount: 1 } });
      }
    }

    console.log(
      `   ✅  ${courseDef.units.length} unit(s), ` +
      `${courseDef.units.reduce((s, u) => s + u.topics.length, 0)} topic(s) seeded`,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉  Seeding complete!');
  console.log(`   Courses   : ${COURSES.length}`);
  console.log(`   Categories: ${uniqueCategories.length}`);

  // Discipline breakdown
  const byDiscipline = COURSES.reduce<Record<string, number>>((acc, c) => {
    acc[c.categoryName] = (acc[c.categoryName] ?? 0) + 1;
    return acc;
  }, {});
  for (const [disc, count] of Object.entries(byDiscipline)) {
    console.log(`     ${disc}: ${count} course(s)`);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

seedCourses()
  .catch((err) => {
    console.error('❌  Seeder failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await _pool.end();
  });