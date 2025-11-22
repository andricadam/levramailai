'use client'
import React from 'react'

type Props = { isCollapsed: boolean }

const SideBar = ({ isCollapsed = false }: Props) => {
    // Sidebar is now empty - view switching is handled in top nav
    return (
        <div className="py-2 w-full">
            {/* Sidebar content can be added here in the future if needed */}
        </div>
    )
}

export default SideBar
export { SideBar as Sidebar }

