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
  <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-lg p-6 shadow-sm border border-border dark:border-border/50 mt-6">
    <h3 className="text-lg font-semibold text-foreground dark:text-foreground mb-4">Discussion</h3>

    <div className="space-y-4">
      {discussions.map(discussion => (
        <div key={discussion.id} className="p-4 bg-background/50 dark:bg-card/30 border border-border dark:border-border/50 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center border border-blue-500/20">
              <span className="text-sm font-bold uppercase">{discussion.user.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-semibold text-foreground dark:text-foreground">{discussion.user}</span>
                <span className="text-xs text-muted-foreground dark:text-muted-foreground">{discussion.time}</span>
              </div>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-2 leading-relaxed">{discussion.message}</p>
              <button className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1" title="View replies">
                <MessageSquare className="w-3 h-3" />
                {discussion.replies} replies
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-4 pt-4 border-t border-border dark:border-border/50">
      <textarea
        placeholder="Join the discussion..."
        className="w-full h-24 p-3 bg-card dark:bg-card border border-border dark:border-border text-foreground dark:text-foreground rounded-lg resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
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
