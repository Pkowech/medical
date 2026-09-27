import 'dotenv/config';
import { PrismaClient, QuestionCategory, QuestionDifficulty, QuestionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'ioredis';

const COURSE_ID = '95d7389e-cebf-4c83-a1b0-0ed6a7811851';
const UNIT_SLUG = 'ppb-311';
const QUIZ_VERSION = 'v1';

type QuestionSpec = {
  prompt: string;
  answer: string;
  distractors: [string, string, string];
  explanation: string;
  difficulty: QuestionDifficulty;
  answerPosition: number;
};

type TopicQuizSpec = {
  name: string;
  questions: QuestionSpec[];
};

const question = (
  prompt: string,
  answer: string,
  distractors: [string, string, string],
  explanation: string,
  difficulty: QuestionDifficulty = QuestionDifficulty.medium,
  answerPosition = 0,
): QuestionSpec => ({ prompt, answer, distractors, explanation, difficulty, answerPosition });

const TOPIC_QUIZZES: TopicQuizSpec[] = [
  {
    name: 'Introduction to Pharmacology',
    questions: [
      question('What is the central subject of pharmacology?', 'The effects of drugs on living systems and their interactions with those systems', ['The surgical treatment of disease', 'The classification of infectious organisms', 'The structure of human organs only'], 'Pharmacology studies drugs and their interactions with biological systems.', QuestionDifficulty.easy),
      question('Which statement best describes pharmacokinetics?', 'What the body does to a drug, including its absorption, distribution, metabolism, and elimination', ['What a drug does to its molecular target', 'How diseases are diagnosed from symptoms', 'How a medicine is named commercially'], 'Pharmacokinetics describes ADME: absorption, distribution, metabolism, and excretion.', QuestionDifficulty.easy, 1),
      question('Which name is generally shared by the same active drug across manufacturers?', 'The generic, or non-proprietary, name', ['The brand name', 'The chemical formula only', 'The manufacturer-specific product code'], 'A generic name is the standardized non-proprietary name for an active drug.', QuestionDifficulty.easy, 2),
      question('Which question is primarily answered by pharmacodynamics?', 'How does the drug produce its effects in the body?', ['How quickly is the drug absorbed from the gut?', 'How much drug is removed by the kidneys?', 'How is the drug packaged for dispensing?'], 'Pharmacodynamics covers drug actions, mechanisms, and effects.', QuestionDifficulty.easy, 3),
      question('What does a chemical name primarily describe?', 'The molecular structure or chemical composition of a drug', ['The company that markets the drug', 'The approved dose for every patient', 'The drug’s therapeutic indication only'], 'Chemical nomenclature describes a compound’s chemical structure.', QuestionDifficulty.medium),
    ],
  },
  {
    name: 'Routes of Drug Administration',
    questions: [
      question('Which route delivers a drug directly into systemic circulation and has complete bioavailability?', 'Intravenous administration', ['Oral administration', 'Transdermal administration', 'Rectal administration'], 'An intravenous dose enters systemic circulation directly, so its bioavailability is 100%.', QuestionDifficulty.easy, 1),
      question('Why can sublingual administration avoid much of the hepatic first-pass effect?', 'Drug absorbed under the tongue drains into systemic venous circulation', ['The drug is absorbed through the stomach wall', 'The drug is metabolized before absorption', 'The route delivers the drug into the colon'], 'Sublingual venous drainage enters systemic circulation without initial portal passage through the liver.', QuestionDifficulty.medium, 2),
      question('Which route is most directly associated with hepatic first-pass metabolism?', 'Oral administration', ['Intravenous administration', 'Inhalation into the lungs', 'Intrathecal administration'], 'Orally absorbed drug commonly passes through the portal circulation and liver before reaching systemic circulation.', QuestionDifficulty.easy, 3),
      question('Where is an intrathecal medicine administered?', 'Into the cerebrospinal fluid within the subarachnoid space', ['Into a skeletal muscle', 'Under the skin', 'Into the stomach'], 'Intrathecal administration places medicine into cerebrospinal fluid.', QuestionDifficulty.easy),
      question('Which route can provide sustained systemic delivery through the skin?', 'Transdermal administration', ['Sublingual administration', 'Intrathecal administration', 'Intra-articular administration'], 'A transdermal patch can release drug across the skin over an extended period.', QuestionDifficulty.easy, 1),
    ],
  },
  {
    name: 'Pharmacokinetics: Absorption and Distribution',
    questions: [
      question('What is bioavailability?', 'The fraction of an administered dose that reaches systemic circulation unchanged', ['The fraction of drug bound to plasma proteins', 'The rate at which a drug is eliminated', 'The volume of plasma containing the total body drug'], 'Bioavailability measures the fraction of the administered dose reaching systemic circulation as unchanged drug.', QuestionDifficulty.medium, 1),
      question('Which property generally helps a drug cross lipid cell membranes by passive diffusion?', 'Lipid solubility in its un-ionized form', ['High molecular charge at all pH values', 'Irreversible binding to albumin', 'Large particle size'], 'Un-ionized, lipid-soluble molecules generally cross lipid membranes more readily.', QuestionDifficulty.medium, 2),
      question('Which fraction of a reversibly protein-bound drug is immediately available to cross membranes and bind most targets?', 'The unbound fraction', ['The albumin-bound fraction only', 'The fraction already eliminated in urine', 'The fraction stored in the dosage form'], 'The unbound fraction is available for distribution, target binding, metabolism, and elimination.', QuestionDifficulty.medium, 3),
      question('How is apparent volume of distribution commonly defined?', 'Amount of drug in the body divided by its plasma concentration', ['Plasma concentration divided by renal clearance', 'Dose divided by bioavailability', 'Clearance multiplied by the elimination half-life'], 'Apparent volume of distribution relates the amount of drug in the body to its measured plasma concentration.', QuestionDifficulty.medium),
      question('How can extensive hepatic first-pass metabolism affect an orally administered drug?', 'It can reduce the amount of unchanged drug reaching systemic circulation', ['It guarantees complete systemic bioavailability', 'It prevents the drug from entering the portal circulation', 'It converts every drug into an active metabolite'], 'Pre-systemic metabolism can lower oral bioavailability.', QuestionDifficulty.easy, 1),
    ],
  },
  {
    name: 'Pharmacokinetics: Metabolism and Elimination',
    questions: [
      question('Which processes are commonly associated with Phase I drug metabolism?', 'Oxidation, reduction, and hydrolysis', ['Glucuronide conjugation only', 'Renal filtration only', 'Drug-receptor binding'], 'Phase I reactions commonly include oxidation, reduction, and hydrolysis.', QuestionDifficulty.easy, 1),
      question('What is a common purpose of Phase II metabolism?', 'Conjugating a drug or metabolite with a polar group to facilitate elimination', ['Binding the drug to its receptor', 'Moving the drug from blood into tissues', 'Preventing all metabolism'], 'Phase II conjugation often increases water solubility and supports excretion.', QuestionDifficulty.medium, 2),
      question('What may happen to the half-life of a predominantly renally eliminated drug when renal function substantially declines?', 'It may increase because elimination is reduced', ['It always becomes zero', 'It cannot change', 'It decreases because distribution stops'], 'Reduced renal clearance can slow elimination and prolong drug exposure.', QuestionDifficulty.medium, 3),
      question('What is eliminated per unit time during first-order elimination?', 'A constant fraction of the amount of drug present', ['A constant amount regardless of concentration', 'The entire dose at one fixed time', 'Only drug bound to albumin'], 'First-order elimination removes a constant proportion per unit time.', QuestionDifficulty.easy),
      question('What characterizes zero-order elimination when the relevant pathway is saturated?', 'A constant amount of drug is eliminated per unit time', ['A constant fraction is eliminated per unit time', 'Elimination stops permanently', 'The elimination rate rises in direct proportion to concentration'], 'With a saturated pathway, elimination can proceed at a fixed maximum rate.', QuestionDifficulty.medium, 1),
    ],
  },
  {
    name: 'Pharmacodynamics: Principles and Drug Targets',
    questions: [
      question('In a graded dose-response curve, what does EC50 represent?', 'The concentration producing 50% of the drug’s maximal effect', ['The concentration that produces no effect', 'The dose that causes toxicity in every patient', 'The amount eliminated in 50 minutes'], 'EC50 is the concentration associated with half-maximal response and is commonly used to compare potency.', QuestionDifficulty.medium, 1),
      question('What does Emax describe?', 'The maximal effect a drug can produce in the system', ['The minimum effective concentration', 'The rate of renal elimination', 'The fraction bound to plasma proteins'], 'Emax reflects the maximum efficacy achievable by the drug in that system.', QuestionDifficulty.easy, 2),
      question('What is the usual effect of a reversible competitive antagonist on an agonist dose-response curve?', 'A rightward shift that can be overcome by increasing agonist concentration', ['A permanent increase in the agonist’s Emax', 'An irreversible loss of all receptor function', 'No change in the agonist concentration needed for an effect'], 'A surmountable competitive antagonist increases the agonist concentration needed for a given response without lowering Emax.', QuestionDifficulty.medium, 3),
      question('What distinguishes a partial agonist from a full agonist at the same receptor system?', 'A partial agonist produces a lower maximal response even when it occupies receptors', ['A partial agonist cannot bind receptors', 'A partial agonist always has higher efficacy', 'A partial agonist works only by blocking drug metabolism'], 'A partial agonist has lower intrinsic efficacy and cannot produce the full system maximum.', QuestionDifficulty.medium),
      question('How is the conventional median therapeutic index commonly expressed?', 'TD50 divided by ED50', ['ED50 divided by clearance', 'Emax divided by EC50', 'Half-life divided by bioavailability'], 'The conventional median therapeutic index is the median toxic dose divided by the median effective dose.', QuestionDifficulty.medium, 1),
    ],
  },
  {
    name: 'Pharmacodynamics: Receptors and Drug Interactions',
    questions: [
      question('Which combination best describes a receptor agonist?', 'It binds to a receptor and activates it to produce a response', ['It binds and has no capacity to activate the receptor', 'It destroys the receptor before binding', 'It only increases renal drug clearance'], 'An agonist has receptor affinity and efficacy sufficient to activate the receptor.', QuestionDifficulty.easy, 1),
      question('How does a neutral receptor antagonist differ from an agonist?', 'It binds the receptor without activating it and can prevent agonist action', ['It activates the receptor more strongly than a full agonist', 'It binds only to plasma albumin', 'It always increases receptor number'], 'A neutral antagonist has affinity but no intrinsic efficacy and blocks agonist access or action.', QuestionDifficulty.medium, 2),
      question('Where does a typical allosteric modulator bind?', 'At a site distinct from the primary agonist-binding site', ['Only at the drug’s renal filtration site', 'At the active site of every enzyme in the body', 'At the same site as the agonist in every case'], 'Allosteric modulators bind a separate site and alter receptor activity or ligand response.', QuestionDifficulty.medium, 3),
      question('What is a competitive receptor interaction?', 'Two ligands compete for access to the same binding site', ['A drug is removed from plasma by filtration', 'Two drugs are conjugated by the same enzyme', 'A medicine is delivered through the skin'], 'Competitive ligands vie for the same receptor site.', QuestionDifficulty.easy),
      question('What describes a synergistic drug interaction?', 'The combined effect is greater than the expected additive effect', ['The combined effect is always zero', 'One drug prevents the other from being absorbed in every case', 'The drugs have identical names'], 'Synergism occurs when the combined effect exceeds the expected sum of individual effects.', QuestionDifficulty.medium, 1),
    ],
  },
  {
    name: 'Variation in Drug Response',
    questions: [
      question('What can enzyme induction do to the concentration of a susceptible active parent drug?', 'Increase its metabolism and potentially lower its concentration', ['Stop all drug elimination', 'Always increase its absorption', 'Convert every antagonist into an agonist'], 'Induction can increase metabolic capacity and lower exposure to susceptible substrates.', QuestionDifficulty.medium, 1),
      question('What can inhibition of a drug-metabolizing enzyme do to a susceptible substrate drug?', 'Reduce its metabolism and potentially increase its concentration', ['Always increase its renal filtration', 'Prevent it from entering the bloodstream', 'Make its half-life exactly zero'], 'Enzyme inhibition can reduce metabolism and increase substrate exposure, although effects depend on the drug and pathway.', QuestionDifficulty.medium, 2),
      question('Which patient factor can change the dose or interval needed for a renally cleared medicine?', 'Renal function', ['Eye color', 'Handedness', 'Hair length'], 'Renal function influences clearance for drugs eliminated substantially by the kidneys.', QuestionDifficulty.easy, 3),
      question('What is pharmacological tolerance?', 'A reduced response to a drug after repeated exposure, sometimes requiring dose adjustment', ['An allergic reaction after one dose', 'A permanent increase in drug bioavailability', 'A drug’s ability to bind albumin'], 'Tolerance is a diminished response after repeated exposure; its mechanism varies by drug.', QuestionDifficulty.easy),
      question('Which can contribute to inter-individual variation in drug response?', 'Genetic variation, age, organ function, and concomitant medicines', ['Only the drug’s brand name', 'Only the color of the dosage form', 'The alphabetical order of the prescription'], 'Drug response varies with patient genetics and physiology as well as interactions and other factors.', QuestionDifficulty.easy, 1),
    ],
  },
  {
    name: 'Adverse Drug Effects and Drug Interactions',
    questions: [
      question('What is an adverse drug reaction in the standard pharmacovigilance sense?', 'A harmful, unintended response to a medicine used at normal doses', ['Any intended therapeutic effect', 'A manufacturing label change', 'A response that occurs only after overdose'], 'An adverse drug reaction is harmful and unintended at doses normally used for prevention, diagnosis, or treatment.', QuestionDifficulty.easy, 1),
      question('Which feature is typical of a Type A adverse drug reaction?', 'It is often dose-related and predictable from the drug’s known pharmacology', ['It is always unrelated to dose and completely unpredictable', 'It occurs only because a medicine is counterfeit', 'It is always an immune-mediated allergy'], 'Type A reactions are augmented, commonly dose-related, and often predictable.', QuestionDifficulty.medium, 2),
      question('Which feature is more typical of a Type B adverse drug reaction?', 'It is unusual and not readily predictable from the usual pharmacology', ['It is always a predictable extension of the desired effect', 'It occurs in every patient at the same dose', 'It is simply a medicine’s intended benefit'], 'Type B reactions are bizarre or less predictable and are not simple dose-related extensions of the expected effect.', QuestionDifficulty.medium, 3),
      question('What is a key purpose of pharmacovigilance?', 'Detecting, assessing, understanding, and preventing suspected adverse effects', ['Choosing a brand name for a new medicine', 'Measuring only tablet dissolution', 'Replacing all clinical trials'], 'Pharmacovigilance monitors medicine safety and supports prevention of medicine-related harm.', QuestionDifficulty.easy),
      question('When two medicines with similar effects are used together, what should be considered?', 'Their combined pharmacodynamic effect may increase benefit or harm', ['Their effects must cancel each other', 'Their doses can always be doubled safely', 'Their interaction can occur only during absorption'], 'Pharmacodynamic interactions can be additive, synergistic, or antagonistic and can alter both efficacy and risk.', QuestionDifficulty.medium, 1),
    ],
  },
  {
    name: 'Pharmacogenetics',
    questions: [
      question('What does pharmacogenetics study?', 'How variation in genes can influence an individual’s response to medicines', ['How medicines are named by manufacturers', 'How drugs are filtered by a laboratory membrane only', 'How pathogens acquire antibiotic resistance only'], 'Pharmacogenetics focuses on genetic contributions to variability in drug response.', QuestionDifficulty.easy, 1),
      question('What may happen when a poor metabolizer receives a standard dose of an active drug cleared by the affected enzyme?', 'The parent drug may accumulate and increase the risk of dose-related adverse effects', ['The drug is always converted more rapidly to inactive metabolites', 'The drug cannot be absorbed by any route', 'The drug becomes a prodrug automatically'], 'Reduced metabolism of an active parent drug can increase exposure; the result depends on the drug and pathway.', QuestionDifficulty.medium, 2),
      question('How may reduced activity of an enzyme that activates a prodrug affect treatment?', 'It may reduce formation of the active metabolite and diminish the response', ['It always increases activation', 'It changes only the medicine’s brand name', 'It guarantees severe toxicity from the active metabolite'], 'Some prodrugs depend on metabolic activation, so reduced enzyme activity can lower active-metabolite formation.', QuestionDifficulty.medium, 3),
      question('Which genes are commonly considered when explaining some inherited variation in warfarin dose requirements?', 'CYP2C9 and VKORC1', ['HBB and CFTR', 'INS and HLA-DQ', 'BRCA1 and BRCA2'], 'CYP2C9 affects warfarin metabolism and VKORC1 encodes its pharmacological target; variants can influence dose requirements.', QuestionDifficulty.medium),
      question('What is a useful purpose of pharmacogenetic information in prescribing?', 'To help select a medicine or dose when the evidence supports a clinically relevant gene-drug relationship', ['To replace assessment of symptoms and organ function', 'To guarantee that adverse reactions will never occur', 'To determine a patient’s complete medical history from one test'], 'Validated pharmacogenetic information can inform drug choice or dosing alongside the rest of the clinical assessment.', QuestionDifficulty.easy, 1),
    ],
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let topicIds: string[] = [];

  try {
    const created = await prisma.$transaction(async tx => {
      const unit = await tx.unit.findFirst({
        where: { courseId: COURSE_ID, slug: UNIT_SLUG },
        include: { course: { select: { id: true, createdById: true } }, topics: { orderBy: { order: 'asc' } } },
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
              description: `Five-question knowledge check for ${topic.name}, based on the PPB 311 course outline.`,
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
        } else {
          await tx.quiz.update({
            where: { id: quiz.id },
            data: { questionCount: spec.questions.length, isPublished: true, publishedAt: new Date() },
          });
        }

        const questionIds: string[] = [];
        for (const [questionIndex, item] of spec.questions.entries()) {
          const stableTag = `ppb311-topic-${topicIndex + 1}-${QUIZ_VERSION}-q${questionIndex + 1}`;
          let existing = await tx.question.findFirst({
            where: { topicIds: { has: topic.id }, tags: { has: stableTag } },
            select: { id: true },
          });

          if (!existing) {
            const choices = [...item.distractors];
            choices.splice(item.answerPosition, 0, item.answer);
            const createdQuestion = await tx.question.create({
              data: {
                text: item.prompt,
                type: QuestionType.multiple_choice,
                difficulty: item.difficulty,
                category: QuestionCategory.pharmacology,
                explanation: item.explanation,
                conceptsCovered: [topic.name],
                tags: ['ppb311-topic-quiz', QUIZ_VERSION, stableTag],
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
        await tx.quiz.update({ where: { id: quiz.id }, data: { questionCount: questionIds.length } });
      }

      return { unitId: unit.id, topicCount: unit.topics.length, quizzesCreated, questionsCreated };
    });

    console.log(JSON.stringify(created, null, 2));

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