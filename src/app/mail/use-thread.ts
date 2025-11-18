import { useLocalStorage } from "usehooks-ts"

export function useThread() {
  const [threadId, setThreadId] = useLocalStorage<string>("threadId", "")
  return [threadId, setThreadId] as const
}

