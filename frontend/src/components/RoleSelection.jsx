import { UserCircle, Users } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const RoleSelection = ({ user, onRoleSelected }) => {
  const [selecting, setSelecting] = useState(false);

  const selectRole = async (role) => {
    setSelecting(true);
    try {
      await axios.post(`${API}/user/select-role`, { role });
      toast.success(`You are now a ${role.toLowerCase()}!`);
      onRoleSelected();
    } catch (error) {
      toast.error('Failed to set role');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl p-8 w-full max-w-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-200 mb-2">Welcome to OpenTriage!</h1>
          <p className="text-slate-400">Choose your role to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Maintainer */}
          <button
            data-testid="select-maintainer"
            onClick={() => selectRole('MAINTAINER')}
            disabled={selecting}
            className="bg-slate-800 border-2 border-slate-700 hover:border-blue-500 rounded-xl p-8 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center border-2 border-blue-500/30">
                <Users className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-200 mb-2">Maintainer</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Manage and triage issues across your repositories with AI-powered insights
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 text-left w-full">
                <li>✓ Add multiple repositories</li>
                <li>✓ AI-powered issue classification</li>
                <li>✓ Advanced analytics & metrics</li>
                <li>✓ Response templates</li>
              </ul>
            </div>
          </button>

          {/* Contributor */}
          <button
            data-testid="select-contributor"
            onClick={() => selectRole('CONTRIBUTOR')}
            disabled={selecting}
            className="bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 rounded-xl p-8 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-2 border-emerald-500/30">
                <UserCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-200 mb-2">Contributor</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Track your issues and contributions across projects
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 text-left w-full">
                <li>✓ Track your submitted issues</li>
                <li>✓ See AI triage status</li>
                <li>✓ Plain English updates</li>
                <li>✓ Pull request tracking</li>
              </ul>
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          You can change your role later in settings
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;