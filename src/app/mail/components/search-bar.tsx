'use client'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import React from 'react'
import { atom, useAtom } from 'jotai'

export const isSearchingAtom = atom(false)
export const searchValueAtom = atom('')

const SearchBar = () => {
    const [searchValue, setSearchValue] = useAtom(searchValueAtom)
    const [isSearching, setIsSearching] = useAtom(isSearchingAtom)
    const ref = React.useRef<HTMLInputElement>(null)
    const handleBlur = () => {
        if (!!searchValue) return
        setIsSearching(false)
    }
    // add escape key to close
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleBlur()
                ref.current?.blur()
            }
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')) {
                e.preventDefault();
                ref.current?.focus();
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [setIsSearching, searchValue, isSearching, document.activeElement])


    return (
        <div className="bg-[#fafafa] p-4">
            <motion.div className="relative" layoutId="search-bar">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={ref}
                    placeholder="Search"
                    className="pl-8"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setIsSearching(true)}
                    onBlur={handleBlur}
                />
                <div className="absolute right-2 top-2.5 flex items-center gap-2">
                    <button
                        className="rounded-sm hover:bg-accent"
                        onClick={() => {
                            setSearchValue('')
                            setIsSearching(false)
                            ref.current?.blur()
                        }}
                    >
                        <X className="size-4 text-muted-foreground" />
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

export default SearchBar