import Logo from '../Logo';

const LoadingScreen = ({ message = 'Loading...' }) => {
    return (
        <div className="fixed inset-0 bg-[hsl(220,13%,5%)] flex flex-col items-center justify-center z-[100]">
            {/* Logo with pulse animation */}
            <div className="mb-6 animate-pulse">
                <Logo size="lg" />
            </div>

            {/* Loading bar */}
            <div className="w-48 h-1 bg-[hsl(220,13%,12%)] rounded-full overflow-hidden">
                <div className="h-full bg-[hsl(142,70%,45%)] rounded-full animate-loading-bar" />
            </div>

            {/* Message */}
            <p className="mt-4 text-sm text-[hsl(210,11%,50%)]">{message}</p>
        </div>
    );
};

export default LoadingScreen;
