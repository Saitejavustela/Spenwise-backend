import { Controller, Get, Post, Body, Query, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Req() req, @Query() query: FilterExpenseDto) {
    return this.expensesService.findAll(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.expensesService.findOne(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.expensesService.remove(req.user.userId, id);
  }
}
