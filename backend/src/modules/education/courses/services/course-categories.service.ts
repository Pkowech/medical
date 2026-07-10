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
    const { name, slug, parentId, isActive = true } = createCategoryDto;

    // Check if slug exists
    const existing = await this.prisma.courseCategory.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException('Category slug already exists');
    }

    return await this.prisma.courseCategory.create({
      data: {
        name,
        slug,
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
    const { slug } = updateCategoryDto;

    if (slug) {
      const existing = await this.prisma.courseCategory.findUnique({
        where: { slug },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Category slug already exists');
      }
    }

    const category = await this.prisma.courseCategory.update({
      where: { id },
      data: updateCategoryDto,
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
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
