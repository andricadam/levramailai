'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react'
import { Send } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';
import { cn } from '@/lib/utils';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { toast } from 'sonner';
import { api } from '@/trpc/react';


const transitionDebug = {
    type: "tween" as const,
    ease: "easeOut" as const,
    duration: 0.2,
};
const AskAI = () => {
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
    
    // Debug: Log messages to see if assistant messages are being added
    React.useEffect(() => {
        console.log('Messages updated:', messages);
        console.log('Status:', status);
    }, [messages, status]);
    React.useEffect(() => {
        const messageContainer = document.getElementById("message-container");
        if (messageContainer) {
            messageContainer.scrollTo({
                top: messageContainer.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages]);

    return (
        <div className='p-4 overflow-hidden flex flex-col h-full max-h-[600px]'>
            <motion.div className="flex flex-col items-end justify-end pb-3 border rounded-lg bg-card shadow-inner p-3 min-h-0 overflow-hidden flex-1">
                <div className="max-h-[180px] overflow-y-auto w-full flex flex-col gap-2 scrollbar-thin" id='message-container'>
                    <AnimatePresence mode="wait">
                        {messages.map((message: any) => {
                            // Handle both parts format and content format
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
                            console.log('Rendering message:', { id: message.id, role, content: content.substring(0, 50), hasParts: !!message.parts });
                            
                            return (
                                <motion.div
                                    key={message.id}
                                    layout="position"
                                    className={cn("z-10 mt-2 max-w-[250px] break-words rounded-lg bg-muted", {
                                        'self-end text-foreground': role === 'user',
                                        'self-start bg-primary text-primary-foreground': role === 'assistant',
                                    })}
                                    layoutId={`container-[${message.id}]`}
                                    transition={transitionDebug}
                                >
                                    <div className="px-3 py-2 text-[15px] leading-[15px]">
                                        {content || (role === 'assistant' && status === 'streaming' ? '...' : '')}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
                {messages.length > 0 && <div className="h-3 flex-shrink-0"></div>}
                <div className="w-full flex-shrink-0">
                    {messages.length === 0 && <div className="mb-3">
                        <div className='flex items-center gap-3 mb-2'>
                            <SparklesIcon className='size-5 text-muted-foreground flex-shrink-0' />
                            <div>
                                <p className='text-foreground text-sm font-medium'>Ask AI anything about your emails</p>
                                <p className='text-muted-foreground text-xs'>Get answers to your questions</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span onClick={() => setInput('What can I ask?')} className='px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs cursor-pointer hover:bg-primary/90 transition-colors'>What can I ask?</span>
                            <span onClick={() => setInput('When is my next flight?')} className='px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs cursor-pointer hover:bg-primary/90 transition-colors'>When is my next flight?</span>
                            <span onClick={() => setInput('When is my next meeting?')} className='px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs cursor-pointer hover:bg-primary/90 transition-colors'>When is my next meeting?</span>
                        </div>
                    </div>
                    }
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!accountId) {
                            toast.error('Please select an account first');
                            return;
                        }
                        if (input.trim()) {
                            sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] } as any);
                            setInput('');
                        }
                    }} className="flex w-full">
                        <input
                            type="text"
                            onChange={(e) => setInput(e.target.value)}
                            value={input}
                            className="py- relative h-9 placeholder:text-[13px] flex-grow rounded-lg border border-border bg-card px-3 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-ring/50 focus-visible:ring-offset-1"
                            placeholder="Ask AI anything about your emails"
                            disabled={status === 'streaming' || status === 'submitted'}
                        />
                        <motion.div
                            key={messages.length}
                            layout="position"
                            className="pointer-events-none absolute z-10 flex h-9 w-[250px] items-center overflow-hidden break-words rounded-lg bg-muted [word-break:break-word]"
                            layoutId={`container-[${messages.length}]`}
                            transition={transitionDebug}
                            initial={{ opacity: 0.6, zIndex: -1 }}
                            animate={{ opacity: 0.6, zIndex: -1 }}
                            exit={{ opacity: 1, zIndex: 1 }}
                        >
                            <div className="px-3 py-2 text-[15px] leading-[15px] text-foreground">
                                {input}
                            </div>
                        </motion.div>
                        <button
                            type="submit"
                            className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Send className="size-4" />
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    )
}

export default AskAI