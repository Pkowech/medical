export interface CPDActivity {
  id: string;
  type: string;
  points: number;
  date: Date;
  description: string;
  isVerified: boolean;
  unit?: {
    id: string;
    name: string;
  };
  course?: {
    id: string;
    name: string;
  };
  material?: {
    id: string;
    title: string;
  };
}

export interface CPDCycle {
  id: string;
  startDate: Date;
  endDate: Date;
  targetPoints: number;
  earnedPoints: number;
  unitProgress: {
    unitId: string;
    unitName: string;
    requiredPoints: number;
    earnedPoints: number;
    lastUpdated?: number;
  }[];
}

export interface CPDDashboardProps {
  activities: CPDActivity[];
  currentCycle: CPDCycle;
  upcomingDeadlines: {
    type: string;
    description: string;
    dueDate: Date;
  }[];
}
