import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import axios from "axios";
import { cn } from "@/lib/utils";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

/**
 * AISuggestTextarea - A textarea with inline AI suggestions (Copilot-style)
 * 
 * Features:
 * - AI suggestion appears in a floating box below the cursor
 * - Press TAB to accept suggestion
 * - Keep typing to dismiss suggestion
 * - Loading indicator during API call
 */
const AISuggestTextarea = React.forwardRef(({
    className,
    value,
    onChange,
    contextType = "general",
    placeholder,
    rows = 4,
    debounceMs = 500,
    disabled,
    ...props
}, ref) => {
    const [suggestion, setSuggestion] = useState("");
    const [loading, setLoading] = useState(false);
    const textareaRef = useRef(null);
    const debounceTimeoutRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Combine refs
    const combinedRef = (node) => {
        textareaRef.current = node;
        if (ref) {
            if (typeof ref === 'function') {
                ref(node);
            } else {
                ref.current = node;
            }
        }
    };

    // Fetch suggestion from API
    const fetchSuggestion = useCallback(async (text) => {
        if (!text || text.trim().length < 5) {
            setSuggestion("");
            return;
        }

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoading(true);
        try {
            const response = await axios.post(
                `${API}/suggest`,
                { text, contextType },
                { signal: abortControllerRef.current.signal }
            );

            if (response.data.suggestion) {
                setSuggestion(response.data.suggestion);
            } else {
                setSuggestion("");
            }
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error("Suggestion error:", error);
            }
            setSuggestion("");
        } finally {
            setLoading(false);
        }
    }, [contextType]);

    // Handle input change with debounce
    const handleChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Clear suggestion immediately when typing
        setSuggestion("");

        // Clear existing timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Set new debounce timeout
        debounceTimeoutRef.current = setTimeout(() => {
            fetchSuggestion(newValue);
        }, debounceMs);
    };

    // Handle key down events
    const handleKeyDown = (e) => {
        if (e.key === "Tab" && suggestion) {
            e.preventDefault();
            // Accept the suggestion
            const newValue = value + suggestion;
            onChange(newValue);
            setSuggestion("");

            // Move cursor to end
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = newValue.length;
                    textareaRef.current.selectionEnd = newValue.length;
                }
            }, 0);
        } else if (e.key === "Escape") {
            // Dismiss the suggestion
            setSuggestion("");
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return (
        <div className="relative w-full">
            {/* Main textarea */}
            <textarea
                ref={combinedRef}
                className={cn(
                    "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                    "resize-none",
                    className
                )}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={rows}
                disabled={disabled}
                {...props}
            />

            {/* Loading indicator */}
            {loading && (
                <div className="absolute right-3 top-3 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                </div>
            )}

            {/* AI Suggestion popup */}
            {suggestion && (
                <div className="absolute left-0 right-0 mt-1 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-lg p-3 shadow-xl">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-medium text-purple-400">AI Suggestion</span>
                            <div className="flex-1" />
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono border border-slate-600">TAB</kbd>
                                <span>to accept</span>
                                <span className="mx-1">·</span>
                                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] font-mono border border-slate-600">ESC</kbd>
                                <span>to dismiss</span>
                            </div>
                        </div>

                        {/* Preview: Current text + Suggestion */}
                        <div className="text-sm leading-relaxed">
                            <span className="text-slate-400">...{value.slice(-50)}</span>
                            <span className="text-emerald-400 font-medium">{suggestion}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

AISuggestTextarea.displayName = "AISuggestTextarea";

export { AISuggestTextarea };
