"use client"

import React from 'react'
import { useLocalStorage } from 'usehooks-ts'

export function SettingsContent() {
    const [mounted, setMounted] = React.useState(false)
    const [view] = useLocalStorage("settings-view", "allgemein")

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const currentView = mounted ? view : "allgemein"

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b">
                <h1 className="text-2xl font-semibold">Einstellungen</h1>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {currentView === "allgemein" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Allgemein</h2>
                        <p className="text-muted-foreground">General settings content will go here</p>
                    </div>
                )}
                {currentView === "konto" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Konto</h2>
                        <p className="text-muted-foreground">Account settings content will go here</p>
                    </div>
                )}
                {currentView === "datenschutz" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Datenschutz</h2>
                        <p className="text-muted-foreground">Privacy settings content will go here</p>
                    </div>
                )}
                {currentView === "abrechnung" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Abrechnung</h2>
                        <p className="text-muted-foreground">Billing settings content will go here</p>
                    </div>
                )}
                {currentView === "fähigkeiten" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Fähigkeiten</h2>
                        <p className="text-muted-foreground">Capabilities settings content will go here</p>
                    </div>
                )}
                {currentView === "konnektoren" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Konnektoren</h2>
                        <p className="text-muted-foreground">Connectors settings content will go here</p>
                    </div>
                )}
                {currentView === "claude-code" && (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Claude Code</h2>
                        <p className="text-muted-foreground">Claude Code settings content will go here</p>
                    </div>
                )}
            </div>
        </div>
    )
}

