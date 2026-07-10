const R2_MATERIALS = {
  ppb422Specific: [
    {
      name: "PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt",
      key: "materials/675a157c1daa411c4cc31e0cd3415929867f92eb6ed78e8c17a78aea1d1a55ac-PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt",
      size: "1.62 MB",
      type: "presentation",
      applicableTopics: ["Week 1-14 (General Resource)", "Eye Diseases"]
    },
    {
      name: "Course Outline PPB 422-DERMATOLOGY AND OCULAR DISEASES MARCH-JUNE 2026.docx",
      key: "materials/f82ad2756a5c12bbd5dfb1069e37c45932dc726ae31344a1693f69bc5da09a16-Course Outline PPB 422-DERMATOLOGY AND OCULAR DISEASES MARCH-JUNE 2026.docx",
      size: "0.04 MB",
      type: "document",
      applicableTopics: ["Course Overview"]
    },
    {
      name: "PPB 422 CAT 1 OCT 2022 MARKING SCHEME.pdf",
      key: "materials/e9d005609d08e7964c782ee4e9ef08b59b29bf898dd4892c4acb961dea02c996-PPB 422 CAT 1 OCT 2022 MARKING SCHEME.pdf",
      size: "0.31 MB",
      type: "assessment",
      applicableTopics: ["Assessment Reference", "Study Guide"]
    }
  ],
  anatomyResources: [
    {
      category: "ANATOMY (18 items)",
      applicableTopics: ["Week 1: Anatomy & Physiology of Skin and Eye"],
      relevance: "Essential for understanding skin structure, layers, and eye anatomy",
      key_resources: [
        "textbooks/anatomy/anatomyataglance.pdf",
        "textbooks/anatomy/brs-gross-anatomy-5th-edition.pdf",
        "textbooks/anatomy/clinical-neuroanatomy-made-ridiculously-simple.pdf",
        "textbooks/anatomy/anatomy-physiology-study-and-exam-questions.pdf"
      ]
    }
  ],
  physiologyResources: [
    {
      category: "MEDICAL-PHYSIOLOGY (5 items)",
      applicableTopics: ["Week 1: Anatomy & Physiology of Skin and Eye", "Pathophysiology"],
      relevance: "Critical for understanding skin and eye physiology, homeostasis",
      key_resources: [
        "textbooks/medical-physiology/brs.physiology.5.edition.pdf",
        "textbooks/medical-physiology/ganong-s-review-of-medical-physiology-25th-edition-2016-pdf-.pdf-filen.pdf",
        "textbooks/medical-physiology/guyton-and-hall-textbook-of-medical-physiology-12th-ed.pdf"
      ]
    }
  ],
  pharmacologyResources: [
    {
      category: "PHARMACOLOGY (6+ items)",
      applicableTopics: ["Week 2: Guidelines for Topical Therapy", "Drug Treatment", "Ophthalmic Pharmacology"],
      relevance: "Essential for understanding topical agents, antibiotics, antihistamines, antiinflammatories",
      key_resources: [
        "textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf",
        "textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf",
        "textbooks/pharmacology/kd-tripathi-essentials-of-medical-pharmacology-6th-edition-1477380487135-pdfdrive-.pdf",
        "textbooks/pharmacology/rang-dales-pharmacology-pdfdrive-.pdf"
      ]
    }
  ],
  pathologyResources: [
    {
      category: "PATHOLOGY (3 items)",
      applicableTopics: ["Pathology of Dermatological Conditions", "Eye Disease Pathology"],
      relevance: "Fundamental for understanding disease processes in skin and ocular pathology",
      key_resources: [
        "textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf",
        "textbooks/pathology/harsh-mohan-textbook-of-pathology-6th-ed.pdf",
        "textbooks/pathology/robbins-basic-pathology-vinay-kumar-abul-k.-abbas-jon-c.-aster-z-lib.org.pdf"
      ]
    }
  ],
  biochemistryResources: [
    {
      category: "BIOCHEMISTRY (19 items)",
      applicableTopics: ["Week 1: Anatomy & Physiology of Skin and Eye"],
      relevance: "Supporting biochemical processes in skin and eye",
      note: "Available but lower priority than anatomy/physiology"
    }
  ]
};

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    PPB-422 MATERIAL MAPPING STRATEGY                       ║
║                Dermatology and Ocular Diseases Course                      ║
╚════════════════════════════════════════════════════════════════════════════╝

📚 TOTAL R2 MATERIALS: 93 objects
   - PPB-422 Specific: 3 materials ✨
   - Medical Textbooks: 90 materials (organized by subject)

═══════════════════════════════════════════════════════════════════════════════

🎯 RECOMMENDED MATERIAL ASSIGNMENT BY COURSE WEEK
═══════════════════════════════════════════════════════════════════════════════

📖 Week 1: Anatomy & Physiology of Skin and Eye
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/anatomy/anatomyataglance.pdf
      • textbooks/anatomy/brs-gross-anatomy-5th-edition.pdf
      • textbooks/medical-physiology/brs.physiology.5.edition.pdf
      • textbooks/medical-physiology/ganong-s-review-of-medical-physiology-25th-edition-2016.pdf

📖 Week 2: Guidelines for Topical Therapy
   └─ Primary Resources:
      • textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf
      • textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf
      • textbooks/pharmacology/kd-tripathi-essentials-of-medical-pharmacology-7th-edition.pdf
      • Pharmacy/PHARMACOLOGY/KD Tripathi - Essentials of Medical Pharmacology 6th Edition

📖 Week 3: Acne Vulgaris
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf
      • textbooks/pharmacology/* (for treatment options)

📖 Week 4: Skin Infections (Bacterial, Fungal, Viral, Parasitic)
   └─ Primary Resources:
      • materials/98b7d1317b9889f8f65c92603519a32a19d917de91e53b34ab8d168d991914e9-Antibiotics book WHO.pdf
      • textbooks/pathology/* (for disease pathology)
      • textbooks/pharmacology/* (for antimicrobial agents)

📖 Week 5: Eczema and Allergic Dermatitis
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf
      • textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf

📖 Week 6: Psoriasis and Scaling Disorders
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/harsh-mohan-textbook-of-pathology-6th-ed.pdf

📖 Week 7: Pigmentation Disorders
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/anatomy/anatomyataglance.pdf

📖 Week 8: Urticaria and Angioedema
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pharmacology/goodman-gilmans-the-pharmacological-basis-of-therapeutics-13th-ed.pdf

📖 Week 9: Cutaneous Malignancies
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/robbins-basic-pathology-vinay-kumar-abul-k.-abbas-jon-c.-aster-z-lib.org.pdf

📖 Week 10: Acanthosis Nigricans
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/* (for metabolic connections)

📖 Week 11: Keratosis and Nevi
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pathology/fundamentals-of-pathology-pathoma-2018-pdfdrive-.pdf

📖 Week 12: Eye Diseases - General Overview
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt (specific to eye section)
      • textbooks/anatomy/clinical-neuroanatomy-made-ridiculously-simple.pdf

📖 Week 13: Common Ophthalmic Conditions
   └─ Primary Resources:
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
      • textbooks/pharmacology/katzung-basic-and-clinical-pharmacology-14th-edition.pdf (ophthalmic drugs)

📖 Week 14: Assessment and Review
   └─ Primary Resources:
      • PPB 422 CAT 1 OCT 2022 MARKING SCHEME.pdf
      • Course Outline PPB 422-DERMATOLOGY AND OCULAR DISEASES MARCH-JUNE 2026.docx
      • PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt (review)

═══════════════════════════════════════════════════════════════════════════════

📋 MATERIAL INVENTORY ORGANIZED BY UTILITY
═══════════════════════════════════════════════════════════════════════════════

✨ CRITICAL (Must Include):
   1. PPB 422 SKIN AND OCULAR DISEASES - THE EYE 2021.ppt
   2. Katzung - Basic and Clinical Pharmacology 14th Edition
   3. BRS Gross Anatomy & Physiology
   4. Fundamentals of Pathology (Pathoma)

🔑 ESSENTIAL (Should Include):
   1. Goodman & Gilman's Pharmacological Basis of Therapeutics
   2. Harper's Biochemistry
   3. Guyton and Hall Textbook of Medical Physiology
   4. Robbins Basic Pathology

⚙️ SUPPORTING (Optional but Helpful):
   1. Antibiotics book WHO.pdf (for infection topics)
   2. All other anatomy/physiology/pathology texts
   3. KD Tripathi Pharmacology texts
   4. Biochemistry and Chemistry texts

═══════════════════════════════════════════════════════════════════════════════

NEXT STEPS:
1. Extract full R2 keys for each material
2. Update courses.seed.ts with materialsbyTopics mapping
3. Associate specific R2 keys with PPB-422 topics
4. Run seed to persist relationships to database
5. Verify frontend displays topic materials correctly

═══════════════════════════════════════════════════════════════════════════════
`);

console.log('\n✅ Material mapping strategy complete. Ready to update seed data.');
