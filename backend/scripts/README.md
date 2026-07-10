PDF Extraction Script
======================

This script extracts unit/topic headings from a PDF and writes a skeleton JSON file you can use to generate seeds.

Usage
-----
1. Place your PDF in the `backend/seed-data/pdfs` folder (create it if it doesn't exist).
2. Run:

```bash
node scripts/extract_pdf_topics.js seed-data/pdfs/your-biochem.pdf prisma/seeds/biochem-extract.json
```

3. Inspect the generated `prisma/seeds/biochem-extract.json` and modify it to match your desired seed structure.

Converting extractor JSON to seed-ready format
--------------------------------------------
- After you’ve cleaned up the extractor JSON, run:

```bash
pnpm convert:extract backend/prisma/seeds/biochem-textbook-extract.json
```

This will produce a file alongside the extractor file ending with `.converted.json` which contains `units` and `topics` shaped for the seed script to merge (order and duration defaults added). Set env var `MERGE_EXTRACT_FILE` pointing to the converted JSON before running the seed.

Uploading local PDF files to S3 (optional)
----------------------------------------
If you have an S3 bucket and want to link real files to seeded materials, run the uploader script after placing PDF files in `backend/seed-data/pdfs`:

```bash
S3_BUCKET=your-bucket pnpm backend:upload-files backend/seed-data/pdfs
```

The uploader creates `backend/prisma/seeds/file-mappings.json` which the seeder will read to attach S3 URLs and file IDs to seeded materials.

Notes
-----
- This script uses simple heuristics and won't perfectly parse all PDFs. It’s a starting point — manual cleanup is expected.
- The output JSON is meant to be merged into `prisma/seeds/courses.seed.ts` or used as a separate seed that you can `require` in your seeds.
