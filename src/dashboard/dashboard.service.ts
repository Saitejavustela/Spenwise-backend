import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { subDays, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) { }

  async overview(userId: string) {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const monthStart = startOfMonth(today);
    const last30Days = subDays(today, 29);

    // Totals
    const [overall, monthTotal, weekTotal] = await this.prisma.$transaction([
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { userId },
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          date: { gte: monthStart },
        },
      }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          date: { gte: weekStart },
        },
      }),
    ]);

    const totalOverall = Number(overall._sum.amount || 0);
    const totalThisMonth = Number(monthTotal._sum.amount || 0);
    const totalThisWeek = Number(weekTotal._sum.amount || 0);

    // Today expenses
    const todayExpenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: today,
        },
      },
      orderBy: { date: 'desc' },
      include: { category: true, subCategory: true },
    });

    // Daily series (last 30 days)
    const dailyRaw = await this.prisma.expense.groupBy({
      by: ['date'],
      where: {
        userId,
        date: { gte: last30Days },
      },
      _sum: { amount: true },
    });

    const dailySeries = dailyRaw.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      amount: Number(d._sum.amount || 0),
    }));

    // Category-wise series (for month)
    const categoryRaw = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryRaw.map((c) => c.categoryId) } },
    });

    const categorySeries = categoryRaw.map((c) => {
      const cat = categories.find((x) => x.id === c.categoryId);
      return {
        categoryId: c.categoryId,
        categoryName: cat?.name ?? 'Unknown',
        amount: Number(c._sum.amount || 0),
      };
    });

    // Monthly series (last 12 months) – simplified example: group by month using raw SQL.
    // For now, we skip raw SQL & let frontend aggregate by date from dailySeries or a /stats/monthly endpoint.

    return {
      totalOverall,
      totalThisMonth,
      totalThisWeek,
      todayExpenses,
      dailySeries,
      categorySeries,
    };
  }

  async getDateRangeSpending(userId: string, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    // Set to end of the toDate
    to.setHours(23, 59, 59, 999);

    // Total in range
    const total = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        date: { gte: from, lte: to },
      },
    });

    // Daily series in range
    const dailyRaw = await this.prisma.expense.groupBy({
      by: ['date'],
      where: {
        userId,
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
      orderBy: { date: 'asc' },
    });

    const dailySeries = dailyRaw.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      amount: Number(d._sum.amount || 0),
    }));

    // Category breakdown in range
    const categoryRaw = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryRaw.map((c) => c.categoryId) } },
    });

    const categorySeries = categoryRaw.map((c) => {
      const cat = categories.find((x) => x.id === c.categoryId);
      return {
        categoryId: c.categoryId,
        categoryName: cat?.name ?? 'Unknown',
        amount: Number(c._sum.amount || 0),
      };
    });

    // Expense count
    const expenseCount = await this.prisma.expense.count({
      where: {
        userId,
        date: { gte: from, lte: to },
      },
    });

    return {
      fromDate,
      toDate,
      totalSpent: Number(total._sum.amount || 0),
      expenseCount,
      dailySeries,
      categorySeries,
    };
  }
}

