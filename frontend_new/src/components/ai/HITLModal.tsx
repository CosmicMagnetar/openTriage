/**
 * HITLModal.tsx
 *
 * Human-in-the-Loop Guidance Modal
 *
 * Triggered when the agent gets stuck and requests human guidance.
 * Opens a modal with:
 * - Agent's question
 * - Optional predefined choices
 * - Text input area for custom reply
 * - Send button that emits human_reply via Socket.IO
 *
 * The backend agent is waiting on a Promise that will be resolved
 * when the human sends their reply.
 */

import React, { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { getIO } from "@/lib/socket-client";

interface HITLModalProps {
  isOpen: boolean;
  sessionId: string;
  thoughtId: number;
  question: string;
  options?: string[];
  onClose: () => void;
}

export const HITLModal: React.FC<HITLModalProps> = ({
  isOpen,
  sessionId,
  thoughtId,
  question,
  options = [],
  onClose,
}) => {
  const [reply, setReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReply("");
      setSelectedOption(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!reply.trim() && !selectedOption) {
      alert("Please provide a response");
      return;
    }

    setIsSubmitting(true);

    try {
      const socket = getIO();
      if (!socket) {
        throw new Error("Socket.IO not available");
      }

      const finalReply = selectedOption || reply;

      // Emit human_reply event to the backend
      socket.emit("human_reply", {
        sessionId,
        reply: finalReply,
      });

      console.log(`[HITL] Sent reply for thought ${thoughtId}:`, finalReply);

      // Close modal after short delay
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error("[HITL] Error sending reply:", error);
      alert("Failed to send reply. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    setReply(""); // Clear text input if option selected
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] bg-white rounded-lg shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <h2 className="text-lg font-semibold text-gray-900">
            Agent Requires Guidance
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Agent's Question */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Agent's Question:</p>
            <p className="text-base font-semibold text-gray-900">{question}</p>
          </div>

          {/* Predefined Options */}
          {options.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                Suggested Responses:
              </p>
              <div className="space-y-2">
                {options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(option)}
                    disabled={isSubmitting}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors disabled:opacity-50 ${
                      selectedOption === option
                        ? "bg-indigo-100 border-indigo-400 text-indigo-900"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="option"
                        checked={selectedOption === option}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      {option}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Reply Divider */}
          {options.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or write your own response
                </span>
              </div>
            </div>
          )}

          {/* Custom Text Response */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Your Response:
            </label>
            <textarea
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                setSelectedOption(null); // Clear option if typing
              }}
              disabled={
                isSubmitting || (options.length > 0 && !!selectedOption)
              }
              placeholder={
                options.length > 0
                  ? "Or provide a custom response..."
                  : "Type your response here..."
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 resize-none"
              rows={4}
            />
          </div>

          {/* Status */}
          {isSubmitting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <p className="text-sm text-blue-700">
                Sending response to agent...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!reply.trim() && !selectedOption)}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Response
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default HITLModal;
