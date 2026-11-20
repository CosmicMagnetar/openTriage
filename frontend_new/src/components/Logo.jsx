/**
 * The mark: "the next step". Three rising pills on a 24-unit grid; the top
 * one is cut into a head and a body, so the last step is a person: you,
 * taking the next step. Comes from the tagline ("one clear next step a
 * day") and keeps the rising bars of the old logo. No letters, so it
 * survives a rename.
 *
 * Steps use currentColor (muted); the person uses the accent.
 * `animated` plays the reveal: steps rise one after another, then the last
 * one splits and its top pops up as the head. Off under reduced motion.
 */
const SIZES = { sm: 20, md: 28, lg: 56 };
const ACCENT = '#3fb950';

const css = `
.ot-logo .p{transform-box:fill-box;transform-origin:50% 100%}
.ot-logo.anim .p{animation:ot-rise .45s cubic-bezier(.2,.8,.2,1) both}
.ot-logo.anim .p2{animation-delay:.1s}.ot-logo.anim .p3{animation-delay:.2s}
.ot-logo.anim .head{animation:ot-cut .45s cubic-bezier(.3,1.6,.5,1) .6s both}
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
            <rect className="p p1" x="2.5" y="14" width="5" height="6" rx="2.5" fill="currentColor" opacity="0.45" />
            <rect className="p p2" x="9.5" y="10" width="5" height="10" rx="2.5" fill="currentColor" opacity="0.45" />
            <g className="p p3" fill={ACCENT}>
                <rect x="16.5" y="11.5" width="5" height="8.5" rx="2.5" />
                <circle className="head" cx="19" cy="6.5" r="2.5" />
            </g>
        </svg>
    );
};

export default Logo;
