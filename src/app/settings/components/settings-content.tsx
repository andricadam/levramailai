"use client"

import React from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/language-context'
import { AllgemeinView } from './allgemein-view'
import { KontoView } from './konto-view'
import { DatenschutzView } from './datenschutz-view'
import { AbrechnungView } from './abrechnung-view'
import { KnowledgebaseView } from './knowledgebase-view'

export function SettingsContent() {
    const [mounted, setMounted] = React.useState(false)
    const [view] = useLocalStorage("settings-view", "general")
    const { t } = useLanguage()

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const currentView = mounted ? view : "general"

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b">
                <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {currentView === "general" && <AllgemeinView />}
                {currentView === "account" && <KontoView />}
                {currentView === "privacy" && <DatenschutzView />}
                {currentView === "billing" && <AbrechnungView />}
                {currentView === "knowledgebase" && <KnowledgebaseView />}
            </div>
        </div>
    )
}

