'use client'
import React from 'react'
import { Nav } from './nav'

import {
    Calendar as CalendarIcon,
} from "lucide-react"
import { useLocalStorage } from 'usehooks-ts'

type Props = { isCollapsed: boolean }

const SideBar = ({ isCollapsed = false }: Props) => {
    const [mounted, setMounted] = React.useState(false)
    const [view] = useLocalStorage("calendar-view", "month")

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Use default "month" on server to match initial client render
    const currentView = mounted ? view : "month"

    return (
        <div className="py-2 w-full">
            <Nav
                isCollapsed={isCollapsed}
                links={[
                    {
                        title: "Month",
                        label: undefined,
                        icon: CalendarIcon,
                        variant: currentView === "month" ? "default" : "ghost",
                    },
                ]}
            />
        </div>
    )
}

export default SideBar
export { SideBar as Sidebar }

