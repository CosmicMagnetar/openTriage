/**
 * LoadingSpinner - A minimal, GitHub-style loading indicator
 * 
 * Props:
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - text: Optional loading text to display
 * - className: Additional CSS classes
 */
const LoadingSpinner = ({ size = 'md', text, className = '' }) => {
    const sizes = {
        sm: { container: 'gap-2', dots: 'w-1.5 h-1.5', text: 'text-xs' },
        md: { container: 'gap-3', dots: 'w-2 h-2', text: 'text-sm' },
        lg: { container: 'gap-4', dots: 'w-2.5 h-2.5', text: 'text-base' }
    };

    const s = sizes[size];

    return (
        <div className={`flex flex-col items-center justify-center ${s.container} ${className}`}>
            {/* Pulsing dots */}
            <div className="flex items-center gap-1.5">
                <span
                    className={`${s.dots} bg-[hsl(142,70%,55%)] rounded-full animate-pulse`}
                    style={{ animationDelay: '0ms' }}
                />
                <span
                    className={`${s.dots} bg-[hsl(142,70%,55%)] rounded-full animate-pulse`}
                    style={{ animationDelay: '150ms' }}
                />
                <span
                    className={`${s.dots} bg-[hsl(142,70%,55%)] rounded-full animate-pulse`}
                    style={{ animationDelay: '300ms' }}
                />
            </div>

            {/* Optional text */}
            {text && (
                <p className={`text-[hsl(210,11%,50%)] ${s.text}`}>
                    {text}
                </p>
            )}
        </div>
    );
};

/**
 * PageLoader - Full page/container loading state
 */
export const PageLoader = ({ text = 'Loading...' }) => (
    <div className="w-full h-full flex items-center justify-center min-h-[200px]">
        <LoadingSpinner size="lg" text={text} />
    </div>
);

/**
 * InlineLoader - Small inline loading indicator
 */
export const InlineLoader = ({ className = '' }) => (
    <LoadingSpinner size="sm" className={className} />
);

export default LoadingSpinner;
