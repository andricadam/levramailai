import { Node, mergeAttributes } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import GhostText from './ghost-text'

const GhostExtension = Node.create({
  name: 'ghostText',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="ghost-text"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'ghost-text' }), 0]
  },

  addNodeView() {
    return ({ node }) => {
      const component = new ReactRenderer(GhostText, {
        props: {
          node,
        },
        editor: this.editor,
      })

      return {
        dom: component.element,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false
          }

          component.updateProps({
            node: updatedNode,
          })

          return true
        },
        destroy: () => {
          component.destroy()
        },
      }
    }
  },
})

export default GhostExtension

