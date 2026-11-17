import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../../../common/dto/course.dto';

@Injectable()
export class CourseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const {
      name,
      slug,
      description,
      parentId,
      isActive = true,
    } = createCategoryDto;

    // Check if slug exists
    const existing = await this.prisma.courseCategory.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException('Category slug already exists');
    }
    await this.assertValidParent(undefined, parentId);

    return await this.prisma.courseCategory.create({
      data: {
        name,
        slug,
        description,
        isActive,
        parentId,
      },
    });
  }

  async findAll(includeInactive?: boolean) {
    return await this.prisma.courseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { parent: true, children: true, courses: true },
    });
  }

  async getHierarchy() {
    return await this.prisma.courseCategory.findMany({
      where: { parentId: null },
      include: { children: { include: { children: true } } },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
      include: { parent: true, children: true, courses: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { slug },
      include: { parent: true, children: true, courses: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async getCategoryStats(id: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
      include: { courses: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return {
      courseCount: category.courses.length,
      activeCourses: category.courses.filter((c) => c.status === 'published')
        .length,
      totalEnrollments: 0,
    };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const { slug } = updateCategoryDto;

    if (slug) {
      const existing = await this.prisma.courseCategory.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Category slug already exists');
      }
    }
    await this.assertValidParent(id, updateCategoryDto.parentId);

    return this.prisma.courseCategory.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  private async assertValidParent(
    categoryId: string | undefined,
    parentId: string | null | undefined,
  ): Promise<void> {
    if (!parentId) return;

    const visited = new Set<string>();
    let currentId: string | null = parentId;
    while (currentId) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new BadRequestException(
          'Category parent would create a hierarchy cycle',
        );
      }
      visited.add(currentId);
      const current: { parentId: string | null } | null =
        await this.prisma.courseCategory.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      if (!current) {
        throw new NotFoundException('Parent category not found');
      }
      currentId = current.parentId;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
      include: { courses: true, children: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.courses.length > 0 || category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with courses or subcategories',
      );
    }
    await this.prisma.courseCategory.delete({ where: { id } });
  }
}
