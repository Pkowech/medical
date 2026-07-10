export class UnitCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly unitId: string,
    public readonly courseId: string,
    public readonly completedAt: Date,
    public readonly progressPercentage: number,
  ) {}
}
