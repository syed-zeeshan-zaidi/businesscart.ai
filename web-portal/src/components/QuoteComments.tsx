import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { patchQuote } from '../api';
import { Quote, Comment } from '../types';

interface QuoteCommentsProps {
  quote: Quote;
  onCommentAdded: (updatedQuote: Quote) => void;
}

const QuoteComments: React.FC<QuoteCommentsProps> = ({ quote, onCommentAdded }) => {
  const { decodeJWT } = useAuth();
  const [newComment, setNewComment] = useState('');

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const updatedQuote = await patchQuote(quote.id, 'addComment', { text: newComment });
      onCommentAdded(updatedQuote);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const renderComment = (comment: Comment) => {
    const token = localStorage.getItem('accessToken');
    const decodedUser = token ? decodeJWT(token) : null;
    const isCurrentUser = decodedUser && decodedUser.id === comment.accountId;

    return (
      <div key={comment.id} className={`flex my-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`rounded-lg px-4 py-2 max-w-sm ${isCurrentUser ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
          <p className="text-sm">{comment.text}</p>
          <p className={`text-xs mt-1 ${isCurrentUser ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(comment.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Comments</h3>
      <div className="mb-4 border rounded-lg p-4 bg-white">
        {quote.comments && quote.comments.length > 0 ? (
          quote.comments.map(renderComment)
        ) : (
          <p className="text-sm text-gray-500">No comments yet.</p>
        )}
      </div>
      <div className="flex">
        <textarea
          className="flex-grow border rounded-l-md p-2"
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type your comment..."
        />
        <button
          className="bg-gray-500 text-white px-4 py-2 rounded-r-md hover:bg-gray-600"
          onClick={handleAddComment}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default QuoteComments;
