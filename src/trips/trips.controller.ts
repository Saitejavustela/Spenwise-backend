import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTripDto } from './dto/create-trip.dto';
import { AddBudgetDto } from './dto/add-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { AddTripExpenseDto } from './dto/add-trip-expense.dto';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private tripsService: TripsService) { }

  @Get()
  getAllTrips(@Req() req) {
    return this.tripsService.getAllTrips(req.user.userId);
  }

  @Post()
  createTrip(@Req() req, @Body() dto: CreateTripDto) {
    return this.tripsService.createTrip(req.user.userId, dto);
  }

  @Post('budget')
  addBudget(@Body() dto: AddBudgetDto) {
    return this.tripsService.addBudget(dto);
  }

  @Patch('budget/:budgetId')
  updateBudget(@Param('budgetId') budgetId: string, @Body() dto: UpdateBudgetDto) {
    return this.tripsService.updateBudget(budgetId, dto.additionalAmount);
  }

  @Post('expense')
  addTripExpense(@Req() req, @Body() dto: AddTripExpenseDto) {
    return this.tripsService.addTripExpense(req.user.userId, dto);
  }

  @Get(':tripId/category/:category/expenses')
  getCategoryExpenses(
    @Param('tripId') tripId: string,
    @Param('category') category: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.tripsService.getCategoryExpenses(tripId, category, parseInt(page), parseInt(limit));
  }

  @Get(':id/summary')
  summary(@Param('id') id: string) {
    return this.tripsService.tripSummary(id);
  }
}


