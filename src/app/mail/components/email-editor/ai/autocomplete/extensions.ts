'use client'
import Text from '@tiptap/extension-text'

export function createAutocompleteExtension(aiGenerateRef: React.MutableRefObject<((editorInstance: any) => Promise<void>) | null>) {
    return Text.extend({
        addKeyboardShortcuts() {
            return {
                'Meta-j': () => {
                    // Call the async function without blocking
                    if (aiGenerateRef.current) {
                        aiGenerateRef.current(this.editor).catch(console.error)
                    }
                    return true
                }
            }
        },
    })
}

