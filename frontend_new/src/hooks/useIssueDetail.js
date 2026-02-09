import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * Custom hook to fetch all issue/PR detail data independently from URL params.
 * Replaces the parent-dashboard-state pattern used by the old modal.
 */
const useIssueDetail = (issueId) => {
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchIssue = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API}/maintainer/issues/${issueId}`);
      setIssue(response.data);
    } catch (err) {
      console.error("Failed to fetch issue:", err);
      setError(err.response?.data?.detail || "Failed to load issue details");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  const fetchComments = useCallback(async () => {
    if (!issueId) return;
    setCommentsLoading(true);
    try {
      const response = await axios.get(
        `${API}/maintainer/issues/${issueId}/comments`,
      );
      setComments(response.data.comments || []);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssue();
    fetchComments();
  }, [fetchIssue, fetchComments]);

  return {
    issue,
    comments,
    loading,
    commentsLoading,
    error,
    refetchIssue: fetchIssue,
    refetchComments: fetchComments,
  };
};

export default useIssueDetail;
