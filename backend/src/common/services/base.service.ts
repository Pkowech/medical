import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaginationDto } from '../dto/pagination.dto';
import { ResourceNotFoundException } from '../exceptions/not-found.exception';

@Injectable()
export abstract class BaseService<T = any> {
  protected abstract modelName: string;

  constructor(protected readonly prisma: PrismaService) {}

  protected get model() {
    return this.prisma[this.modelName];
  }

  async findById(id: string, include?: any): Promise<T> {
    const item = await this.model.findUnique({
      where: { id },
      ...(include && { include }),
    });

    if (!item) {
      throw new ResourceNotFoundException(
        `${this.modelName} with ID '${id}' not found`,
      );
    }

    return item;
  }

  async findMany(
    pagination?: PaginationDto,
    filters?: any,
    include?: any,
    orderBy?: any,
  ): Promise<{
    data: T[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 10 } = pagination || {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: filters,
        include,
        orderBy,
        skip,
        take: limit,
      }),
      this.model.count({ where: filters }),
    ]);

    return this.buildPaginationResponse(data, total, page, limit);
  }

  async count(where?: any): Promise<number> {
    return await this.model.count({ where });
  }

  async create(data: any, include?: any): Promise<T> {
    return await this.model.create({
      data,
      ...(include && { include }),
    });
  }

  async update(id: string, data: any, include?: any): Promise<T> {
    await this.findById(id); // Check if exists
    return this.model.update({
      where: { id },
      data,
      ...(include && { include }),
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // Check if exists
    await this.model.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.model.count({ where: { id } });
    return count > 0;
  }

  protected buildPaginationResponse(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  protected async executeTransaction<R>(
    fn: (tx: PrismaService) => Promise<R>,
  ): Promise<R> {
    return this.prisma.$transaction(async (tx) => {
      return fn(tx as any);
    });
  }
}
