import { createSignal, For } from 'solid-js'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export default function TagInput(props: Props) {
  const [input, setInput] = createSignal('')

  const addTag = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = input().trim().toLowerCase()
      if (tag && !props.tags.includes(tag)) {
        props.onChange([...props.tags, tag])
      }
      setInput('')
    }
  }

  const removeTag = (tag: string) => {
    props.onChange(props.tags.filter(t => t !== tag))
  }

  return (
    <div class="flex flex-wrap gap-1.5 p-2 bg-surface border border-border/30 rounded-lg min-h-[38px]">
      <For each={props.tags}>
        {(tag) => (
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent text-xs rounded font-mono">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              class="text-accent/50 hover:text-accent"
            >
              x
            </button>
          </span>
        )}
      </For>
      <input
        type="text"
        value={input()}
        onInput={(e) => setInput(e.currentTarget.value)}
        onKeyDown={addTag}
        placeholder={props.placeholder || 'Add tag...'}
        class="flex-1 min-w-[80px] bg-transparent text-sm text-gray-300 placeholder-gray-500 focus:outline-none"
      />
    </div>
  )
}
