import { Controller, Post, Body, Get, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddExpenseDto } from './dto/add-expense.dto';
import { SettlementDto } from './dto/settlement.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) { }

  @Get()
  getAllGroups(@Req() req) {
    return this.groupsService.getAllGroups(req.user.userId);
  }

  @Post()
  createGroup(@Req() req, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(req.user.userId, dto);
  }

  @Post('member')
  addMember(@Body() dto: AddMemberDto) {
    return this.groupsService.addMember(dto);
  }

  @Delete('member/:memberId')
  deleteMember(@Param('memberId') memberId: string) {
    return this.groupsService.deleteMember(memberId);
  }

  @Post('expense')
  addExpense(@Body() dto: AddExpenseDto) {
    return this.groupsService.addExpense(dto);
  }

  @Post('settlement')
  settlement(@Body() dto: SettlementDto) {
    return this.groupsService.addSettlement(dto);
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.groupsService.groupSummary(id);
  }

  @Get(':id/category/:category')
  categorySummary(@Param('id') id: string, @Param('category') category: string) {
    return this.groupsService.getCategorySummary(id, category);
  }

  @Delete(':id')
  deleteGroup(@Req() req, @Param('id') id: string) {
    return this.groupsService.deleteGroup(req.user.userId, id);
  }
}
