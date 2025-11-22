"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useLocalStorage } from "usehooks-ts"

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: string
  column?: string
}

export function CheckboxView() {
  const [tasks, setTasks] = useLocalStorage<Task[]>("tasks", [])
  const [newTaskTitle, setNewTaskTitle] = React.useState("")

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      }
      setTasks([...tasks, newTask])
      setNewTaskTitle("")
    }
  }

  const handleToggleTask = (taskId: string) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ))
  }

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId))
  }

  return (
    <div className="flex h-full w-full gap-6 p-6 overflow-auto">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            All Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Task Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a new task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddTask()
                }
              }}
            />
            <Button onClick={handleAddTask} size="sm">
              Add
            </Button>
          </div>

          <Separator />

          {/* Task List */}
          <div className="flex flex-col gap-2">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleTask(task.id)}
                  />
                  <div className="flex-1">
                    <div
                      className={`text-sm ${
                        task.completed
                          ? "line-through text-muted-foreground"
                          : "font-medium"
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm text-center py-8">
                No tasks yet. Add one above to get started!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

