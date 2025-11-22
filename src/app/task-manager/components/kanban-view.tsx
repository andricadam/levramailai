'use client';

import * as React from 'react';
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/shadcn-io/kanban';
import { useLocalStorage } from 'usehooks-ts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  column?: string;
}

// Define columns for kanban
const columns = [
  { id: 'planned', name: 'Planned', color: '#6B7280' },
  { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  { id: 'done', name: 'Done', color: '#10B981' },
];

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export function KanbanView() {
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', []);
  const [newTaskTitle, setNewTaskTitle] = React.useState('');

  // Convert tasks to kanban format and ensure all tasks have a column
  const kanbanTasks = React.useMemo(() => {
    return tasks.map((task) => {
      // If task doesn't have a column, assign based on completed status
      let column = task.column;
      if (!column) {
        if (task.completed) {
          column = 'done';
        } else {
          column = 'planned';
        }
      }
      // Ensure completed status matches column
      const completed = column === 'done';
      return {
        ...task,
        column,
        completed,
      };
    });
  }, [tasks]);

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
        column: 'planned',
      };
      setTasks([...tasks, newTask]);
      setNewTaskTitle('');
    }
  };

  const handleDataChange = (newData: Task[]) => {
    // Update tasks when kanban cards are moved
    // Sync completed status with column: if in "done" column, mark as completed
    const updatedTasks = newData.map((task) => ({
      ...task,
      completed: task.column === 'done',
    }));
    setTasks(updatedTasks);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter((task) => task.id !== taskId));
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 p-6 overflow-auto">
      {/* Add Task Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Kanban Board</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Add a new task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddTask();
                }
              }}
            />
            <Button onClick={handleAddTask} size="sm">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        <KanbanProvider
          columns={columns}
          data={kanbanTasks}
          onDataChange={handleDataChange}
        >
          {(column) => (
            <KanbanBoard id={column.id} key={column.id}>
              <KanbanHeader>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <span>{column.name}</span>
                </div>
              </KanbanHeader>
              <KanbanCards id={column.id}>
                {(task: Task) => (
                  <KanbanCard
                    column={column.id}
                    id={task.id}
                    key={task.id}
                    name={task.title}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1 flex-1">
                        <p className="m-0 flex-1 font-medium text-sm">
                          {task.title}
                        </p>
                        <p className="m-0 text-muted-foreground text-xs">
                          {shortDateFormatter.format(new Date(task.createdAt))}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="text-destructive hover:text-destructive h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  </KanbanCard>
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  );
}

