import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

@Injectable()
export class MedicalSynonymService implements OnModuleInit {
  private readonly logger = new Logger(MedicalSynonymService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.medicalSynonym.count();
    if (count === 0) {
      this.logger.log('Seeding initial medical synonyms...');
      await this.seedInitialSynonyms();
    }
  }

  /**
   * Expands a search query with medical synonyms
   * e.g., "Heart attack" -> "Heart attack" | "Myocardial Infarction"
   * Returns both the expanded query and the list of matched terms
   */
  async expandQuery(query: string): Promise<{ expandedQuery: string; matches: string[] }> {
    const normalizedQuery = query.toLowerCase().trim();
    const matches: string[] = [];
    let expandedQuery = query;

    // 1. Fetch all synonyms (cached in memory for performance in a real app, but DB is fine for now)
    const allSynonyms = await this.prisma.medicalSynonym.findMany();

    // 2. Look for phrase matches first (longest phrases first)
    // Sort by term length descending to ensure "Heart Attack" matches before "Heart"
    const sortedSynonyms = [...allSynonyms].sort((a, b) => b.term.length - a.term.length);

    for (const record of sortedSynonyms) {
      const termRegex = new RegExp(`\\b${record.term}\\b`, 'gi');
      let foundInQuery = false;

      // Check main term
      if (termRegex.test(normalizedQuery)) {
        foundInQuery = true;
      } else {
        // Check synonyms
        for (const syn of record.synonyms) {
          const synRegex = new RegExp(`\\b${syn}\\b`, 'gi');
          if (synRegex.test(normalizedQuery)) {
            foundInQuery = true;
            break;
          }
        }
      }

      if (foundInQuery) {
        matches.push(record.term);
        const allTerms = [record.term, ...record.synonyms];
        const formattedTerms = allTerms.map(t => 
          t.trim().split(/\s+/).join(' & ')
        );
        const orGroup = `(${formattedTerms.join(' | ')})`;
        
        // Replace the matched part in the query
        // This is a bit tricky if multiple synonyms overlap, but regex \b helps
        expandedQuery = expandedQuery.replace(termRegex, orGroup);
        // Also try to replace any matched synonyms in the query
        for (const syn of record.synonyms) {
          const synRegex = new RegExp(`\\b${syn}\\b`, 'gi');
          expandedQuery = expandedQuery.replace(synRegex, orGroup);
        }
      }
    }

    return { expandedQuery, matches };
  }

  private async seedInitialSynonyms() {
    const initialData = [
      { term: 'Myocardial Infarction', synonyms: ['Heart Attack', 'MI'], category: 'Disease' },
      { term: 'Hypertension', synonyms: ['High Blood Pressure', 'HTN'], category: 'Disease' },
      { term: 'Diabetes Mellitus', synonyms: ['Diabetes', 'DM', 'High Sugar'], category: 'Disease' },
      { term: 'Cerebrovascular Accident', synonyms: ['Stroke', 'CVA'], category: 'Disease' },
      { term: 'Acetaminophen', synonyms: ['Paracetamol', 'Tylenol', 'Panadol'], category: 'Drug' },
      { term: 'Ibuprofen', synonyms: ['Advil', 'Motrin'], category: 'Drug' },
      { term: 'Cephalalgia', synonyms: ['Headache'], category: 'Symptom' },
      { term: 'Dyspnea', synonyms: ['Shortness of Breath', 'SOB'], category: 'Symptom' },
    ];

    for (const data of initialData) {
      await this.prisma.medicalSynonym.upsert({
        where: { term: data.term },
        create: data,
        update: {},
      });
    }
  }
}
