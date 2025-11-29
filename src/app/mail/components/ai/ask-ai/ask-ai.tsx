'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useRef } from 'react'
import { Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';
import { cn } from '@/lib/utils';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { EmailContextSelector, type EmailContext } from './email-context-selector';
import { FileAttachmentSelector, type FileAttachment } from './file-attachment-selector';
import { SourceCitations, type Source } from './source-citations';
import { WebSearchToggle } from './web-search-toggle';

const transitionDebug = {
    type: "tween" as const,
    ease: "easeOut" as const,
    duration: 0.2,
};

type AskAIProps = {
    onClose?: () => void;
};

const AskAI = ({ onClose }: AskAIProps) => {
    const [accountId] = useLocalStorage('accountId', '')
    const utils = api.useUtils()
    const [input, setInput] = useState('')
    const [selectedEmailContext, setSelectedEmailContext] = useState<EmailContext[]>([])
    const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([])
    const [webSearchEnabled, setWebSearchEnabled] = useState(false)
    const [messageSources, setMessageSources] = useState<Map<string, Source[]>>(new Map())
    const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set())
    const messageTimestamps = useRef<Map<string, number>>(new Map())
    
    const { sendMessage, messages, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: {
                accountId,
                emailContext: selectedEmailContext.length > 0 
                    ? { emailIds: selectedEmailContext.map(e => e.emailId) }
                    : undefined,
                fileContext: selectedFiles.filter(f => f.status === 'ready').length > 0
                    ? { fileIds: selectedFiles.filter(f => f.status === 'ready').map(f => f.id) }
                    : undefined,
                webSearch: webSearchEnabled,
            },
        }),
        onError: (error: Error) => {
            console.error('Chat error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            if (error.message.includes('Limit reached')) {
                toast.error('You have reached the limit for today. Please upgrade to pro to ask as many questions as you want')
            } else {
                toast.error(`Failed to send message: ${error.message}`);
            }
        },
        onFinish: async (options) => {
            console.log('Chat response received:', {
                message: options.message,
                finishReason: options.finishReason,
                isAbort: options.isAbort,
                isDisconnect: options.isDisconnect,
                isError: options.isError,
            });
            
            // Track timestamp for query correction detection
            if (options.message?.id) {
                messageTimestamps.current.set(options.message.id, Date.now());
            }
            
            // Extract sources from response if available
            if (options.message?.id && !options.isAbort && !options.isError) {
                let sourcesFromResponse: Source[] = [];
                
                // Try to extract sources from message content (appended as HTML comment)
                const messageContent = options.message.content || '';
                const sourcesMatch = messageContent.match(/<!--SOURCES_START:(.+?):SOURCES_END-->/);
                if (sourcesMatch) {
                    try {
                        const parsedSources = JSON.parse(sourcesMatch[1]);
                        sourcesFromResponse = parsedSources.map((s: any) => ({
                            type: s.type as 'email' | 'attachment' | 'web' | 'google_drive' | 'google_calendar' | 'sharepoint' | 'ui_help',
                            id: s.id,
                            title: s.title,
                            threadId: s.threadId,
                        }));
                        console.log('Extracted sources from response:', sourcesFromResponse);
                    } catch (e) {
                        console.error('Failed to parse sources from response:', e);
                    }
                }
                
                // Also include manually selected context
                const currentSources: Source[] = [
                    ...selectedEmailContext.map(email => ({
                        type: 'email' as const,
                        id: email.emailId,
                        title: email.subject,
                        threadId: email.threadId,
                    })),
                    ...selectedFiles.filter(f => f.status === 'ready').map(file => ({
                        type: 'attachment' as const,
                        id: file.id,
                        title: file.fileName,
                    })),
                    ...sourcesFromResponse, // Add sources from API response (vector search results)
                ]
                
                // Remove duplicates based on id and type
                const uniqueSources = currentSources.filter((source, index, self) =>
                    index === self.findIndex(s => s.id === source.id && s.type === source.type)
                );
                
                if (uniqueSources.length > 0) {
                    setMessageSources(prev => new Map(prev).set(options.message!.id, uniqueSources))
                }
            }
            
            // Implicit feedback: User saw the full response (didn't abort)
            if (!options.isAbort && !options.isError && options.message) {
                const assistantMessage = options.message;
                const userMessage = messages[messages.length - 1];
                
                if (userMessage && assistantMessage) {
                    const userQuery = userMessage.content || 
                        (userMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
                    const assistantResponse = assistantMessage.content || 
                        (assistantMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
                    
                    // Submit implicit feedback (async, don't block)
                    submitFeedback(assistantMessage.id, userQuery, assistantResponse, null, 'implicit')
                        .catch(console.error);
                }
            }
        },
        messages: [],
    });
    
    const submitFeedback = async (
        messageId: string,
        query: string,
        response: string,
        helpful: boolean | null,
        interactionType: 'explicit' | 'implicit' | 'correction' = 'explicit'
    ) => {
        if (!accountId) {
            console.warn('Cannot submit feedback: no accountId');
            return;
        }
        
        try {
            const res = await fetch('/api/chat/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    response,
                    helpful,
                    accountId,
                    interactionType
                })
            });
            
            if (!res.ok) {
                throw new Error('Failed to submit feedback');
            }
            
            if (helpful !== null) {
                setFeedbackGiven(prev => new Set(prev).add(messageId));
            }
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            if (helpful !== null) {
                // Only show error for explicit feedback
                toast.error('Failed to submit feedback');
            }
        }
    };
    
    const handleFeedback = async (messageId: string, helpful: boolean) => {
        // Prevent duplicate feedback
        if (feedbackGiven.has(messageId)) {
            toast.info('You\'ve already provided feedback for this response');
            return;
        }
        
        // Find the user query that generated this response
        const messageIndex = messages.findIndex((m: any) => m.id === messageId);
        if (messageIndex === -1) return;
        
        const assistantMessage = messages[messageIndex];
        const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
        
        if (!userMessage || !assistantMessage) return;
        
        const userQuery = userMessage.content || 
            (userMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
        const assistantResponse = assistantMessage.content || 
            (assistantMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
        
        await submitFeedback(messageId, userQuery, assistantResponse, helpful, 'explicit');
        toast.success(helpful ? 'Thanks for your feedback!' : 'We\'ll work to improve this');
    };
    
    // Detect query corrections (user rephrases shortly after response)
    React.useEffect(() => {
        if (messages.length < 2) return;
        
        const lastMessage = messages[messages.length - 1];
        const prevMessage = messages[messages.length - 2];
        
        // If user sends a new message shortly after assistant response, might be a correction
        if (lastMessage.role === 'user' && 
            prevMessage.role === 'assistant' &&
            prevMessage.id) {
            
            const responseTime = messageTimestamps.current.get(prevMessage.id);
            if (responseTime && Date.now() - responseTime < 30000) { // 30 seconds
                // User rephrased within 30 seconds - likely correction
                const originalQuery = messages.length >= 3 ? 
                    (messages[messages.length - 3].content || 
                     messages[messages.length - 3].parts?.find((p: any) => p.type === 'text')?.text || '') : '';
                const correctedQuery = lastMessage.content || 
                    (lastMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
                const originalResponse = prevMessage.content || 
                    (prevMessage.parts?.find((p: any) => p.type === 'text')?.text || '');
                
                if (originalQuery && correctedQuery) {
                    submitFeedback(
                        prevMessage.id,
                        originalQuery,
                        originalResponse,
                        false, // Implicitly not helpful if user rephrased
                        'correction'
                    ).catch(console.error);
                }
            }
        }
    }, [messages]);
    
    React.useEffect(() => {
        const messageContainer = document.getElementById("message-container");
        if (messageContainer) {
            messageContainer.scrollTo({
                top: messageContainer.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages]);

    const suggestedPrompts = [
        { text: 'What can I ask?', icon: '💬' },
        { text: 'When is my next flight?', icon: '✈️' },
        { text: 'When is my next meeting?', icon: '📅' },
        { text: 'Summarize my recent emails', icon: '📝' },
    ];

    return (
        <div className='flex flex-col h-full bg-background'>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h2 className="text-lg font-semibold text-foreground">New AI Chat</h2>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                        {/* Large AI Icon */}
                        <div className="mb-6">
                            <div className="relative">
                                <SparklesIcon className="size-16 text-primary" />
                            </div>
                        </div>
                        
                        {/* Welcome Question */}
                        <h3 className="text-xl font-medium text-foreground mb-6 text-center">
                            What would you like to know?
                        </h3>
                        
                        {/* Suggested Prompts */}
                        <div className="w-full space-y-2">
                            {suggestedPrompts.map((prompt, index) => (
                                <button
                                    key={index}
                                    onClick={() => setInput(prompt.text)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-left group"
                                >
                                    <span className="text-lg">{prompt.icon}</span>
                                    <span className="text-sm text-foreground flex-1">{prompt.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div 
                        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin" 
                        id='message-container'
                    >
                        <AnimatePresence mode="wait">
                            {messages.map((message: any) => {
                                let content = '';
                                if (message.parts && Array.isArray(message.parts)) {
                                    content = message.parts
                                        .filter((part: any) => part.type === 'text')
                                        .map((part: any) => (part as { text: string }).text)
                                        .join('');
                                } else if (message.content && typeof message.content === 'string') {
                                    content = message.content;
                                }
                                
                                // Remove sources marker from displayed content
                                content = content.replace(/<!--SOURCES_START:.*?:SOURCES_END-->/g, '').trim();
                                
                                const role = message.role;
                                
                                const hasFeedback = feedbackGiven.has(message.id);
                                
                                return (
                                    <motion.div
                                        key={message.id}
                                        layout="position"
                                        className={cn("max-w-[85%] break-words rounded-lg px-4 py-3", {
                                            'ml-auto bg-primary text-primary-foreground': role === 'user',
                                            'mr-auto bg-muted text-foreground': role === 'assistant',
                                        })}
                                        layoutId={`container-[${message.id}]`}
                                        transition={transitionDebug}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                    >
                                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {content || (role === 'assistant' && status === 'streaming' ? '...' : '')}
                                        </div>
                                        
                                        {/* Source Citations */}
                                        {role === 'assistant' && messageSources.get(message.id) && messageSources.get(message.id)!.length > 0 && (
                                            <SourceCitations 
                                                sources={messageSources.get(message.id) || []}
                                                accountId={accountId}
                                            />
                                        )}
                                        
                                        {/* Feedback buttons for assistant messages */}
                                        {role === 'assistant' && status !== 'streaming' && status !== 'submitted' && (
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                                <button
                                                    onClick={() => handleFeedback(message.id, true)}
                                                    disabled={hasFeedback}
                                                    className={cn(
                                                        "p-1.5 rounded hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                                        hasFeedback && "bg-green-500/20"
                                                    )}
                                                    title="Helpful"
                                                >
                                                    <ThumbsUp className={cn(
                                                        "size-4",
                                                        hasFeedback ? "text-green-500" : "text-muted-foreground hover:text-green-500"
                                                    )} />
                                                </button>
                                                <button
                                                    onClick={() => handleFeedback(message.id, false)}
                                                    disabled={hasFeedback}
                                                    className={cn(
                                                        "p-1.5 rounded hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                                        hasFeedback && "bg-red-500/20"
                                                    )}
                                                    title="Not helpful"
                                                >
                                                    <ThumbsDown className={cn(
                                                        "size-4",
                                                        hasFeedback ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                                                    )} />
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Input Area */}
                <div className="border-t p-4 flex-shrink-0 bg-background">
                    {/* Source Selection Row */}
                    <div className="flex items-center gap-3 mb-2">
                        <WebSearchToggle
                            enabled={webSearchEnabled}
                            onToggle={setWebSearchEnabled}
                        />
                    </div>
                    {/* Email Context Selector */}
                    {accountId && (
                        <EmailContextSelector
                            accountId={accountId}
                            selectedEmails={selectedEmailContext}
                            onSelect={(email) => {
                                setSelectedEmailContext(prev => [...prev, email])
                            }}
                            onRemove={(emailId) => {
                                setSelectedEmailContext(prev => prev.filter(e => e.emailId !== emailId))
                            }}
                        />
                    )}
                    {/* File Attachment Selector */}
                    {accountId && (
                        <FileAttachmentSelector
                            accountId={accountId}
                            selectedFiles={selectedFiles}
                            onSelect={(file) => {
                                setSelectedFiles(prev => [...prev, file])
                            }}
                            onRemove={(fileId) => {
                                setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
                            }}
                        />
                    )}
                    <form 
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!accountId) {
                                toast.error('Please select an account first');
                                return;
                            }
                            if (input.trim()) {
                                sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any);
                                setInput('');
                                // Clear email context and files after sending
                                setSelectedEmailContext([]);
                                setSelectedFiles([]);
                            }
                        }} 
                        className="flex items-end gap-2"
                    >
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                onChange={(e) => setInput(e.target.value)}
                                value={input}
                                className="w-full h-10 rounded-lg border border-border bg-card px-3 pr-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                                placeholder="Ask, search or create something..."
                                disabled={status === 'streaming' || status === 'submitted'}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!input.trim() || status === 'streaming' || status === 'submitted'}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        >
                            <Send className="size-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default AskAI