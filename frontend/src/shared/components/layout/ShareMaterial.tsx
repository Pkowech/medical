import { useState } from 'react';

import materialService from '@/features/courses/services/materialService';

export default function ShareMaterial({
  materialId,
  userId: _userId,
}: {
  materialId: string;
  userId: string;
}) {
  const [sharedWithUserId, setSharedWithUserId] = useState('');

  const handleShare = async () => {
    try {
      await materialService.shareMaterial(materialId, [sharedWithUserId]);
      alert('Material shared!');
      setSharedWithUserId('');
    } catch (error) {
      console.error('Share failed:', error);
      alert('Failed to share material');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">Share Material</h2>
      <input
        value={sharedWithUserId}
        onChange={e => setSharedWithUserId(e.target.value)}
        placeholder="User ID to share with"
        className="w-full p-2 border rounded mb-4"
      />
      <button
        onClick={handleShare}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Share
      </button>
    </div>
  );
}
