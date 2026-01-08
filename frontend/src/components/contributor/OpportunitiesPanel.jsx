import { ExternalLink, Calendar, Award, Users, GraduationCap, Code, Laptop, Rocket, Palette, Lightbulb, TrendingUp, X } from 'lucide-react';

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
    emerald: 'border-[hsl(142,70%,45%,0.3)] bg-[hsl(142,70%,45%,0.1)] hover:border-[hsl(142,70%,45%,0.5)]',
    blue: 'border-blue-500/30 bg-blue-500/10 hover:border-blue-500/50',
    purple: 'border-purple-500/30 bg-purple-500/10 hover:border-purple-500/50',
    yellow: 'border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-500/50',
    slate: 'border-[hsl(220,13%,25%)] bg-[hsl(220,13%,12%)] hover:border-[hsl(220,13%,35%)]'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[hsl(220,13%,5%)] rounded-xl border border-[hsl(220,13%,14%)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-[hsl(210,11%,60%)] hover:text-[hsl(210,11%,90%)] hover:bg-[hsl(220,13%,10%)] rounded-lg transition-all z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-6 md:p-8 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-[hsl(210,11%,90%)] mb-2 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-[hsl(142,70%,55%)]" />
              Open Source Opportunities
            </h1>
            <p className="text-[hsl(210,11%,60%)]">
              Curated list of mentorship programs and internships for open source contributors
            </p>
          </div>

          {/* Content */}
          <div className="grid gap-6">
            {opportunities.map((opp, index) => {
              const IconComponent = opp.icon;
              return (
                <div
                  key={index}
                  className={`border rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] ${colorClasses[opp.color]}`}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-14 h-14 bg-[hsl(220,13%,10%)] rounded-xl flex items-center justify-center border border-[hsl(220,13%,18%)] flex-shrink-0">
                      <IconComponent className="w-8 h-8 text-[hsl(210,11%,80%)]" />
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-[hsl(210,11%,90%)] mb-1">{opp.name}</h3>
                          <p className="text-sm text-[hsl(210,11%,60%)]">{opp.description}</p>
                        </div>
                        <a
                          href={opp.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[hsl(220,13%,12%)] hover:bg-[hsl(220,13%,16%)] text-[hsl(210,11%,80%)] px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border border-[hsl(220,13%,18%)] w-fit"
                        >
                          Visit Site
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 mb-4">
                        <div className="flex items-center gap-2 text-sm text-[hsl(210,11%,60%)]">
                          <Calendar className="w-4 h-4 text-[hsl(210,11%,40%)]" />
                          <span className="font-medium text-[hsl(210,11%,70%)]">Timeline:</span> {opp.timeline}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[hsl(210,11%,60%)]">
                          <Users className="w-4 h-4 text-[hsl(210,11%,40%)]" />
                          <span className="font-medium text-[hsl(210,11%,70%)]">Eligibility:</span> {opp.eligibility}
                        </div>
                      </div>

                      <div className="bg-[hsl(220,13%,7%,0.3)] rounded-lg p-3">
                        <p className="text-xs font-semibold text-[hsl(210,11%,50%)] mb-2 flex items-center gap-2 uppercase tracking-wide">
                          <Award className="w-3.5 h-3.5" />
                          Benefits
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                          {opp.benefits.map((benefit, i) => (
                            <li key={i} className="text-sm text-[hsl(210,11%,75%)] flex items-start gap-2">
                              <span className="text-[hsl(142,70%,55%)] mt-0.5">•</span>
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
          <div className="bg-[hsl(220,13%,8%)] border border-[hsl(220,13%,14%)] rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/10 p-3 rounded-lg flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-[hsl(210,11%,80%)] mb-1 font-medium">Pro Tip</p>
                <p className="text-sm text-[hsl(210,11%,60%)] mb-3 leading-relaxed">
                  Start contributing to projects in these organizations before the application period begins.
                  Consistent contributions significantly increase your chances of being selected for mentorship programs.
                </p>
                <p className="text-xs text-[hsl(210,11%,40%)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142,70%,55%)]"></span>
                  Use the AI Assistant to get personalized advice on which programs suit you best!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunitiesPanel;