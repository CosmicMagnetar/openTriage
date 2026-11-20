/**
 * The mark: three pills on a 24-unit grid. The middle one is cut in two,
 * a head and a body, so it reads as a person standing among the work:
 * "someone's on it". No letters, so it survives a rename.
 *
 * Sides use currentColor (muted); the person uses the accent.
 * `animated` plays the reveal: pills rise, then the middle one splits and
 * its top pops up as the head. Off under prefers-reduced-motion.
 */
const SIZES = { sm: 20, md: 28, lg: 56 };
const ACCENT = '#3fb950';

const css = `
.ot-logo .p{transform-box:fill-box;transform-origin:50% 100%}
.ot-logo.anim .p{animation:ot-rise .5s cubic-bezier(.2,.8,.2,1) both}
.ot-logo.anim .p2{animation-delay:.08s}.ot-logo.anim .p3{animation-delay:.16s}
.ot-logo.anim .head{animation:ot-cut .45s cubic-bezier(.3,1.6,.5,1) .55s both}
@keyframes ot-rise{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}
@keyframes ot-cut{from{transform:translateY(5px)}to{transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){.ot-logo.anim .p,.ot-logo.anim .head{animation:none}}
`;

const Logo = ({ size = 'md', animated = false, className = '', title }) => {
    const px = typeof size === 'number' ? size : SIZES[size] ?? SIZES.md;
    return (
        <svg
            width={px}
            height={px}
            viewBox="0 0 24 24"
            className={`ot-logo shrink-0 ${animated ? 'anim' : ''} ${className}`}
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <style>{css}</style>
            <rect className="p p1" x="2.5" y="5" width="5" height="15" rx="2.5" fill="currentColor" opacity="0.45" />
            <g className="p p2" fill={ACCENT}>
                <rect x="9.5" y="12.5" width="5" height="7.5" rx="2.5" />
                <circle className="head" cx="12" cy="7.5" r="2.5" />
            </g>
            <rect className="p p3" x="16.5" y="5" width="5" height="15" rx="2.5" fill="currentColor" opacity="0.45" />
        </svg>
    );
};

export default Logo;
