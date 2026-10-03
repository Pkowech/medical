import { useState } from 'react';

import materialService from '@/features/courses/services/materialService';
import { toast } from 'sonner';

export default function ShareMaterial({
  materialId,
  userId: _userId,
}: {
  materialId: string;
  userId: string;
}) {
  const [sharedWithUserId, setSharedWithUserId] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!sharedWithUserId.trim()) {
      toast.error('Enter the user ID to share this material with.');
      return;
    }

    setIsSharing(true);
    try {
      await materialService.shareMaterial(materialId, [sharedWithUserId]);
      toast.success('Material shared.');
      setSharedWithUserId('');
    } catch (error) {
      console.error('Share failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to share material.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">Share Material</h2>
      <input
        value={sharedWithUserId}
        onChange={e => setSharedWithUserId(e.target.value)}
        placeholder="User ID"
        aria-label="User ID to share with"
        className="w-full p-2 border rounded mb-4"
      />
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={isSharing || !sharedWithUserId.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {isSharing ? 'Sharing…' : 'Share'}
      </button>
    </div>
  );
}
