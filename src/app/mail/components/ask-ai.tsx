'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState } from 'react'
import { Send, X, Pencil, Square, Minus } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';
import { cn } from '@/lib/utils';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import { api } from '@/trpc/react';
import { SheetClose } from '@/components/ui/sheet';

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
    const { sendMessage, messages, status } = useChat({
        transport: new DefaultChatTransport({
            api: "/api/chat",
            body: {
                accountId,
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
        onFinish: (options) => {
            console.log('Chat response received:', {
                message: options.message,
                finishReason: options.finishReason,
                isAbort: options.isAbort,
                isDisconnect: options.isDisconnect,
                isError: options.isError,
            });
        },
        messages: [],
    });
    
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
                <div className="flex items-center gap-2">
                    <button
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        aria-label="Edit"
                    >
                        <Pencil className="size-4 text-muted-foreground" />
                    </button>
                    <button
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        aria-label="New window"
                    >
                        <Square className="size-4 text-muted-foreground" />
                    </button>
                    <SheetClose asChild>
                        <button
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            aria-label="Close"
                        >
                            <Minus className="size-4 text-muted-foreground" />
                        </button>
                    </SheetClose>
                </div>
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
                                
                                const role = message.role;
                                
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
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* Input Area */}
                <div className="border-t p-4 flex-shrink-0 bg-background">
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