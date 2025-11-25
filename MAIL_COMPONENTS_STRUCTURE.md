# Mail Components AI Folder Structure

## New Organization

The mail components have been reorganized to group AI-related functionality together.

### Main AI Features (`components/ai/`)

#### `ai/ask-ai/` - Ask AI Chat Feature
- `ask-ai.tsx` - Main chat interface component
- `ask-ai-button.tsx` - Floating button that opens chat
- `index.ts` - Exports

#### `ai/compose/` - AI Email Compose Feature
- `ai-compose-button.tsx` - Compose button component
- `action.ts` - `generateEmail` server action (GPT-4 Turbo)
- `index.ts` - Exports

#### `ai/autocomplete/` - AI Autocomplete Feature
- `copilot-suggestion.tsx` - Quill copilot integration
- `action.ts` - `generate` server action (GPT-4 for sentence completion)
- `index.ts` - Exports

### Email Editor AI Features (`components/email-editor/ai/`)

#### `email-editor/ai/compose/` - Editor-specific Compose
- `ai-compose-button.tsx` - Editor compose button
- `action.ts` - Editor `generateEmail` action
- `index.ts` - Exports

#### `email-editor/ai/autocomplete/` - Editor-specific Autocomplete
- `extensions.ts` - TipTap extension for Cmd+J keyboard shortcut
- `action.ts` - Editor `generate` action
- `index.ts` - Exports

## Migration Summary

### Files Moved:
- `ask-ai.tsx` → `ai/ask-ai/ask-ai.tsx`
- `ask-ai-button.tsx` → `ai/ask-ai/ask-ai-button.tsx`
- `ai-compose-button.tsx` → `ai/compose/ai-compose-button.tsx`
- `copilot-suggestion.tsx` → `ai/autocomplete/copilot-suggestion.tsx`
- `action.ts` → Split into:
  - `ai/compose/action.ts` (generateEmail)
  - `ai/autocomplete/action.ts` (generate)
- `email-editor/ai-compose-button.tsx` → `email-editor/ai/compose/ai-compose-button.tsx`
- `email-editor/action.ts` → Split into:
  - `email-editor/ai/compose/action.ts` (generateEmail)
  - `email-editor/ai/autocomplete/action.ts` (generate)
- `email-editor/extensions.ts` → `email-editor/ai/autocomplete/extensions.ts`

### Files Deleted:
- `components/action.ts` (replaced by split files)
- `email-editor/action.ts` (replaced by split files)

### Import Updates:
- `email-editor.tsx` - Updated to use new paths
- `email-editor/index.tsx` - Updated to use new paths
- `page.tsx` - Updated AskAIButton import

## Benefits

1. **Clear Separation**: AI features are now clearly organized by function
2. **Easier Maintenance**: Related code is grouped together
3. **Scalability**: Easy to add new AI features in their own folders
4. **Better Organization**: Editor-specific AI features are separated from general AI features
5. **Clean Exports**: Index files provide clean import paths

