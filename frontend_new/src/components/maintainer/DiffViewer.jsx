import { useState, useMemo } from 'react';
import { FileCode, Plus, Minus, ChevronDown, ChevronRight, File } from 'lucide-react';

/**
 * DiffViewer - Split-view diff viewer component for PR code review
 * Parses unified diff format and renders in a GitHub-style split view
 */

// Parse a unified diff string into structured data
const parseDiff = (diffText) => {
    if (!diffText) return [];
    
    const files = [];
    const fileChunks = diffText.split(/^diff --git/m).filter(Boolean);
    
    for (const chunk of fileChunks) {
        const lines = chunk.split('\n');
        const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
        
        if (!headerMatch) continue;
        
        const fileName = headerMatch[2];
        const hunks = [];
        let currentHunk = null;
        let stats = { additions: 0, deletions: 0 };
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            
            // Hunk header
            if (line.startsWith('@@')) {
                if (currentHunk) hunks.push(currentHunk);
                
                const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/);
                currentHunk = {
                    header: line,
                    oldStart: parseInt(match?.[1] || '1'),
                    newStart: parseInt(match?.[2] || '1'),
                    context: match?.[3]?.trim() || '',
                    lines: []
                };
            } else if (currentHunk && !line.startsWith('\\')) {
                // Skip file mode lines and similar
                if (line.startsWith('index ') || 
                    line.startsWith('---') || 
                    line.startsWith('+++') ||
                    line.startsWith('new file') ||
                    line.startsWith('deleted file') ||
                    line.startsWith('similarity index') ||
                    line.startsWith('rename from') ||
                    line.startsWith('rename to')) {
                    continue;
                }
                
                let type = 'context';
                if (line.startsWith('+')) {
                    type = 'addition';
                    stats.additions++;
                } else if (line.startsWith('-')) {
                    type = 'deletion';
                    stats.deletions++;
                }
                
                currentHunk.lines.push({
                    type,
                    content: line.substring(1) || ' ',
                    raw: line
                });
            }
        }
        
        if (currentHunk) hunks.push(currentHunk);
        
        if (hunks.length > 0) {
            files.push({
                fileName,
                hunks,
                stats
            });
        }
    }
    
    return files;
};

// Single file diff component
const FileDiff = ({ file, defaultExpanded = true }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    
    // Build split view lines
    const splitLines = useMemo(() => {
        const result = [];
        
        for (const hunk of file.hunks) {
            // Add hunk header
            result.push({
                type: 'hunk-header',
                header: hunk.header,
                context: hunk.context
            });
            
            let oldLineNum = hunk.oldStart;
            let newLineNum = hunk.newStart;
            let i = 0;
            
            while (i < hunk.lines.length) {
                const line = hunk.lines[i];
                
                if (line.type === 'context') {
                    result.push({
                        type: 'context',
                        oldLineNum: oldLineNum++,
                        newLineNum: newLineNum++,
                        content: line.content
                    });
                    i++;
                } else if (line.type === 'deletion') {
                    // Check if next line is an addition (inline change)
                    const nextLine = hunk.lines[i + 1];
                    if (nextLine?.type === 'addition') {
                        result.push({
                            type: 'change',
                            oldLineNum: oldLineNum++,
                            newLineNum: newLineNum++,
                            oldContent: line.content,
                            newContent: nextLine.content
                        });
                        i += 2;
                    } else {
                        result.push({
                            type: 'deletion',
                            oldLineNum: oldLineNum++,
                            content: line.content
                        });
                        i++;
                    }
                } else if (line.type === 'addition') {
                    result.push({
                        type: 'addition',
                        newLineNum: newLineNum++,
                        content: line.content
                    });
                    i++;
                } else {
                    i++;
                }
            }
        }
        
        return result;
    }, [file.hunks]);
    
    return (
        <div className="border border-[hsl(220,13%,15%)] rounded-lg overflow-hidden mb-4">
            {/* File header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-4 py-2 bg-[hsl(220,13%,10%)] hover:bg-[hsl(220,13%,12%)] transition-colors"
            >
                {expanded ? (
                    <ChevronDown className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-[hsl(210,11%,50%)]" />
                )}
                <File className="w-4 h-4 text-[hsl(210,11%,60%)]" />
                <span className="text-sm font-mono text-[hsl(210,11%,80%)] flex-1 text-left truncate">
                    {file.fileName}
                </span>
                <span className="flex items-center gap-2 text-xs">
                    {file.stats.additions > 0 && (
                        <span className="text-[hsl(142,70%,55%)] flex items-center gap-0.5">
                            <Plus className="w-3 h-3" />
                            {file.stats.additions}
                        </span>
                    )}
                    {file.stats.deletions > 0 && (
                        <span className="text-red-400 flex items-center gap-0.5">
                            <Minus className="w-3 h-3" />
                            {file.stats.deletions}
                        </span>
                    )}
                </span>
            </button>
            
            {/* Diff content */}
            {expanded && (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                        <tbody>
                            {splitLines.map((line, idx) => {
                                if (line.type === 'hunk-header') {
                                    return (
                                        <tr key={idx} className="bg-[hsl(217,91%,60%,0.1)]">
                                            <td colSpan={4} className="px-4 py-1 text-[hsl(217,91%,65%)] text-xs">
                                                {line.header}
                                                {line.context && (
                                                    <span className="ml-2 text-[hsl(210,11%,50%)]">{line.context}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                if (line.type === 'context') {
                                    return (
                                        <tr key={idx} className="hover:bg-[hsl(220,13%,10%)]">
                                            <td className="w-12 px-2 py-0.5 text-right text-[hsl(210,11%,40%)] bg-[hsl(220,13%,8%)] select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.oldLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-[hsl(210,11%,70%)] whitespace-pre border-r border-[hsl(220,13%,15%)]">
                                                {line.content}
                                            </td>
                                            <td className="w-12 px-2 py-0.5 text-right text-[hsl(210,11%,40%)] bg-[hsl(220,13%,8%)] select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.newLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-[hsl(210,11%,70%)] whitespace-pre">
                                                {line.content}
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                if (line.type === 'deletion') {
                                    return (
                                        <tr key={idx} className="bg-red-500/10">
                                            <td className="w-12 px-2 py-0.5 text-right text-red-400/70 bg-red-500/15 select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.oldLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-red-300 whitespace-pre border-r border-[hsl(220,13%,15%)]">
                                                <span className="text-red-400 mr-1">-</span>
                                                {line.content}
                                            </td>
                                            <td className="w-12 px-2 py-0.5 bg-[hsl(220,13%,8%)] border-r border-[hsl(220,13%,15%)]"></td>
                                            <td className="w-1/2 px-3 py-0.5"></td>
                                        </tr>
                                    );
                                }
                                
                                if (line.type === 'addition') {
                                    return (
                                        <tr key={idx} className="bg-[hsl(142,70%,45%,0.1)]">
                                            <td className="w-12 px-2 py-0.5 bg-[hsl(220,13%,8%)] border-r border-[hsl(220,13%,15%)]"></td>
                                            <td className="w-1/2 px-3 py-0.5 border-r border-[hsl(220,13%,15%)]"></td>
                                            <td className="w-12 px-2 py-0.5 text-right text-[hsl(142,70%,55%,0.7)] bg-[hsl(142,70%,45%,0.15)] select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.newLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-[hsl(142,70%,70%)] whitespace-pre">
                                                <span className="text-[hsl(142,70%,55%)] mr-1">+</span>
                                                {line.content}
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                if (line.type === 'change') {
                                    return (
                                        <tr key={idx}>
                                            <td className="w-12 px-2 py-0.5 text-right text-red-400/70 bg-red-500/15 select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.oldLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-red-300 whitespace-pre bg-red-500/10 border-r border-[hsl(220,13%,15%)]">
                                                <span className="text-red-400 mr-1">-</span>
                                                {line.oldContent}
                                            </td>
                                            <td className="w-12 px-2 py-0.5 text-right text-[hsl(142,70%,55%,0.7)] bg-[hsl(142,70%,45%,0.15)] select-none border-r border-[hsl(220,13%,15%)]">
                                                {line.newLineNum}
                                            </td>
                                            <td className="w-1/2 px-3 py-0.5 text-[hsl(142,70%,70%)] whitespace-pre bg-[hsl(142,70%,45%,0.1)]">
                                                <span className="text-[hsl(142,70%,55%)] mr-1">+</span>
                                                {line.newContent}
                                            </td>
                                        </tr>
                                    );
                                }
                                
                                return null;
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Main DiffViewer component
const DiffViewer = ({ diff, loading = false }) => {
    const files = useMemo(() => parseDiff(diff), [diff]);
    
    const totalStats = useMemo(() => {
        return files.reduce(
            (acc, file) => ({
                additions: acc.additions + file.stats.additions,
                deletions: acc.deletions + file.stats.deletions,
                files: acc.files + 1
            }),
            { additions: 0, deletions: 0, files: 0 }
        );
    }, [files]);
    
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-[hsl(210,11%,50%)]">
                    <FileCode className="w-5 h-5 animate-pulse" />
                    <span>Loading diff...</span>
                </div>
            </div>
        );
    }
    
    if (!diff || files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-[hsl(210,11%,45%)]">
                <FileCode className="w-10 h-10 mb-3 opacity-50" />
                <p>No changes to display</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 px-4 py-2 bg-[hsl(220,13%,8%)] rounded-lg border border-[hsl(220,13%,15%)]">
                <span className="text-sm text-[hsl(210,11%,60%)]">
                    Showing <span className="text-[hsl(210,11%,90%)] font-medium">{totalStats.files}</span> changed file{totalStats.files !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1 text-sm text-[hsl(142,70%,55%)]">
                    <Plus className="w-3.5 h-3.5" />
                    {totalStats.additions}
                </span>
                <span className="flex items-center gap-1 text-sm text-red-400">
                    <Minus className="w-3.5 h-3.5" />
                    {totalStats.deletions}
                </span>
            </div>
            
            {/* File diffs */}
            {files.map((file, idx) => (
                <FileDiff key={file.fileName + idx} file={file} defaultExpanded={idx < 5} />
            ))}
        </div>
    );
};

export default DiffViewer;
