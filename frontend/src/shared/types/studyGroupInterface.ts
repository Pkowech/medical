export interface Member {
  id: string;
  userId: string;
  groupId: string;
  role: 'member' | 'admin' | 'owner';
  joinedAt: string;
}

export interface MembershipRequest {
  id: string;
  userId: string;
  groupId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}
export interface GroupScheduleEntry {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  start: string; // ISO date
  end?: string; // ISO date
  location?: string;
}

export interface GroupSchedule {
  groupId: string;
  entries: GroupScheduleEntry[];
}
