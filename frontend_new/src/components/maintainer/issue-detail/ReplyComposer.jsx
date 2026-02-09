import { useState } from 'react';
import { MessageSquare, GraduationCap, Send } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { AISuggestTextarea } from '../../ui/AISuggestTextarea';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Reply composer with regular and teaching modes.
 */
const ReplyComposer = ({ issue, comments, onReplySent }) => {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showTeaching, setShowTeaching] = useState(false);
  const [teachingMessage, setTeachingMessage] = useState('');

  useState(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get(`${API}/maintainer/templates`);
        setTemplates(response.data || []);
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };
    fetchTemplates();
  }, []);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const response = await axios.post(`${API}/issues/reply`, {
        issueId: issue.id,
        owner: issue.owner,
        repo: issue.repo,
        number: issue.number,
        message: reply,
      });

      if (response.data.commentUrl) {
        toast.success(
          <div>
            <p>Reply posted to GitHub!</p>
            <a
              href={response.data.commentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(217,91%,65%)] underline text-sm"
            >
              View on GitHub →
            </a>
          </div>
        );
      } else {
        toast.success('Reply posted successfully!');
      }

      setReply('');
      setSelectedTemplate('');
      onReplySent?.();
    } catch (error) {
      console.error('Reply error:', error);
      toast.error(error.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleSendTeaching = async () => {
    if (!teachingMessage.trim()) return;
    setSending(true);
    try {
      const teachingReply = `## 🎓 Learning Moment\n\n${teachingMessage}\n\n---\n*This is a teaching response to help you grow as a contributor!*`;
      await axios.post(`${API}/issues/reply`, {
        issueId: issue.id,
        owner: issue.owner,
        repo: issue.repo,
        number: issue.number,
        message: teachingReply,
      });
      toast.success('Teaching message sent!');
      setTeachingMessage('');
      setShowTeaching(false);
      onReplySent?.();
    } catch (error) {
      console.error('Error sending teaching message:', error);
      toast.error(error.response?.data?.detail || 'Failed to send teaching message');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) setReply(template.body);
    } else {
      setReply('');
    }
  };

  return (
    <div className="border-t border-[hsl(220,13%,14%)] bg-[hsl(220,13%,6%)] p-5">
      {/* Mode Toggle */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => { setShowTeaching(false); setTeachingMessage(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showTeaching
              ? 'bg-[hsl(217,91%,50%)] text-white'
              : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Reply
        </button>
        <button
          onClick={() => { setShowTeaching(true); setReply(''); setSelectedTemplate(''); }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showTeaching
              ? 'bg-[hsl(142,70%,45%)] text-black'
              : 'bg-[hsl(220,13%,10%)] text-[hsl(210,11%,60%)] hover:bg-[hsl(220,13%,12%)]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Teach
        </button>
      </div>

      {showTeaching ? (
        <>
          <div className="mb-3 p-3 bg-[hsl(142,70%,45%,0.08)] border border-[hsl(142,70%,45%,0.25)] rounded-lg">
            <p className="text-xs text-[hsl(142,70%,55%)] flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span><strong>Teaching Mode:</strong> Guide the contributor with knowledge and best practices.</span>
            </p>
          </div>
          <textarea
            value={teachingMessage}
            onChange={(e) => setTeachingMessage(e.target.value)}
            placeholder="Explain concepts, best practices, or provide learning resources..."
            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg p-3 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(142,70%,45%)] transition-colors resize-none"
            rows={3}
          />
          <button
            onClick={handleSendTeaching}
            disabled={!teachingMessage.trim() || sending}
            className="mt-3 w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {sending ? 'Sending...' : <><GraduationCap className="w-4 h-4" /> Send Teaching Message</>}
          </button>
        </>
      ) : (
        <>
          {templates.length > 0 && (
            <div className="mb-3">
              <select
                value={selectedTemplate}
                onChange={handleTemplateSelect}
                className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg px-3 py-2 text-sm text-[hsl(210,11%,80%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors"
              >
                <option value="">Select template (optional)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <AISuggestTextarea
            value={reply}
            onChange={setReply}
            placeholder="Type your reply..."
            contextType="issue_reply"
            conversationHistory={comments.map((c) => ({ sender: 'other', content: c.body }))}
            issueContext={{ title: issue.title, body: issue.body, repoName: issue.repoName }}
            className="w-full bg-[hsl(220,13%,10%)] border border-[hsl(220,13%,18%)] rounded-lg p-3 text-sm text-[hsl(210,11%,85%)] placeholder-[hsl(210,11%,35%)] focus:outline-none focus:border-[hsl(217,91%,60%)] transition-colors resize-none"
            rows={3}
          />
          <button
            onClick={handleReply}
            disabled={!reply.trim() || sending}
            className="mt-3 w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,50%)] disabled:bg-[hsl(220,13%,18%)] disabled:text-[hsl(210,11%,40%)] text-black px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {sending ? 'Sending...' : <><Send className="w-4 h-4" /> Send Reply</>}
          </button>
        </>
      )}
    </div>
  );
};

export default ReplyComposer;
