import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) { }

  @Get('overview')
  overview(@Req() req) {
    return this.dashboardService.overview(req.user.userId);
  }

  @Get('date-range')
  dateRange(
    @Req() req,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.dashboardService.getDateRangeSpending(
      req.user.userId,
      fromDate,
      toDate,
    );
  }
}

