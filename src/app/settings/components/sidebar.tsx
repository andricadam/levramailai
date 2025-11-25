'use client'
import React from 'react'
import { Nav } from './nav'
import {
    Settings as SettingsIcon,
    User,
    Shield,
    CreditCard,
    Zap,
    Plug,
    Code,
} from "lucide-react"
import { useLocalStorage } from 'usehooks-ts'

type Props = { isCollapsed: boolean }

const SideBar = ({ isCollapsed = false }: Props) => {
    const [mounted, setMounted] = React.useState(false)
    const [view] = useLocalStorage("settings-view", "allgemein")

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Use default "allgemein" on server to match initial client render
    const currentView = mounted ? view : "allgemein"

    // Helper function to normalize view names for comparison
    const normalizeView = (title: string) => title.toLowerCase().replace(/\s+/g, '-')

    return (
        <div className="py-2 w-full">
            <Nav
                isCollapsed={isCollapsed}
                links={[
                    {
                        title: "Allgemein",
                        label: undefined,
                        icon: SettingsIcon,
                        variant: currentView === normalizeView("Allgemein") ? "default" : "ghost",
                    },
                    {
                        title: "Konto",
                        label: undefined,
                        icon: User,
                        variant: currentView === normalizeView("Konto") ? "default" : "ghost",
                    },
                    {
                        title: "Datenschutz",
                        label: undefined,
                        icon: Shield,
                        variant: currentView === normalizeView("Datenschutz") ? "default" : "ghost",
                    },
                    {
                        title: "Abrechnung",
                        label: undefined,
                        icon: CreditCard,
                        variant: currentView === normalizeView("Abrechnung") ? "default" : "ghost",
                    },
                    {
                        title: "Fähigkeiten",
                        label: undefined,
                        icon: Zap,
                        variant: currentView === normalizeView("Fähigkeiten") ? "default" : "ghost",
                    },
                    {
                        title: "Konnektoren",
                        label: undefined,
                        icon: Plug,
                        variant: currentView === normalizeView("Konnektoren") ? "default" : "ghost",
                    },
                    {
                        title: "Claude Code",
                        label: undefined,
                        icon: Code,
                        variant: currentView === normalizeView("Claude Code") ? "default" : "ghost",
                    },
                ]}
            />
        </div>
    )
}

export default SideBar
export { SideBar as Sidebar }

