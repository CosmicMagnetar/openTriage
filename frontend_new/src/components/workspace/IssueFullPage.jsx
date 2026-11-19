/** Full-page view of an issue (shareable link); same content as the panel. */
import { useNavigate, useParams } from 'react-router-dom';
import { IssueDetail } from './ItemPanel';

export default function IssueFullPage() {
  const { owner, repo, number } = useParams();
  const navigate = useNavigate();
  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto border-x border-[var(--line-soft)] bg-[var(--panel)]">
      <IssueDetail owner={owner} repo={repo} number={Number(number)} standalone onClose={() => navigate(-1)} />
    </div>
  );
}
