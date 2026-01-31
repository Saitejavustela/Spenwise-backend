import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) { }

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        subCategoryId: dto.subCategoryId || null,
        description: dto.description,
        date: new Date(dto.date),
        paymentMode: dto.paymentMode,
        upiProvider: dto.upiProvider || null,
        amount: new Prisma.Decimal(dto.amount),
        tripId: dto.tripId || null,
      },
    });
  }

  async findAll(userId: string, filter: FilterExpenseDto) {
    const {
      from,
      to,
      categoryId,
      subCategoryId,
      paymentMode,
      search,
      page = 1,
      pageSize = 20,
    } = filter;

    const where: Prisma.ExpenseWhereInput = {
      userId,
    };

    if (from || to) {
      where.date = {};
      if (from) (where.date as any).gte = new Date(from);
      if (to) (where.date as any).lte = new Date(to);
    }

    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (paymentMode) where.paymentMode = paymentMode;

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          category: true,
          subCategory: true,
          trip: true,
        },
        skip,
        take: pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(userId: string, id: string) {
    return this.prisma.expense.findFirst({
      where: { id, userId },
      include: { category: true, subCategory: true },
    });
  }

  async remove(userId: string, id: string) {
    // Ensure ownership
    const found = await this.prisma.expense.findFirst({
      where: { id, userId },
    });
    if (!found) return null;

    return this.prisma.expense.delete({ where: { id } });
  }
}
