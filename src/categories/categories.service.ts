import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubCategoryDto } from './dto/create-subcategory.dto';
import { startOfMonth } from 'date-fns';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) { }

  async getAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId: userId },
      include: { subCategories: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        userId,
      },
    });
  }

  async createSubCategory(dto: CreateSubCategoryDto) {
    return this.prisma.subCategory.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
      },
    });
  }

  async getCategoryDetail(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      include: { subCategories: true },
    });

    if (!category) throw new NotFoundException('Category not found');

    // Total spend in category
    const total = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: { categoryId, userId },
    });

    const totalSpent = Number(total._sum.amount || 0);

    // Sub-category wise breakdown
    const subcategoryBreakdown = await this.prisma.expense.groupBy({
      by: ['subCategoryId'],
      where: { categoryId, userId },
      _sum: { amount: true },
    });

    // Fetch names
    const subs = await this.prisma.subCategory.findMany({
      where: { categoryId },
    });

    const breakdown = subcategoryBreakdown.map((s) => ({
      subCategoryId: s.subCategoryId,
      name: subs.find((x) => x.id === s.subCategoryId)?.name ?? 'Other',
      amount: Number(s._sum.amount || 0),
    }));

    // Graph data (month)
    const monthStart = startOfMonth(new Date());
    const graph = await this.prisma.expense.groupBy({
      by: ['date'],
      where: {
        categoryId,
        userId,
        date: { gte: monthStart },
      },
      _sum: { amount: true },
    });

    const graphSeries = graph.map((g) => ({
      date: g.date.toISOString().slice(0, 10),
      amount: Number(g._sum.amount || 0),
    }));

    // Full expense list
    const expenses = await this.prisma.expense.findMany({
      where: { categoryId, userId },
      include: { subCategory: true },
      orderBy: { date: 'desc' },
    });

    return {
      category,
      totalSpent,
      breakdown,
      graphSeries,
      expenses,
    };
  }

  async deleteCategory(userId: string, categoryId: string) {
    // Verify ownership
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) throw new NotFoundException('Category not found');

    // Use transaction to ensure atomic deletion
    return this.prisma.$transaction(async (tx) => {
      // Delete related expenses first
      await tx.expense.deleteMany({
        where: { categoryId },
      });

      // Delete subcategories
      await tx.subCategory.deleteMany({
        where: { categoryId },
      });

      // Delete the category
      return tx.category.delete({
        where: { id: categoryId },
      });
    });
  }

  async deleteSubCategory(subCategoryId: string) {
    // Use transaction to ensure atomic update and delete
    return this.prisma.$transaction(async (tx) => {
      // First, remove subCategoryId from any expenses using this subcategory
      await tx.expense.updateMany({
        where: { subCategoryId },
        data: { subCategoryId: null },
      });

      // Delete the subcategory
      return tx.subCategory.delete({
        where: { id: subCategoryId },
      });
    });
  }
}
