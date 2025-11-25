// Note: This file requires 'quill' package to be installed: npm install quill @types/quill
// Using dynamic import to handle cases where quill may not be installed

// Define Quill types manually to avoid import errors when quill is not installed
interface QuillInstance {
    getText(): string;
    getLength(): number;
    getSelection(): { index: number; length: number } | null;
    getLine(index: number): [any, number];
    getFormat(index: number | { index: number; length: number }): Record<string, any>;
    insertEmbed(index: number, type: string, value: string, source?: string): void;
    insertText(index: number, text: string, source?: string): void;
    deleteText(index: number, length: number, source?: string): void;
    setSelection(index: number, length?: number, source?: string): void;
    on(event: string, handler: (...args: any[]) => void): void;
    root: HTMLElement;
}

let QuillModule: any = null;
let Embed: any = null;

// Try to load Quill at runtime
if (typeof window !== 'undefined') {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const quill = require('quill');
        QuillModule = quill.default || quill;
        Embed = QuillModule.import('blots/embed');
    } catch (e) {
        // Quill not installed - will fail gracefully
    }
}

export class CopilotSuggestion {
    static blotName = 'copilot-suggestion';
    static tagName = 'span';

    static create(value: string): HTMLElement {
        if (!Embed) {
            const node = document.createElement('span');
            node.setAttribute('data-copilot-suggestion', value);
            node.classList.add('copilot-suggestion');
            return node;
        }
        const node = Embed.create(value);
        node.setAttribute('data-copilot-suggestion', value);
        node.classList.add('copilot-suggestion');
        return node;
    }

    static value(node: HTMLElement): string | null {
        return node.getAttribute('data-copilot-suggestion');
    }
}

if (QuillModule) {
    QuillModule.register(CopilotSuggestion);
}

export default class QuillCopilot {
    quill: QuillInstance;
    options: {
        suggestFn?: (text: string) => Promise<string>;
    };
    suggestFn: (text: string) => Promise<string>;
    private currentSuggestionIndex: number | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;

    constructor(quill: QuillInstance, options: { suggestFn?: (text: string) => Promise<string> } = {}) {
        this.quill = quill;
        this.options = options;
        this.suggestFn = options.suggestFn || ((text: string) => Promise.resolve(''));
        this.attachTextChangeHandler();
    }

    attachTextChangeHandler() {
        this.quill.on('text-change', async (delta: any, oldDelta: any, source: string) => {
            if (source === 'user') {
                // Clear any pending debounce
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }

                // Remove existing suggestion if user is typing
                this.removeSuggestion();

                // Debounce suggestion generation to avoid too many API calls
                this.debounceTimer = setTimeout(async () => {
                    const text = this.quill.getText();
                    const suggestion = await this.suggestFn(text);
                    if (suggestion && text.length > 0 && !this.quill.root.querySelector('.copilot-suggestion')) {
                        this.showSuggestion(text.length, suggestion);
                    }
                }, 300);
            }
        });

        this.quill.root.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                const range = this.quill.getSelection();
                if (range) {
                    const formats = this.quill.getFormat(range);
                    if (formats['copilot-suggestion']) {
                        event.preventDefault();
                        this.acceptSuggestion(range.index);
                    }
                }
            } else if (event.key === 'Escape') {
                // Allow user to dismiss suggestion with Escape
                this.removeSuggestion();
            }
        });
    }

    private removeSuggestion() {
        const suggestionNode = this.quill.root.querySelector('.copilot-suggestion');
        if (suggestionNode && this.currentSuggestionIndex !== null) {
            const range = this.quill.getSelection();
            if (range) {
                // Find the actual position of the suggestion
                const suggestion = suggestionNode.getAttribute('data-copilot-suggestion');
                if (suggestion) {
                    // Quill embeds are typically 1 character in length
                    // We need to find where the embed actually is
                    const text = this.quill.getText();
                    let embedIndex = -1;
                    
                    // Search for the embed by checking formats at each position
                    for (let i = 0; i < text.length; i++) {
                        const formats = this.quill.getFormat(i);
                        if (formats['copilot-suggestion']) {
                            embedIndex = i;
                            break;
                        }
                    }
                    
                    if (embedIndex !== -1) {
                        this.quill.deleteText(embedIndex, 1, 'user');
                    }
                }
            }
            this.currentSuggestionIndex = null;
        }
    }

    showSuggestion(index: number, suggestion: string) {
        // Remove any existing suggestion first
        this.removeSuggestion();
        
        // Only show suggestion if there's no existing suggestion at this position
        const existingSuggestion = this.quill.root.querySelector('.copilot-suggestion');
        if (!existingSuggestion) {
            this.currentSuggestionIndex = index;
            this.quill.insertEmbed(index, 'copilot-suggestion', suggestion, 'user');
        }
    }

    acceptSuggestion(index: number) {
        const suggestionNode = this.quill.root.querySelector('.copilot-suggestion');
        if (suggestionNode) {
            const suggestion = suggestionNode.getAttribute('data-copilot-suggestion');
            if (suggestion) {
                // Find the actual position of the embed
                let embedIndex = -1;
                for (let i = 0; i < this.quill.getLength(); i++) {
                    const formats = this.quill.getFormat(i);
                    if (formats['copilot-suggestion']) {
                        embedIndex = i;
                        break;
                    }
                }
                
                if (embedIndex !== -1) {
                    // Delete the suggestion embed (embeds are 1 character)
                    this.quill.deleteText(embedIndex, 1, 'user');
                    
                    // Insert the actual suggestion text
                    this.quill.insertText(embedIndex, suggestion, 'user');
                    this.quill.setSelection(embedIndex + suggestion.length);
                    
                    this.currentSuggestionIndex = null;
                }
            }
        }
    }

    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.removeSuggestion();
    }
}