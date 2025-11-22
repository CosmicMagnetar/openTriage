import { X, ExternalLink, Calendar, Award, Users, GraduationCap, Code, Laptop, Rocket, Palette, Lightbulb } from 'lucide-react';

const OpportunitiesPanel = ({ onClose }) => {
  const opportunities = [
    {
      name: 'Google Summer of Code (GSoC)',
      description: 'Work with open source organizations on 3-month programming projects during summer.',
      website: 'https://summerofcode.withgoogle.com',
      timeline: 'March - September (Annual)',
      benefits: ['Stipend: $1,500 - $6,600', 'Mentorship from experts', 'Certificate', 'Community recognition'],
      eligibility: 'University students (18+) and recent graduates',
      icon: GraduationCap,
      color: 'emerald'
    },
    {
      name: 'LFX Mentorship (Linux Foundation)',
      description: 'Full or part-time mentorship programs with Linux Foundation projects.',
      website: 'https://lfx.linuxfoundation.org/tools/mentorship',
      timeline: 'Year-round (Multiple terms)',
      benefits: ['Stipend: $3,000 - $6,600', 'Direct mentorship', 'Resume building', 'Networking'],
      eligibility: 'Open to all (students & professionals)',
      icon: Code,
      color: 'blue'
    },
    {
      name: 'Outreachy',
      description: 'Paid internships for underrepresented groups in tech to work on open source.',
      website: 'https://www.outreachy.org',
      timeline: 'May - August, December - March',
      benefits: ['Stipend: $7,000', '3-month internship', 'Mentorship', 'Community support'],
      eligibility: 'Underrepresented groups in tech',
      icon: Users,
      color: 'purple'
    },
    {
      name: 'MLH Fellowship',
      description: 'Remote internship program where participants contribute to Open Source projects.',
      website: 'https://fellowship.mlh.io',
      timeline: 'Year-round (12-week programs)',
      benefits: ['Stipend provided', 'Professional experience', 'Weekly workshops', 'Career support'],
      eligibility: 'University students worldwide',
      icon: Laptop,
      color: 'yellow'
    },
    {
      name: 'GitHub Campus Experts',
      description: 'Build communities of learners at your school with GitHub support.',
      website: 'https://education.github.com/experts',
      timeline: 'Rolling applications',
      benefits: ['GitHub swag', 'Training resources', 'Community access', 'Event support'],
      eligibility: 'University students',
      icon: Rocket,
      color: 'slate'
    },
    {
      name: 'Season of KDE',
      description: 'Mentorship program by KDE community for students and newcomers.',
      website: 'https://season.kde.org',
      timeline: 'December - March (Annual)',
      benefits: ['Mentorship', 'Certificate', 'Swag', 'Community recognition'],
      eligibility: 'Everyone (focus on newcomers)',
      icon: Palette,
      color: 'blue'
    }
  ];

  const colorClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    slate: 'border-slate-500/30 bg-slate-500/10'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-200 mb-2">Open Source Opportunities</h2>
            <p className="text-slate-400">Programs to kickstart your open source journey</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {opportunities.map((opp, index) => {
            const IconComponent = opp.icon;
            return (
              <div
                key={index}
                className={`border rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] ${colorClasses[opp.color]}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-7 h-7 text-slate-200" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-200 mb-2">{opp.name}</h3>
                        <p className="text-sm text-slate-400">{opp.description}</p>
                      </div>
                      <a
                        href={opp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 whitespace-nowrap"
                      >
                        Visit Site
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>{opp.timeline}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{opp.eligibility}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Benefits:
                      </p>
                      <ul className="grid grid-cols-2 gap-2">
                        {opp.benefits.map((benefit, i) => (
                          <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <strong className="text-blue-400">Pro Tip:</strong> Start contributing to projects you're interested in now! Having prior contributions significantly increases your chances of acceptance.
            </p>
            <p className="text-xs text-slate-400">
              Use the AI Assistant to get personalized advice on which programs suit you best!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunitiesPanel;