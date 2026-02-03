import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddExpenseDto } from './dto/add-expense.dto';
import { SettlementDto } from './dto/settlement.dto';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) { }

  async getAllGroups(userId: string) {
    return this.prisma.group.findMany({
      where: { createdById: userId },
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGroup(userId: string, dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        createdById: userId,
      },
    });
  }

  async addMember(dto: AddMemberDto) {
    return this.prisma.groupMember.create({
      data: {
        groupId: dto.groupId,
        displayName: dto.displayName,
      },
    });
  }

  async addExpense(dto: AddExpenseDto) {
    // Use transaction to ensure expense and shares are created atomically
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.groupExpense.create({
        data: {
          groupId: dto.groupId,
          paidById: dto.paidBy,
          description: dto.description,
          amount: dto.amount,
          category: dto.category || 'Other',
        },
      });

      await tx.groupShare.createMany({
        data: dto.shares.map((s) => ({
          groupExpenseId: expense.id,
          memberId: s.memberId,
          shareAmount: s.amount,
        })),
      });

      return expense;
    });
  }

  async addSettlement(dto: SettlementDto) {
    return this.prisma.settlement.create({
      data: {
        groupId: dto.groupId,
        fromMemberId: dto.fromMemberId,
        toMemberId: dto.toMemberId,
        amount: dto.amount,
        note: dto.note,
      },
    });
  }

  async groupSummary(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    const balances: Record<string, number> = {};
    members.forEach((m) => (balances[m.id] = 0));

    // Add expenses (paid by someone, owed by others)
    const expenses = await this.prisma.groupExpense.findMany({
      where: { groupId },
      include: { shares: true },
    });

    for (const exp of expenses) {
      balances[exp.paidById] += Number(exp.amount);

      for (const share of exp.shares) {
        balances[share.memberId] -= Number(share.shareAmount);
      }
    }

    // Apply settlements
    const settlements = await this.prisma.settlement.findMany({
      where: { groupId },
    });

    settlements.forEach((s) => {
      balances[s.fromMemberId] += Number(s.amount);  // fromMember pays, their debt decreases
      balances[s.toMemberId] -= Number(s.amount);   // toMember receives, their credit decreases
    });

    const owes: { memberId: string; name: string | undefined; balance: number }[] = [];
    for (const mId in balances) {
      owes.push({
        memberId: mId,
        name: members.find((m) => m.id === mId)?.displayName,
        balance: balances[mId],
      });
    }

    // Calculate suggested settlements (minimize transactions)
    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    for (const mId in balances) {
      const bal = balances[mId];
      const name = members.find((m) => m.id === mId)?.displayName || 'Unknown';
      if (bal < -0.01) {
        debtors.push({ id: mId, name, amount: Math.abs(bal) });
      } else if (bal > 0.01) {
        creditors.push({ id: mId, name, amount: bal });
      }
    }

    // Sort both by amount (greedy algorithm)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestedSettlements: {
      fromId: string;
      fromName: string;
      toId: string;
      toName: string;
      amount: number;
    }[] = [];

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      if (settleAmount > 0.01) {
        suggestedSettlements.push({
          fromId: debtor.id,
          fromName: debtor.name,
          toId: creditor.id,
          toName: creditor.name,
          amount: Math.round(settleAmount * 100) / 100,
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // Format settlements history
    const settlementsHistory = settlements.map((s) => ({
      id: s.id,
      fromName: members.find((m) => m.id === s.fromMemberId)?.displayName,
      toName: members.find((m) => m.id === s.toMemberId)?.displayName,
      amount: Number(s.amount),
      note: s.note,
      settledAt: s.date,
    }));

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const exp of expenses) {
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount);
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total,
    }));

    return {
      group,
      members,
      balances: owes,
      suggestedSettlements,
      settlementsHistory,
      categoryBreakdown,
      expenses: expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        category: e.category || 'Other',
        paidById: e.paidById,
        paidByName: members.find((m) => m.id === e.paidById)?.displayName,
        date: e.date,
      })),
    };
  }

  async deleteMember(memberId: string) {
    // Get the member
    const member = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    // Check if member has any expenses they paid
    const expenseCount = await this.prisma.groupExpense.count({
      where: { paidById: memberId },
    });

    // Check if member has any shares
    const shareCount = await this.prisma.groupShare.count({
      where: { memberId },
    });

    // Check if member has any settlements
    const settlementCount = await this.prisma.settlement.count({
      where: {
        OR: [{ fromMemberId: memberId }, { toMemberId: memberId }],
      },
    });

    if (expenseCount > 0 || shareCount > 0 || settlementCount > 0) {
      throw new BadRequestException(
        'Cannot delete member who has participated in expenses or settlements. Members can only be deleted if they have no activity in the group.'
      );
    }

    return this.prisma.groupMember.delete({
      where: { id: memberId },
    });
  }

  async deleteGroup(userId: string, groupId: string) {
    // Verify ownership
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.createdById !== userId) {
      throw new BadRequestException('Group not found or you are not the owner');
    }

    // Use transaction to delete all related data
    return this.prisma.$transaction(async (tx) => {
      // Delete all shares from expenses in this group
      const expenses = await tx.groupExpense.findMany({
        where: { groupId },
        select: { id: true },
      });
      const expenseIds = expenses.map((e) => e.id);

      await tx.groupShare.deleteMany({
        where: { groupExpenseId: { in: expenseIds } },
      });

      // Delete all expenses
      await tx.groupExpense.deleteMany({
        where: { groupId },
      });

      // Delete all settlements
      await tx.settlement.deleteMany({
        where: { groupId },
      });

      // Delete all members
      await tx.groupMember.deleteMany({
        where: { groupId },
      });

      // Delete the group
      return tx.group.delete({
        where: { id: groupId },
      });
    });
  }

  async getCategorySummary(groupId: string, category: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    // Get all expenses for the group to calculate totals
    const allExpenses = await this.prisma.groupExpense.findMany({
      where: { groupId },
      include: { shares: true },
    });

    // Get category-specific expenses
    const categoryExpenses = allExpenses.filter(e => e.category === category);

    // Calculate overall balances (without settlements)
    const overallBalances: Record<string, number> = {};
    members.forEach((m) => (overallBalances[m.id] = 0));

    for (const exp of allExpenses) {
      overallBalances[exp.paidById] += Number(exp.amount);
      for (const share of exp.shares) {
        overallBalances[share.memberId] -= Number(share.shareAmount);
      }
    }

    // Calculate category-specific balances (without settlements)
    const categoryBalancesRaw: Record<string, number> = {};
    members.forEach((m) => (categoryBalancesRaw[m.id] = 0));

    for (const exp of categoryExpenses) {
      categoryBalancesRaw[exp.paidById] += Number(exp.amount);
      for (const share of exp.shares) {
        categoryBalancesRaw[share.memberId] -= Number(share.shareAmount);
      }
    }

    // Get settlements
    const settlements = await this.prisma.settlement.findMany({
      where: { groupId },
    });

    // Apply settlements proportionally to this category
    // Ratio = |category debt| / |overall debt| for each member
    const adjustedBalances: Record<string, number> = { ...categoryBalancesRaw };

    for (const settlement of settlements) {
      const fromId = settlement.fromMemberId;
      const toId = settlement.toMemberId;
      const settlementAmount = Number(settlement.amount);

      // Calculate what proportion of this settlement applies to this category
      // Based on debt ratios in this category vs overall

      const fromOverallDebt = Math.abs(Math.min(0, overallBalances[fromId] || 0));
      const fromCategoryDebt = Math.abs(Math.min(0, categoryBalancesRaw[fromId] || 0));

      const toOverallCredit = Math.max(0, overallBalances[toId] || 0);
      const toCategoryCredit = Math.max(0, categoryBalancesRaw[toId] || 0);

      // Proportional settlement for this category
      let categorySettlementRatio = 0;
      if (fromOverallDebt > 0.01 && toOverallCredit > 0.01) {
        // Use average of from and to ratios
        const fromRatio = fromCategoryDebt / fromOverallDebt;
        const toRatio = toCategoryCredit / toOverallCredit;
        categorySettlementRatio = (fromRatio + toRatio) / 2;
      }

      const categorySettlementAmount = settlementAmount * categorySettlementRatio;

      // Apply proportional settlement
      adjustedBalances[fromId] = (adjustedBalances[fromId] || 0) + categorySettlementAmount;
      adjustedBalances[toId] = (adjustedBalances[toId] || 0) - categorySettlementAmount;
    }

    const categoryBalances = members.map((m) => ({
      memberId: m.id,
      name: m.displayName,
      balance: Math.round((adjustedBalances[m.id] || 0) * 100) / 100,
    }));

    // Calculate suggested settlements for this category (based on adjusted balances)
    const debtors: { id: string; name: string; amount: number }[] = [];
    const creditors: { id: string; name: string; amount: number }[] = [];

    for (const m of members) {
      const bal = adjustedBalances[m.id] || 0;
      if (bal < -0.01) {
        debtors.push({ id: m.id, name: m.displayName, amount: Math.abs(bal) });
      } else if (bal > 0.01) {
        creditors.push({ id: m.id, name: m.displayName, amount: bal });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestedSettlements: {
      fromId: string;
      fromName: string;
      toId: string;
      toName: string;
      amount: number;
    }[] = [];

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      if (settleAmount > 0.01) {
        suggestedSettlements.push({
          fromId: debtor.id,
          fromName: debtor.name,
          toId: creditor.id,
          toName: creditor.name,
          amount: Math.round(settleAmount * 100) / 100,
        });
      }

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return {
      category,
      totalSpent: categoryExpenses.reduce((acc, e) => acc + Number(e.amount), 0),
      balances: categoryBalances,
      suggestedSettlements,
      expenses: categoryExpenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        paidById: e.paidById,
        paidByName: members.find((m) => m.id === e.paidById)?.displayName,
        date: e.date,
      })),
    };
  }
}
