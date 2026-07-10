require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function getFullR2MaterialsList() {
  try {
    console.log('🔍 Fetching complete R2 materials list for seed data generation...\n');
    
    let continuationToken;
    const allObjects = [];

    do {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await s3Client.send(command);
      
      if (response.Contents) {
        allObjects.push(...response.Contents);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Create structured material references for seed data
    const materials = {
      ppb422_specific: [],
      anatomy: [],
      physiology: [],
      pharmacology: [],
      pathology: [],
      biochemistry: [],
      antibiotics: [],
      protocols: []
    };

    // Categorize all materials
    allObjects.forEach(obj => {
      if (!obj.Key) return;
      
      const lower = obj.Key.toLowerCase();
      const fileName = obj.Key.split('/').pop();
      
      // PPB 422 specific
      if (lower.includes('ppb 422') || lower.includes('ppb-422')) {
        materials.ppb422_specific.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: obj.Key.endsWith('.ppt') || obj.Key.endsWith('.pptx') ? 'presentation' :
                 obj.Key.endsWith('.docx') ? 'document' : 'pdf'
        });
      }
      // Antibiotics
      else if (lower.includes('antibiotic')) {
        materials.antibiotics.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Anatomy
      else if (obj.Key.includes('anatomy') || lower.includes('anatomic') || lower.includes('neuro')) {
        materials.anatomy.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Physiology
      else if (obj.Key.includes('medical-physiology') || lower.includes('physiolog') || lower.includes('ganong') || lower.includes('guyton')) {
        materials.physiology.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Pharmacology
      else if (obj.Key.includes('pharmacology') || lower.includes('pharmacology') || lower.includes('katzung') || lower.includes('tripathi') || lower.includes('goodman')) {
        materials.pharmacology.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Pathology
      else if (obj.Key.includes('pathology') || lower.includes('pathology') || lower.includes('robbins') || lower.includes('pathoma')) {
        materials.pathology.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Biochemistry
      else if (obj.Key.includes('biochemistry') || lower.includes('biochem')) {
        materials.biochemistry.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: 'pdf'
        });
      }
      // Protocols/Guidelines
      else if (obj.Key.includes('CME') || lower.includes('protocol') || lower.includes('guideline') || lower.includes('marking')) {
        materials.protocols.push({
          key: obj.Key,
          name: fileName,
          size: obj.Size,
          type: obj.Key.endsWith('.pdf') ? 'pdf' : 'document'
        });
      }
    });

    // Generate TypeScript code snippet for seed data
    const seedCode = `
// ========================================
// PPB-422 MATERIAL REFERENCES (Generated)
// ========================================
// Copy this into courses.seed.ts for the PPB-422 course topics

const PPB422_MATERIALS = {
  // COURSE-LEVEL MATERIALS
  course: [
${materials.ppb422_specific.map(m => `    { 
      title: '${m.name.replace(/'/g, "\\'")}',
      type: '${m.type}',
      content: '${m.key}',
      description: 'PPB-422 Reference Material'
    },`).join('\n')}
  ],

  // WEEK 1: Anatomy & Physiology of Skin and Eye
  week1: [
    {
      title: 'PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021',
      type: 'presentation',
      content: '${materials.ppb422_specific.find(m => m.key.includes('PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021'))?.key || ''}',
      description: 'Primary course presentation covering skin and eye anatomy'
    },
${materials.anatomy.slice(0, 3).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'Anatomy reference for skin and eye structures'
    },`).join('\n')}
${materials.physiology.slice(0, 2).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'Physiology reference for skin and eye function'
    },`).join('\n')}
  ],

  // WEEK 2: Guidelines for Topical Therapy
  week2: [
${materials.pharmacology.slice(0, 3).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'Pharmacology reference for topical therapy'
    },`).join('\n')}
  ],

  // WEEK 4: Skin Infections
  week4: [
${materials.antibiotics.slice(0, 1).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'WHO Antibiotics guidelines for skin infections'
    },`).join('\n')}
${materials.pharmacology.slice(3, 4).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'Antimicrobial agents reference'
    },`).join('\n')}
  ],

  // WEEK 3-14: General Dermatology & Pathology Resources
  dermatologyPathology: [
${materials.pathology.slice(0, 3).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: 'pdf',
      content: '${m.key}',
      description: 'Pathology reference for dermatological conditions'
    },`).join('\n')}
  ],

  // ASSESSMENT MATERIALS
  assessment: [
${materials.protocols.slice(0, 2).map(m => `    {
      title: '${m.name.replace(/'/g, "\\'")}',
      type: '${m.type}',
      content: '${m.key}',
      description: 'Assessment and evaluation reference'
    },`).join('\n')}
  ]
};`;

    console.log(seedCode);
    
    console.log('\n\n// ========================================\n// MATERIAL STATISTICS\n// ========================================\n');
    console.log(`PPB-422 Specific Materials: ${materials.ppb422_specific.length}`);
    console.log(`Anatomy References: ${materials.anatomy.length}`);
    console.log(`Physiology References: ${materials.physiology.length}`);
    console.log(`Pharmacology References: ${materials.pharmacology.length}`);
    console.log(`Pathology References: ${materials.pathology.length}`);
    console.log(`Biochemistry References: ${materials.biochemistry.length}`);
    console.log(`Antibiotics References: ${materials.antibiotics.length}`);
    console.log(`Protocols/Guidelines: ${materials.protocols.length}`);
    console.log(`\nTotal: ${allObjects.length} objects in R2`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getFullR2MaterialsList();
