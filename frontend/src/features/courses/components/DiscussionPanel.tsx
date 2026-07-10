import React from 'react';
import { MessageSquare } from 'lucide-react';

interface Discussion {
  id: number;
  user: string;
  time: string;
  message: string;
  replies: number;
}

interface DiscussionPanelProps {
  discussions: Discussion[];
}

export const DiscussionPanel = ({ discussions }: DiscussionPanelProps) => (
  <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 shadow-sm border border-gray-200 dark:border-slate-700/50 mt-6">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Discussion</h3>

    <div className="space-y-4">
      {discussions.map(discussion => (
        <div key={discussion.id} className="p-4 bg-gray-50/50 dark:bg-slate-900/30 border border-gray-100 dark:border-slate-700/50 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center border border-blue-500/20">
              <span className="text-sm font-bold uppercase">{discussion.user.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white">{discussion.user}</span>
                <span className="text-xs text-gray-500 dark:text-slate-500">{discussion.time}</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300 mb-2 leading-relaxed">{discussion.message}</p>
              <button className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1" title="View replies">
                <MessageSquare className="w-3 h-3" />
                {discussion.replies} replies
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700/50">
      <textarea
        placeholder="Join the discussion..."
        className="w-full h-24 p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600"
      />
      <div className="flex justify-end mt-2">
        <button
          className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          title="Post Comment"
        >
          Post Comment
        </button>
      </div>
    </div>
  </div>
);
