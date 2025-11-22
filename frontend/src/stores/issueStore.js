import { create } from 'zustand';

const useIssueStore = create((set) => ({
  selectedIssue: null,
  setSelectedIssue: (issue) => set({ selectedIssue: issue }),
  clearSelectedIssue: () => set({ selectedIssue: null })
}));

export default useIssueStore;