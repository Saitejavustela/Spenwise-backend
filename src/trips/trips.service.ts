import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { AddBudgetDto } from './dto/add-budget.dto';
import { AddTripExpenseDto } from './dto/add-trip-expense.dto';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) { }

  async getAllTrips(userId: string) {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createTrip(userId: string, dto: CreateTripDto) {
    return this.prisma.trip.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        userId,
      },
    });
  }

  async addBudget(dto: AddBudgetDto) {
    // Check if category already exists for this trip
    const existing = await this.prisma.tripBudgetCategory.findFirst({
      where: {
        tripId: dto.tripId,
        category: dto.category,
      },
    });

    if (existing) {
      // Update existing budget instead of creating duplicate
      return this.prisma.tripBudgetCategory.update({
        where: { id: existing.id },
        data: {
          allocatedBudget: Number(existing.allocatedBudget) + dto.allocatedBudget,
        },
      });
    }

    return this.prisma.tripBudgetCategory.create({
      data: {
        tripId: dto.tripId,
        category: dto.category,
        allocatedBudget: dto.allocatedBudget,
      },
    });
  }

  async updateBudget(budgetId: string, additionalAmount: number) {
    const budget = await this.prisma.tripBudgetCategory.findUnique({
      where: { id: budgetId },
    });

    if (!budget) throw new NotFoundException('Budget category not found');

    return this.prisma.tripBudgetCategory.update({
      where: { id: budgetId },
      data: {
        additionalBudget: Number(budget.additionalBudget) + additionalAmount,
      },
    });
  }

  async addTripExpense(userId: string, dto: AddTripExpenseDto) {
    // Find or create category by name
    let category = await this.prisma.category.findFirst({
      where: { name: dto.category, userId },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: { name: dto.category, userId },
      });
    }

    return this.prisma.expense.create({
      data: {
        userId,
        tripId: dto.tripId,
        categoryId: category.id,
        description: dto.description,
        amount: dto.amount,
        date: new Date(dto.date),
        paymentMode: dto.paymentMode as any,
      },
    });
  }

  async getCategoryExpenses(tripId: string, category: string, page: number = 1, limit: number = 10) {
    // Find category by name
    const categoryRecord = await this.prisma.category.findFirst({
      where: { name: category },
    });

    if (!categoryRecord) {
      return { expenses: [], total: 0, page, totalPages: 0 };
    }

    const where = {
      tripId,
      categoryId: categoryRecord.id,
    };

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: true,
          subCategory: true,
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async tripSummary(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { budgets: true },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    // Get all categories for name lookup
    const allCategories = await this.prisma.category.findMany();
    const categoryNameToId = new Map(allCategories.map(c => [c.name, c.id]));

    // Get spent per category
    const spent = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { tripId },
      _sum: { amount: true },
    });

    const results = trip.budgets.map((b) => {
      const categoryId = categoryNameToId.get(b.category);
      const spentObj = spent.find((s) => s.categoryId === categoryId);

      const spentAmount = spentObj ? Number(spentObj._sum.amount || 0) : 0;
      const totalBudget = Number(b.allocatedBudget) + Number(b.additionalBudget);
      const remaining = totalBudget - spentAmount;

      return {
        budgetId: b.id,
        category: b.category,
        allocated: Number(b.allocatedBudget),
        additional: Number(b.additionalBudget),
        spent: spentAmount,
        remaining,
        progress: totalBudget > 0 ? (spentAmount / totalBudget) * 100 : 0,
      };
    });

    return {
      trip,
      summary: results,
    };
  }
}

