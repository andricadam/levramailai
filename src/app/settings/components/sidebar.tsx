'use client'
import React from 'react'
import { Nav } from './nav'
import {
    Settings as SettingsIcon,
    User,
    Shield,
    CreditCard,
} from "lucide-react"
import { useLocalStorage } from 'usehooks-ts'
import { useLanguage } from '@/contexts/language-context'

type Props = { isCollapsed: boolean }

const SideBar = ({ isCollapsed = false }: Props) => {
    const [mounted, setMounted] = React.useState(false)
    const [view] = useLocalStorage("settings-view", "general")
    const { t } = useLanguage()

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Use default "general" on server to match initial client render
    const currentView = mounted ? view : "general"

    return (
        <div className="py-2 w-full">
            <Nav
                isCollapsed={isCollapsed}
                links={[
                    {
                        title: t('settings.general'),
                        label: undefined,
                        icon: SettingsIcon,
                        variant: currentView === "general" ? "default" : "ghost",
                        viewKey: "general",
                    },
                    {
                        title: t('settings.account'),
                        label: undefined,
                        icon: User,
                        variant: currentView === "account" ? "default" : "ghost",
                        viewKey: "account",
                    },
                    {
                        title: t('settings.privacy'),
                        label: undefined,
                        icon: Shield,
                        variant: currentView === "privacy" ? "default" : "ghost",
                        viewKey: "privacy",
                    },
                    {
                        title: t('settings.billing'),
                        label: undefined,
                        icon: CreditCard,
                        variant: currentView === "billing" ? "default" : "ghost",
                        viewKey: "billing",
                    },
                ]}
            />
        </div>
    )
}

export default SideBar
export { SideBar as Sidebar }

