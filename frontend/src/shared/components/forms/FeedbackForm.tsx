import { useState } from 'react';

import { apiService } from '@/features/auth/services/apiClient';

export default function FeedbackForm({ userId }: { userId: string }) {
  const [comments, setComments] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [materialId, setMaterialId] = useState('');
  const [unitId, setUnitId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.post('/feedback', {
        userId,
        comments,
        rating,
        materialId,
        unitId,
      });
      alert('Feedback submitted!');
      setComments('');
      setRating(undefined);
      setMaterialId('');
      setUnitId('');
    } catch (error) {
      console.error('Feedback submission failed:', error);
      alert('Failed to submit feedback');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Submit Feedback</h2>
      <textarea
        value={comments}
        onChange={e => setComments(e.target.value)}
        placeholder="Your comments"
        className="w-full p-2 border rounded mb-4"
        required
      />
      <input
        type="number"
        value={rating || ''}
        onChange={e => setRating(parseInt(e.target.value))}
        placeholder="Rating (1-5)"
        min="1"
        max="5"
        className="w-full p-2 border rounded mb-4"
      />
      <input
        value={materialId}
        onChange={e => setMaterialId(e.target.value)}
        placeholder="Material ID (optional)"
        className="w-full p-2 border rounded mb-4"
      />
      <input
        value={unitId}
        onChange={e => setUnitId(e.target.value)}
        placeholder="Unit ID (optional)"
        className="w-full p-2 border rounded mb-4"
      />
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Submit
      </button>
    </form>
  );
}
