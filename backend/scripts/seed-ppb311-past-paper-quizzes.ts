import 'dotenv/config';
import { PrismaClient, QuestionCategory, QuestionDifficulty, QuestionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'ioredis';

const COURSE_ID = '95d7389e-cebf-4c83-a1b0-0ed6a7811851';
const UNIT_SLUG = 'ppb-311';
const VERSION = 'past-paper-v1';

type QuestionSpec = {
  prompt: string;
  answer: string;
  distractors: [string, string, string];
  explanation: string;
  difficulty: QuestionDifficulty;
  answerPosition: number;
  sourcePage?: number;
};

type TopicQuizSpec = { name: string; questions: QuestionSpec[] };

const q = (
  prompt: string,
  answer: string,
  distractors: [string, string, string],
  explanation: string,
  sourcePage?: number,
  answerPosition = 0,
): QuestionSpec => ({
  prompt,
  answer,
  distractors,
  explanation,
  difficulty: QuestionDifficulty.medium,
  answerPosition,
  sourcePage,
});

const TOPIC_QUIZZES: TopicQuizSpec[] = [
  {
    name: 'Introduction to Pharmacology',
    questions: [
      q(
        'Which statement best describes pharmacodynamics?',
        'The study of drug actions and how drug-target interactions produce effects',
        ['The study of how the body absorbs, distributes, metabolizes, and eliminates a drug', 'The study of how medicines are manufactured and packaged', 'The study of how diseases are classified'],
        'Pharmacodynamics describes what a drug does to the body, including its interactions with targets.',
        21,
        1,
      ),
      q(
        'Which group contains common macromolecular targets of drug action?',
        'Receptors, enzymes, ion channels, and transporters',
        ['Red blood cells, platelets, and plasma water only', 'Bones, tendons, and ligaments only', 'Vitamins, minerals, and dietary fibre only'],
        'Drug targets commonly include receptors, enzymes, ion channels, and transporters.',
        20,
        2,
      ),
    ],
  },
  {
    name: 'Routes of Drug Administration',
    questions: [
      q(
        'Which route generally delivers an antidote to systemic circulation fastest?',
        'Intravenous',
        ['Transdermal', 'Oral', 'Subcutaneous'],
        'Intravenous administration delivers the dose directly into systemic circulation.',
        8,
        1,
      ),
      q(
        'A key advantage of sublingual administration for suitable medicines is that it can:',
        'Avoid much of the hepatic first-pass metabolism',
        ['Ensure slow absorption from the stomach', 'Deliver the medicine directly into cerebrospinal fluid', 'Prevent all systemic adverse effects'],
        'Sublingual absorption drains into systemic circulation and can avoid initial portal passage through the liver.',
        21,
        2,
      ),
    ],
  },
  {
    name: 'Pharmacokinetics: Absorption and Distribution',
    questions: [
      q(
        'Drug distribution from blood into a tissue is most directly influenced by the gradient of:',
        'Free drug concentration between blood and tissue',
        ['Total dose and brand name only', 'Protein-bound drug concentration only', 'Drug concentration in urine'],
        'The unbound concentration gradient drives distribution between blood and tissue.',
        6,
        1,
      ),
      q(
        'Which process can allow a very large protein molecule to enter a cell?',
        'Endocytosis',
        ['Simple lipid diffusion', 'Glomerular filtration', 'First-pass metabolism'],
        'Endocytosis can internalize large molecules that cannot cross membranes by simple diffusion.',
        8,
        2,
      ),
    ],
  },
  {
    name: 'Pharmacokinetics: Metabolism and Elimination',
    questions: [
      q(
        'Which organ is the main route for elimination of many medicines and their metabolites?',
        'Kidneys',
        ['Skin', 'Eyes', 'Skeletal muscle'],
        'Renal excretion is a major route by which many drugs and metabolites leave the body.',
        21,
        1,
      ),
      q(
        'When a metabolic pathway is saturated and follows zero-order kinetics, how much drug is eliminated per unit time?',
        'A constant amount',
        ['A constant fraction', 'An amount that always doubles when concentration doubles', 'No drug until the pathway becomes unsaturated'],
        'Zero-order elimination removes a constant amount per unit time while the pathway is saturated.',
        7,
        2,
      ),
    ],
  },
  {
    name: 'Pharmacodynamics: Principles and Drug Targets',
    questions: [
      q(
        'If a smaller dose of naproxen produces the same analgesic response as a larger dose of ibuprofen, naproxen is:',
        'More potent in that comparison',
        ['More efficacious in every clinical setting', 'A competitive antagonist', 'Necessarily safer at every dose'],
        'Producing the same effect at a lower dose indicates greater potency, not necessarily greater maximal efficacy or safety.',
        6,
        1,
      ),
      q(
        'The therapeutic index is primarily a measure of a medicine’s:',
        'Safety margin',
        ['Absorption rate', 'Maximum efficacy', 'Duration of action'],
        'The therapeutic index compares toxic and effective dose measures and is used as an indicator of safety margin.',
        6,
        2,
      ),
    ],
  },
  {
    name: 'Pharmacodynamics: Receptors and Drug Interactions',
    questions: [
      q(
        'Which receptor is directly associated with an intrinsic ligand-gated ion channel?',
        'GABA-A receptor',
        ['Histamine H1 receptor', 'Histamine H2 receptor', 'Adrenergic beta receptor'],
        'GABA-A is a ligand-gated chloride channel; H1, H2, and beta-adrenergic receptors are G-protein-coupled receptors.',
        6,
        1,
      ),
      q(
        'Glutamate receptors of the ionotropic type belong to which target family?',
        'Ligand-gated ion channels',
        ['G-protein-coupled receptors', 'Nuclear receptors', 'Voltage-gated sodium channels'],
        'Ionotropic glutamate receptors are ligand-gated ion channels.',
        20,
        2,
      ),
    ],
  },
  {
    name: 'Variation in Drug Response',
    questions: [
      q(
        'A medicine is metabolized by CYP3A4. Which co-administered drug may increase its duration by inhibiting metabolism?',
        'Cimetidine',
        ['Phenobarbital', 'Rifampicin', 'A CYP3A4 inducer'],
        'Enzyme inhibition can reduce metabolism and prolong exposure; enzyme inducers such as rifampicin can have the opposite effect.',
        7,
        1,
      ),
      q(
        'Which developmental change can contribute to slower drug metabolism in neonates than in adults?',
        'Immature glucuronidation capacity',
        ['Greater activity of every hepatic enzyme', 'Complete absence of plasma water', 'Higher renal clearance for all medicines'],
        'The past paper highlights glucuronidation among pharmacokinetic processes that differ between neonates and adults.',
        7,
        2,
      ),
    ],
  },
  {
    name: 'Adverse Drug Effects and Drug Interactions',
    questions: [
      q(
        'What is an important concern when ibuprofen is taken with low-dose aspirin?',
        'Ibuprofen can interfere with aspirin’s antiplatelet effect, and combined NSAID use can increase gastrointestinal harm',
        ['Ibuprofen permanently increases aspirin absorption without added risk', 'The combination prevents renal elimination of both drugs', 'Aspirin converts ibuprofen into an anticoagulant'],
        'The interaction can reduce aspirin’s platelet effect depending on timing, while combined NSAID exposure can increase gastrointestinal risk.',
        3,
        1,
      ),
      q(
        'Which serious adverse outcome is associated with selective COX-2 inhibitors such as celecoxib?',
        'Increased risk of cardiovascular thrombotic events',
        ['Permanent hearing restoration', 'Severe hypoglycaemia in every patient', 'Prevention of all renal adverse effects'],
        'COX-2 selective NSAIDs can increase cardiovascular thrombotic risk in susceptible patients.',
        3,
        2,
      ),
    ],
  },
  {
    name: 'Pharmacogenetics',
    questions: [
      q(
        'Which pair of genetic factors can influence an individual’s warfarin dose requirement?',
        'CYP2C9 and VKORC1 variants',
        ['HBB and CFTR variants', 'INS and HLA-DQ variants', 'BRCA1 and BRCA2 variants'],
        'CYP2C9 affects warfarin metabolism and VKORC1 encodes its target; variation in these genes can affect dose requirements.',
        undefined,
        1,
      ),
      q(
        'An ultrarapid CYP2D6 metabolizer takes codeine. What is the main pharmacogenetic concern?',
        'More rapid formation of morphine may increase opioid toxicity risk',
        ['Codeine cannot be absorbed from the gut', 'Morphine formation is completely prevented', 'The patient will have no opioid effects at any dose'],
        'CYP2D6 converts codeine to morphine; ultrarapid metabolism can increase morphine exposure and toxicity risk.',
        undefined,
        2,
      ),
    ],
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let topicIds: string[] = [];

  try {
    const result = await prisma.$transaction(async tx => {
      const unit = await tx.unit.findFirst({
        where: { courseId: COURSE_ID, slug: UNIT_SLUG },
        include: {
          course: { select: { id: true, createdById: true } },
          topics: { orderBy: { order: 'asc' } },
        },
      });
      if (!unit) throw new Error('PPB 311 unit was not found.');
      if (unit.topics.length !== TOPIC_QUIZZES.length) {
        throw new Error(`Expected ${TOPIC_QUIZZES.length} topics, found ${unit.topics.length}; refusing to attach quizzes to an unexpected outline.`);
      }
      if (unit.topics.some((topic, index) => topic.name !== TOPIC_QUIZZES[index].name)) {
        throw new Error('PPB 311 topic names/order do not match the course outline; refusing to create quizzes.');
      }
      if (!unit.course.createdById) throw new Error('The Pharmacology course has no owner to attribute quiz content to.');

      topicIds = unit.topics.map(topic => topic.id);
      let questionsCreated = 0;
      let quizzesCreated = 0;

      for (const [topicIndex, topic] of unit.topics.entries()) {
        const spec = TOPIC_QUIZZES[topicIndex];
        const title = `PPB 311: ${topic.name} Quiz`;
        let quiz = await tx.quiz.findFirst({ where: { topicId: topic.id, title }, select: { id: true } });
        if (!quiz) {
          quiz = await tx.quiz.create({
            data: {
              title,
              description: `Past-paper knowledge check for ${topic.name}. Questions are lightly reworded; the Pharmacogenetics set is a course-aligned supplement because no matching item appeared in the OCR excerpt.`,
              instructions: 'Choose the single best answer for each question.',
              timeLimit: 10,
              maxAttempts: 3,
              passingScore: 70,
              isPublished: true,
              publishedAt: new Date(),
              questionCount: spec.questions.length,
              shuffleQuestions: true,
              showResults: true,
              unitId: unit.id,
              topicId: topic.id,
              createdBy: unit.course.createdById,
            },
            select: { id: true },
          });
          quizzesCreated += 1;
        }

        const questionIds: string[] = [];
        for (const [questionIndex, item] of spec.questions.entries()) {
          const stableTag = `ppb311-topic-${topicIndex + 1}-${VERSION}-q${questionIndex + 1}`;
          let existing = await tx.question.findFirst({
            where: { topicIds: { has: topic.id }, tags: { has: stableTag } },
            select: { id: true },
          });

          if (!existing) {
            const choices = [...item.distractors];
            choices.splice(item.answerPosition, 0, item.answer);
            const sourceTag = item.sourcePage ? `past-paper-page-${item.sourcePage}` : 'course-aligned-supplement';
            const createdQuestion = await tx.question.create({
              data: {
                text: item.prompt,
                type: QuestionType.multiple_choice,
                difficulty: item.difficulty,
                category: QuestionCategory.pharmacology,
                explanation: item.explanation,
                conceptsCovered: [topic.name],
                tags: ['ppb311-topic-quiz', VERSION, stableTag, sourceTag],
                points: 1,
                isActive: true,
                createdBy: unit.course.createdById,
                courseId: unit.course.id,
                unitId: unit.id,
                topicIds: [topic.id],
                options: {
                  create: choices.map((text, order) => ({
                    text,
                    isCorrect: order === item.answerPosition,
                    order,
                  })),
                },
              },
              select: { id: true },
            });
            existing = createdQuestion;
            questionsCreated += 1;
          }
          questionIds.push(existing.id);
        }

        await tx.quizQuestion.createMany({
          data: questionIds.map((questionId, order) => ({ quizId: quiz.id, questionId, order: order + 1 })),
          skipDuplicates: true,
        });
        await tx.quiz.update({ where: { id: quiz.id }, data: { questionCount: questionIds.length, isPublished: true } });
      }

      return { unitId: unit.id, topicCount: unit.topics.length, quizzesCreated, questionsCreated };
    });

    console.log(JSON.stringify(result, null, 2));

    if (process.env.REDIS_URL && process.env.ENABLE_REDIS !== 'false') {
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1 });
      try {
        await redis.connect();
        await redis.del(...topicIds.map(id => `topic:${id}:questions:v2`));
        await redis.quit();
        console.log('Cleared cached topic quiz questions.');
      } catch {
        redis.disconnect();
        console.warn('Could not clear Redis topic quiz cache; cached empty results may persist until their one-hour TTL expires.');
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});