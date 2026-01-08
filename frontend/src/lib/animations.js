/**
 * Industrial Tech Animation Presets
 * Framer Motion configurations for bouncy, alive interactions
 */

// Primary action button spring animation
export const springButton = {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { 
        type: "spring", 
        stiffness: 400, 
        damping: 17 
    }
};

// Subtle hover for secondary actions
export const hoverLift = {
    whileHover: { y: -2 },
    transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
    }
};

// Entry animation for cards/panels
export const slideIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 25 
    }
};

// Stagger children animation
export const staggerContainer = {
    animate: {
        transition: {
            staggerChildren: 0.05
        }
    }
};

export const staggerItem = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
    }
};

// Pulse animation for active states
export const pulse = {
    animate: {
        scale: [1, 1.02, 1],
        transition: {
            repeat: Infinity,
            duration: 2
        }
    }
};

// Terminal cursor blink
export const cursorBlink = {
    animate: {
        opacity: [1, 0],
        transition: {
            repeat: Infinity,
            duration: 0.8,
            ease: "steps(1)"
        }
    }
};

// Command center focus glow
export const commandGlow = {
    whileFocus: {
        boxShadow: "0 0 30px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(59, 130, 246, 1)"
    },
    transition: { duration: 0.2 }
};
