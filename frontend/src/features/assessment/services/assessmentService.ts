export interface Assessment {
  id: string;
  title: string;
  description: string;
  type: 'quiz' | 'exam' | 'flashcard' | 'adaptive';
  status: 'draft' | 'published' | 'archived';
  // Add other relevant assessment properties
}

export const fetchAssessments = async (): Promise<Assessment[]> => {
  // Placeholder for API call to fetch assessments
  return [
    {
      id: '1',
      title: 'Introduction to Cardiology',
      description: 'A basic quiz on cardiovascular system.',
      type: 'quiz',
      status: 'published',
    },
    {
      id: '2',
      title: 'Emergency Medicine Exam',
      description: 'Comprehensive exam for emergency scenarios.',
      type: 'exam',
      status: 'published',
    },
  ];
};
