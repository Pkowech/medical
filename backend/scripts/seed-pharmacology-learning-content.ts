import 'dotenv/config';
import { MaterialType, PrismaClient, QuestionCategory, QuestionDifficulty, QuestionType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'ioredis';

const COURSE_ID = '95d7389e-cebf-4c83-a1b0-0ed6a7811851';
const VERSION = 'pharmacology-practice-v1';
const OPEN_RN_URL = 'https://www.ncbi.nlm.nih.gov/books/NBK595000/';
const FDA_DRUG_DEVELOPMENT_URL = 'https://www.fda.gov/patients/learn-about-drug-and-device-approvals/drug-development-process';
const ANTIHISTAMINE_URL = 'https://www.ncbi.nlm.nih.gov/books/NBK538188/';
const NSAID_URL = 'https://www.ncbi.nlm.nih.gov/books/NBK547742/';

type QuestionSpec = {
  prompt: string;
  answer: string;
  distractors: [string, string, string];
  explanation: string;
  sourceUrl: string;
  answerPosition: number;
};

type VideoSpec = {
  title: string;
  url: string;
  author: string;
  description: string;
};

const q = (
  prompt: string,
  answer: string,
  distractors: [string, string, string],
  explanation: string,
  sourceUrl = OPEN_RN_URL,
  answerPosition = 0,
): QuestionSpec => ({ prompt, answer, distractors, explanation, sourceUrl, answerPosition });

const TOPIC_QUESTIONS: Record<string, QuestionSpec[]> = {
  'Introduction to Pharmacology': [
    q('Which statement best defines pharmacology?', 'The study of drugs and their interactions with living systems', ['The study of disease distribution in populations', 'The study of surgical techniques', 'The study of dietary requirements'], 'Pharmacology studies drugs, their actions, and their effects in living systems.', OPEN_RN_URL, 1),
    q('A medicine produces the same clinical effect at a smaller dose than another medicine. It is more:', 'Potent in that comparison', ['Efficacious in every patient', 'Selective for every receptor', 'Safe at every dose'], 'A lower dose for the same effect indicates greater potency, not necessarily greater efficacy or safety.', OPEN_RN_URL, 2),
  ],
  'Routes of Drug Administration': [
    q('Which route provides complete systemic bioavailability for the administered dose?', 'Intravenous', ['Oral', 'Topical', 'Rectal'], 'An intravenous dose enters systemic circulation directly, so its bioavailability is 100%.', OPEN_RN_URL, 1),
    q('Why can a suitable sublingual medicine avoid much of the hepatic first-pass effect?', 'It is absorbed into systemic venous blood before portal circulation', ['It is metabolized in the stomach', 'It is absorbed only after biliary secretion', 'It is delivered directly into the renal tubules'], 'Sublingual absorption can enter systemic circulation without initial passage through the portal vein.', OPEN_RN_URL, 2),
  ],
  'Pharmacokinetics: Absorption and Distribution': [
    q('Which pharmacokinetic process describes movement of a drug from its administration site into blood?', 'Absorption', ['Distribution', 'Metabolism', 'Excretion'], 'Absorption is movement from the administration site into systemic circulation.', OPEN_RN_URL, 1),
    q('A drug with a large apparent volume of distribution is generally:', 'Extensively distributed outside the plasma compartment', ['Confined almost entirely to plasma', 'Unable to cross any membrane', 'Completely eliminated by the lungs'], 'A large apparent volume of distribution indicates substantial distribution into tissues relative to plasma.', OPEN_RN_URL, 2),
  ],
  'Pharmacokinetics: Metabolism and Elimination': [
    q('What is the likely effect of an enzyme inducer on a susceptible active drug substrate?', 'It can increase metabolism and lower substrate exposure', ['It always blocks renal filtration', 'It prevents absorption of every oral drug', 'It converts all substrates into active metabolites'], 'Enzyme induction can increase metabolism and reduce exposure to affected substrates.', OPEN_RN_URL, 1),
    q('Why may a maintenance dose need adjustment in substantial renal impairment for a renally cleared drug?', 'Reduced renal clearance can increase drug exposure', ['Renal impairment always increases hepatic metabolism', 'Renal impairment prevents receptor binding', 'The drug becomes less potent at every concentration'], 'Lower renal clearance can cause accumulation unless the regimen is adjusted.', OPEN_RN_URL, 2),
  ],
  'Pharmacodynamics: Principles and Drug Targets': [
    q('On a concentration-response curve, a lower EC50 usually indicates greater:', 'Potency', ['Maximum efficacy', 'Therapeutic index', 'Clearance'], 'EC50 is the concentration associated with half-maximal effect; a lower value indicates greater potency.', OPEN_RN_URL, 1),
    q('Compared with a full agonist, a partial agonist can produce:', 'A lower maximum response even when it occupies receptors', ['No receptor binding', 'Only irreversible receptor blockade', 'A response independent of dose'], 'A partial agonist has intrinsic activity but a lower maximal effect than a full agonist in the same system.', OPEN_RN_URL, 2),
  ],
  'CAT I': [
    q('A patient receives an IV loading dose. Which pharmacokinetic process is bypassed for that dose?', 'Absorption', ['Distribution', 'Metabolism', 'Elimination'], 'An IV dose is delivered directly into the systemic circulation.', OPEN_RN_URL, 1),
    q('Which term describes the study of what a drug does to the body?', 'Pharmacodynamics', ['Pharmacokinetics', 'Pharmaceutics', 'Pharmacognosy'], 'Pharmacodynamics describes drug effects and mechanisms of action.', OPEN_RN_URL, 2),
  ],
  'Pharmacodynamics: Receptors and Drug Interactions': [
    q('A reversible competitive antagonist commonly causes which change in an agonist concentration-response curve?', 'A rightward shift that can be overcome by more agonist', ['A leftward shift with a higher maximum', 'Permanent loss of all receptors', 'An increase in agonist clearance'], 'More agonist can overcome a reversible competitive antagonist, shifting apparent potency to the right.', OPEN_RN_URL, 1),
    q('Which receptor class commonly signals through G proteins and second messengers?', 'G-protein-coupled receptors', ['Ligand-gated ion channels only', 'Structural collagen receptors only', 'DNA polymerases'], 'GPCRs couple receptor activation to intracellular signaling pathways through G proteins.', OPEN_RN_URL, 2),
  ],
  'Variation in Drug Response': [
    q('Which patient factor can reduce elimination of a predominantly renally cleared medicine?', 'Reduced kidney function', ['A higher tablet brand price', 'A change in tablet color', 'Increased hair pigmentation'], 'Renal impairment can reduce clearance of drugs that depend on kidney elimination.', OPEN_RN_URL, 1),
    q('A strong enzyme inducer is started in a patient taking a susceptible substrate. What should be considered?', 'The substrate concentration or effect may decrease', ['The substrate must become an irreversible antagonist', 'The substrate will always cause immediate toxicity', 'The inducer blocks all drug transport'], 'Induction can lower exposure to susceptible substrates and may reduce their effect.', OPEN_RN_URL, 2),
  ],
  'Adverse Drug Effects and Drug Interactions': [
    q('A predictable adverse effect that increases with dose is most consistent with which category?', 'Type A', ['Type B', 'Type C only', 'Type D only'], 'Type A adverse drug reactions are generally dose-related and pharmacologically predictable.', OPEN_RN_URL, 1),
    q('Why can combining an NSAID with an anticoagulant increase bleeding risk?', 'Their effects can combine to impair hemostasis', ['NSAIDs activate vitamin K synthesis', 'The combination prevents platelet formation permanently', 'Anticoagulants block NSAID absorption completely'], 'NSAIDs can affect platelet function and gastrointestinal mucosa, adding to anticoagulant-associated bleeding risk.', NSAID_URL, 2),
  ],
  'CAT II': [
    q('A drug interaction that reduces metabolism of a substrate is most likely to increase its:', 'Plasma exposure', ['Clearance by the inhibited pathway', 'First-pass metabolism', 'Protein synthesis'], 'Enzyme inhibition can slow metabolism and increase substrate exposure.', OPEN_RN_URL, 1),
    q('A nonselective NSAID reduces prostaglandin synthesis primarily by inhibiting:', 'Cyclooxygenase enzymes', ['Xanthine oxidase', 'Dihydrofolate reductase', 'Acetylcholinesterase'], 'NSAIDs reduce prostanoid synthesis by inhibiting COX enzymes.', NSAID_URL, 2),
  ],
  'Pharmacogenetics': [
    q('Reduced CYP2C19 activity can reduce activation of which prodrug?', 'Clopidogrel', ['Aspirin', 'Heparin', 'Metformin'], 'Clopidogrel requires metabolic activation, and CYP2C19 variation can influence its antiplatelet effect.', OPEN_RN_URL, 1),
    q('Screening for HLA-B*57:01 before abacavir is intended to reduce the risk of:', 'A serious hypersensitivity reaction', ['Dose-related hypoglycemia', 'Ototoxicity', 'Renal stone formation'], 'HLA-B*57:01 is strongly associated with abacavir hypersensitivity risk.', OPEN_RN_URL, 2),
  ],
  'Revision': [
    q('With first-order elimination, what fraction of drug is eliminated per unit time?', 'A constant fraction', ['A constant amount regardless of concentration', 'All drug at once', 'No drug until the next dose'], 'First-order elimination removes a constant fraction per unit time.', OPEN_RN_URL, 1),
    q('After repeated dosing at a fixed interval, steady state is commonly approached after approximately:', 'Four to five elimination half-lives', ['One minute for every medicine', 'One dose for every medicine', 'Twenty half-lives in all cases'], 'For many drugs with linear kinetics, steady state is approached after roughly four to five half-lives.', OPEN_RN_URL, 2),
  ],
  'Final Examinations': [
    q('Which description best fits a receptor antagonist?', 'It binds a target and reduces or prevents agonist activation', ['It must produce the same maximal response as an agonist', 'It always increases receptor number', 'It is another name for a prodrug'], 'An antagonist reduces or blocks agonist-mediated receptor activation.', OPEN_RN_URL, 1),
    q('The therapeutic index compares toxic and effective dose measures to estimate a drug’s:', 'Safety margin', ['Absorption site', 'Taste', 'Dosage form color'], 'The therapeutic index is a comparative measure related to the margin between toxic and effective doses.', OPEN_RN_URL, 2),
  ],
  'Drug Discovery Process': [
    q('What is a central purpose of target validation during drug discovery?', 'To establish that modulating the target is plausibly relevant to the disease', ['To select the final tablet color', 'To replace all clinical testing', 'To set pharmacy retail prices'], 'Target validation evaluates whether a biological target is relevant and suitable for therapeutic intervention.', FDA_DRUG_DEVELOPMENT_URL, 1),
    q('A lead compound is optimized mainly to improve properties such as:', 'Potency, selectivity, and developability', ['Brand recognition only', 'Packaging weight only', 'The number of tablet colors'], 'Lead optimization improves pharmacological and development properties before candidate selection.', FDA_DRUG_DEVELOPMENT_URL, 2),
  ],
  'Pre-clinical Studies and GLP': [
    q('A principal purpose of preclinical safety studies is to:', 'Assess potential harms before first use in humans', ['Prove effectiveness in every patient group', 'Replace all post-market monitoring', 'Choose the medicine’s trade name'], 'Preclinical studies provide laboratory and animal data that inform safety before clinical research.', FDA_DRUG_DEVELOPMENT_URL, 1),
    q('Good Laboratory Practice primarily supports the quality and integrity of:', 'Nonclinical safety study data', ['Routine pharmacy dispensing records', 'Phase IV marketing materials', 'Patient billing systems'], 'GLP provides quality standards for nonclinical laboratory safety studies.', FDA_DRUG_DEVELOPMENT_URL, 2),
  ],
  'Clinical Trials and GCP': [
    q('What is a common primary focus of an early phase I clinical study?', 'Initial safety, tolerability, and dose-related information', ['Definitive long-term effectiveness in a very large population', 'Post-market adverse-event surveillance only', 'Manufacturing facility inspection only'], 'Early phase I studies commonly evaluate initial safety, tolerability, and dose-related behavior.', FDA_DRUG_DEVELOPMENT_URL, 1),
    q('A key ethical requirement before a participant joins a clinical trial is:', 'Informed consent', ['Guaranteed personal benefit', 'Withholding all known risks', 'Automatic enrollment without explanation'], 'Informed consent communicates the study and its risks so participation is voluntary.', FDA_DRUG_DEVELOPMENT_URL, 2),
  ],
  'Histamine and Antihistamines': [
    q('Activation of H1 receptors in many tissues is associated with:', 'Allergic symptoms such as itching and increased vascular permeability', ['Reduced gastric acid secretion as the only effect', 'Inhibition of every immune cell', 'Renal glucose reabsorption'], 'H1 signaling contributes to common allergic and inflammatory symptoms.', ANTIHISTAMINE_URL, 1),
    q('Why are some first-generation H1 antihistamines more likely to cause sedation?', 'They cross the blood-brain barrier more readily', ['They selectively activate H2 receptors', 'They cannot enter systemic circulation', 'They irreversibly inhibit histamine synthesis'], 'Many first-generation agents enter the CNS and can cause sedation.', ANTIHISTAMINE_URL, 2),
  ],
  'Serotonin and Eicosanoids': [
    q('Which serotonin receptor is a ligand-gated ion channel?', '5-HT3', ['5-HT1A', '5-HT2A', '5-HT4'], '5-HT3 is the major ionotropic serotonin receptor; the other listed families are GPCRs.', OPEN_RN_URL, 1),
    q('Eicosanoids are commonly synthesized from which membrane-derived precursor?', 'Arachidonic acid', ['Tyrosine', 'Glycogen', 'Cholesterol only'], 'Many eicosanoids are formed from arachidonic acid released from membrane phospholipids.', NSAID_URL, 2),
  ],
  'NSAIDs and Antipyretics': [
    q('The principal pharmacological action shared by many NSAIDs is inhibition of:', 'Cyclooxygenase-mediated prostanoid synthesis', ['Mu-opioid receptors', 'Histamine synthesis', 'Renal glucose transporters'], 'NSAIDs inhibit COX enzymes and reduce prostanoid synthesis.', NSAID_URL, 1),
    q('Why can NSAIDs worsen renal function in a susceptible, volume-depleted patient?', 'Reduced renal prostaglandin synthesis can impair compensatory renal blood flow', ['They directly increase glomerular filtration in all patients', 'They permanently block aldosterone receptors', 'They prevent all tubular reabsorption'], 'Renal prostaglandins help maintain perfusion in susceptible states; NSAID inhibition can compromise this compensation.', NSAID_URL, 2),
  ],
  'Opioid Analgesics': [
    q('Which receptor is a major mediator of opioid analgesia and respiratory depression?', 'Mu opioid receptor', ['H2 histamine receptor', 'Beta-1 adrenergic receptor', 'Nicotinic muscle receptor'], 'Mu-receptor activation contributes to analgesia and dose-related respiratory depression.', OPEN_RN_URL, 1),
    q('Naloxone reverses many opioid effects primarily by acting as a:', 'Competitive opioid receptor antagonist', ['Mu receptor agonist', 'COX-2 inhibitor', 'GABA-A channel opener'], 'Naloxone competitively antagonizes opioid receptors and can reverse opioid toxicity.', OPEN_RN_URL, 2),
  ],
  'DMARDs and Biological Agents': [
    q('Methotrexate is used as a conventional DMARD in inflammatory disease mainly because it:', 'Modifies immune and inflammatory activity at low-dose regimens', ['Acts as a selective opioid agonist', 'Inhibits all bacterial cell walls', 'Replaces insulin'], 'Methotrexate is an immunomodulatory conventional DMARD used in inflammatory diseases.', OPEN_RN_URL, 1),
    q('A clinically important safety consideration with many biologic immunomodulators is:', 'Increased susceptibility to certain infections', ['Universal protection from infection', 'Permanent elimination of vaccine responses in every patient', 'Immediate reversal of all autoimmune disease'], 'Targeted immunomodulation can increase infection risk; screening and monitoring depend on the agent.', OPEN_RN_URL, 2),
  ],
  'Migraine and Gout': [
    q('Triptans used for acute migraine act primarily as agonists at:', '5-HT1B/1D receptors', ['H1 receptors', 'Mu opioid receptors', 'Dopamine D2 receptors'], 'Triptans activate 5-HT1B/1D receptors to help abort migraine attacks.', OPEN_RN_URL, 1),
    q('Allopurinol lowers urate production by inhibiting:', 'Xanthine oxidase', ['Cyclooxygenase-1', 'H1 receptors', 'Thrombin'], 'Allopurinol inhibits xanthine oxidase and reduces uric acid formation.', OPEN_RN_URL, 2),
  ],
};

const UNIT_VIDEOS: Record<string, VideoSpec> = {
  'ppb-311': {
    title: 'Pharmacology Intro - Pharmacokinetics, Pharmacodynamics, Autonomic, Neuro, Cardiac, Respiratory, GI',
    url: 'https://www.youtube.com/watch?v=1FDgj3R3DDM',
    author: 'Medicosis Perfectionalis',
    description: 'YouTube overview supporting the basic pharmacology unit.',
  },
  'drug-development': {
    title: 'Drug Discovery and Phases of Clinical Research | Explained Step-by-Step',
    url: 'https://www.youtube.com/watch?v=taJXfr1exCQ',
    author: 'Dr Yasser El Dershaby',
    description: 'YouTube overview of drug discovery and clinical research phases.',
  },
  'autacoids-pain-inflammation': {
    title: 'General Pharmacology Part 4 | Autacoids, NSAIDs, Antipyretics & Analgesics',
    url: 'https://www.youtube.com/watch?v=nIG6Ic2Re_Q',
    author: 'Saurya BAMS (TheAyurDoc)',
    description: 'YouTube lecture covering autacoids, NSAIDs, antipyretics, and analgesics.',
  },
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const dryRun = process.argv.includes('--dry-run');
  const topicIds: string[] = [];
  const unitIds: string[] = [];

  try {
    const course = await prisma.course.findUnique({
      where: { id: COURSE_ID },
      select: { id: true, title: true, createdById: true },
    });
    if (!course) {
      const candidates = await prisma.course.findMany({
        where: { title: { contains: 'Pharmacology', mode: 'insensitive' } },
        select: { id: true, title: true, code: true },
        take: 20,
      });
      throw new Error(`Expected Pharmacology course ID ${COURSE_ID} was not found. Matching courses: ${JSON.stringify(candidates)}`);
    }
    if (!(course.title ?? '').toLowerCase().includes('pharmacology')) {
      throw new Error(`Course ${COURSE_ID} is titled "${course.title}", not a Pharmacology course.`);
    }
    const createdById = course.createdById;
    if (!createdById) throw new Error('Pharmacology course has no owner to attribute content to.');

    const units = await prisma.unit.findMany({
      where: { courseId: course.id },
      orderBy: { order: 'asc' },
      include: { topics: { orderBy: { order: 'asc' }, select: { id: true, name: true } } },
    });
    if (units.length !== Object.keys(UNIT_VIDEOS).length) {
      throw new Error(`Expected ${Object.keys(UNIT_VIDEOS).length} pharmacology units, found ${units.length}; refusing partial seeding.`);
    }
    if (units.some(unit => !unit.slug || !UNIT_VIDEOS[unit.slug])) {
      throw new Error('A live pharmacology unit is missing its video mapping or slug; refusing partial seeding.');
    }

    const missingTopics = units.flatMap(unit => unit.topics
      .filter(topic => !TOPIC_QUESTIONS[topic.name])
      .map(topic => `${unit.title}: ${topic.name}`));
    if (missingTopics.length) throw new Error(`No question set is defined for: ${missingTopics.join('; ')}`);

    const topicCount = units.reduce((sum, unit) => sum + unit.topics.length, 0);
    const questionCount = topicCount * 2;
    if (dryRun) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        course: course.title,
        units: units.map(unit => ({ title: unit.title, slug: unit.slug, topics: unit.topics.map(topic => topic.name) })),
        topicCount,
        supplementalQuestions: questionCount,
        unitVideos: Object.keys(UNIT_VIDEOS).length,
      }, null, 2));
      return;
    }

    const result = await prisma.$transaction(async tx => {
      let questionsCreated = 0;
      let topicQuizzesCreated = 0;
      let unitQuizzesCreated = 0;
      let videosCreated = 0;

      for (const unit of units) {
        unitIds.push(unit.id);
        const unitSlug = unit.slug;
        if (!unitSlug) throw new Error(`Unit ${unit.id} is missing a slug.`);
        const video = UNIT_VIDEOS[unitSlug];
        const videoMaterialId = `pharm-unit-video-${unit.slug}`;
        const existingVideo = await tx.material.findUnique({ where: { id: videoMaterialId }, select: { id: true } });
        await tx.material.upsert({
          where: { id: videoMaterialId },
          update: {
            title: video.title,
            description: video.description,
            type: MaterialType.video,
            content: video.url,
            courseId: course.id,
            unitId: unit.id,
            topicId: null,
            metadata: { externalUrl: video.url, isExternal: true, provider: 'YouTube', author: video.author },
          },
          create: {
            id: videoMaterialId,
            title: video.title,
            description: video.description,
            type: MaterialType.video,
            content: video.url,
            courseId: course.id,
            unitId: unit.id,
            topicId: null,
            userId: createdById,
            metadata: { externalUrl: video.url, isExternal: true, provider: 'YouTube', author: video.author },
          },
        });
        if (!existingVideo) videosCreated += 1;

        const unitQuestionIds: string[] = [];
        for (const topic of unit.topics) {
          topicIds.push(topic.id);
          let topicQuiz = await tx.quiz.findFirst({
            where: { unitId: unit.id, topicId: topic.id },
            select: { id: true },
          });
          if (!topicQuiz) {
            topicQuiz = await tx.quiz.create({
              data: {
                title: `${unit.title}: ${topic.name} Practice Quiz`,
                description: `Original practice questions for ${topic.name}, informed by the linked open references and course objectives.`,
                instructions: 'Choose the single best answer for each question.',
                timeLimit: 10,
                maxAttempts: 3,
                passingScore: 70,
                isPublished: true,
                publishedAt: new Date(),
                questionCount: 0,
                shuffleQuestions: true,
                showResults: true,
                unitId: unit.id,
                topicId: topic.id,
                createdBy: createdById,
              },
              select: { id: true },
            });
            topicQuizzesCreated += 1;
          }

          const topicQuestionIds: string[] = [];
          const specs = TOPIC_QUESTIONS[topic.name];
          for (const [questionIndex, item] of specs.entries()) {
            const stableTag = `${VERSION}-${slugify(unitSlug)}-${slugify(topic.name)}-q${questionIndex + 1}`;
            let question = await tx.question.findFirst({
              where: { topicIds: { has: topic.id }, tags: { has: stableTag } },
              select: { id: true },
            });
            if (!question) {
              const options = [...item.distractors];
              options.splice(item.answerPosition, 0, item.answer);
              question = await tx.question.create({
                data: {
                  text: item.prompt,
                  type: QuestionType.multiple_choice,
                  difficulty: QuestionDifficulty.medium,
                  category: QuestionCategory.pharmacology,
                  explanation: item.explanation,
                  conceptsCovered: [topic.name],
                  tags: [VERSION, stableTag, 'original-question', 'open-reference'],
                  points: 1,
                  metadata: { sourceUrl: item.sourceUrl, sourceType: 'open educational reference', originalQuestion: true },
                  isActive: true,
                  createdBy: createdById,
                  courseId: course.id,
                  unitId: unit.id,
                  topicIds: [topic.id],
                  options: {
                    create: options.map((text, order) => ({
                      text,
                      isCorrect: order === item.answerPosition,
                      order,
                    })),
                  },
                },
                select: { id: true },
              });
              questionsCreated += 1;
            }
            topicQuestionIds.push(question.id);
          }

          await tx.quizQuestion.createMany({
            data: topicQuestionIds.map((questionId, order) => ({ quizId: topicQuiz.id, questionId, order: order + 1 })),
            skipDuplicates: true,
          });
          const linkedCount = await tx.quizQuestion.count({ where: { quizId: topicQuiz.id } });
          await tx.quiz.update({
            where: { id: topicQuiz.id },
            data: { questionCount: linkedCount, isPublished: true, publishedAt: new Date() },
          });
          unitQuestionIds.push(topicQuestionIds[0]);
        }

        let unitQuiz = await tx.quiz.findFirst({
          where: { unitId: unit.id, topicId: null },
          select: { id: true },
        });
        if (!unitQuiz) {
          unitQuiz = await tx.quiz.create({
            data: {
              title: `${unit.title} Unit Quiz`,
              description: `Comprehensive unit review with one question mapped to each topic.`,
              instructions: 'Choose the single best answer for each question.',
              timeLimit: Math.max(15, unit.topics.length * 2),
              maxAttempts: 3,
              passingScore: 70,
              isPublished: true,
              publishedAt: new Date(),
              questionCount: 0,
              shuffleQuestions: true,
              showResults: true,
              unitId: unit.id,
              topicId: null,
              createdBy: createdById,
            },
            select: { id: true },
          });
          unitQuizzesCreated += 1;
        }
        await tx.quizQuestion.createMany({
          data: unitQuestionIds.map((questionId, order) => ({ quizId: unitQuiz.id, questionId, order: order + 1 })),
          skipDuplicates: true,
        });
        const linkedUnitCount = await tx.quizQuestion.count({ where: { quizId: unitQuiz.id } });
        await tx.quiz.update({
          where: { id: unitQuiz.id },
          data: { questionCount: linkedUnitCount, isPublished: true, publishedAt: new Date() },
        });
      }

      return { units: units.length, topics: topicCount, questionsCreated, topicQuizzesCreated, unitQuizzesCreated, videosCreated };
    }, { maxWait: 10000, timeout: 60000 });

    console.log(JSON.stringify(result, null, 2));

    if (process.env.REDIS_URL && process.env.ENABLE_REDIS !== 'false') {
      const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 1 });
      try {
        await redis.connect();
        const keys = [
          ...unitIds.map(id => `unit:${id}:questions:v2`),
          ...topicIds.map(id => `topic:${id}:questions:v2`),
        ];
        if (keys.length) await redis.del(...keys);
        await redis.quit();
        console.log('Cleared pharmacology quiz question caches.');
      } catch {
        redis.disconnect();
        console.warn('Could not clear quiz caches; cached question results may persist until their TTL expires.');
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
