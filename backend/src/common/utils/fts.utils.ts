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
          WHERE id = '${id}';
        `;
        break;

      case 'units':
        query = `
          UPDATE "units"
          SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(content, '')), 'C')
          WHERE id = '${id}';
        `;
        break;

      case 'topics':
        query = `
          UPDATE "topics"
          SET fts = setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B')
          WHERE id = '${id}';
        `;
        break;

      case 'materials':
        query = `
          UPDATE "materials"
          SET fts = setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                    setweight(to_tsvector('english', coalesce(content, '')), 'C')
          WHERE id = '${id}';
        `;
        break;
    }

    if (query) {
      // Using queryRawUnsafe because table names are parameterized logic but 'id' is safe (uuid)
      // or we can just inject the ID directly if we trust it (it comes from the app).
      // Ideally we use parameters: $1, but for UPDATE with specific logic it's often easier to string build standard SQL for invariant parts.
      // But let's use $1 for ID to be safe.
      const safeQuery = query.replace(`'${id}'`, '$1');
      await prisma.$executeRawUnsafe(safeQuery, id);
    }
  }
}
