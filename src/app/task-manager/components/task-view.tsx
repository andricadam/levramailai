"use client"

import * as React from "react"
import { useLocalStorage } from "usehooks-ts"
import { CheckboxView } from "./checkbox-view"
import { KanbanView } from "./kanban-view"

export function TaskView() {
  const [view] = useLocalStorage("task-manager-view", "checkbox")

  return (
    <>
      {view === "kanban" ? <KanbanView /> : <CheckboxView />}
    </>
  )
}

