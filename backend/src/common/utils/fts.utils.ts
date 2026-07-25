import { PrismaService } from '#infrastructure/prisma/prisma.service';

export class FtsUtils {
  /**
   * Updates the 'fts' column for a specific record using PostgreSQL to_tsvector.
   * This replaces database triggers with explicit application-layer control.
   */
  static async updateFtsVector(
    prisma: PrismaService,
    table: 'courses' | 'units' | 'topics' | 'materials',
    id: string,
  ): Promise<void> {
    let query = '';

    // Logic matches original migration SQL (20251130_add_fts_triggers)
    switch (table) {
      case 'courses':
        query = `
          UPDATE "courses"
          SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
          WHERE id = $1;
        `;
        break;

      case 'units':
        query = `
          UPDATE "units"
          SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(content, '')), 'C')
          WHERE id = $1;
        `;
        break;

      case 'topics':
        query = `
          UPDATE "topics"
          SET fts = setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B')
          WHERE id = $1;
        `;
        break;

      case 'materials':
        query = `
          UPDATE "materials"
          SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(content, '')), 'C')
          WHERE id = $1;
        `;
        break;
    }

    if (query) {
      // Properly parameterize the ID using $1 placeholder
      await prisma.$executeRawUnsafe(query, id);
    }
  }
}
