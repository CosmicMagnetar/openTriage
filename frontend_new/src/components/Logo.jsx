const Logo = ({ size = 'md' }) => {
    const sizes = {
        sm: { container: 'gap-1.5', bars: ['w-4 h-3', 'w-4 h-6', 'w-4 h-9'] },
        md: { container: 'gap-2', bars: ['w-6 h-5', 'w-6 h-8', 'w-6 h-12'] },
        lg: { container: 'gap-3', bars: ['w-10 h-8', 'w-10 h-16', 'w-10 h-24'] }
    };

    const { container, bars } = sizes[size] || sizes.md;

    return (
        <div className={`flex ${container} items-end`}>
            <div className={`${bars[0]} bg-red-500 rounded`} />
            <div className={`${bars[1]} bg-blue-500 rounded`} />
            <div className={`${bars[2]} bg-emerald-500 rounded`} />
        </div>
    );
};

export default Logo;
