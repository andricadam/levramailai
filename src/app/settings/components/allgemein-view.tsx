"use client"

import React from 'react'
import { useUser } from '@clerk/nextjs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLanguage, type Language } from '@/contexts/language-context'

export function AllgemeinView() {
  const { user } = useUser()
  const { language, setLanguage, t } = useLanguage()
  const [fullName, setFullName] = React.useState(
    user?.fullName || user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : "Andri Adam"
  )
  const [claudeName, setClaudeName] = React.useState(
    user?.firstName || "Andri"
  )
  const [jobFunction, setJobFunction] = React.useState<string>("")

  // Update when user loads
  React.useEffect(() => {
    if (user) {
      const name = user.fullName || (user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : "Andri Adam")
      setFullName(name)
      setClaudeName(user.firstName || "Andri")
    }
  }, [user])

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'en', label: t('lang.english') },
    { value: 'de', label: t('lang.german') },
    { value: 'fr', label: t('lang.french') },
    { value: 'it', label: t('lang.italian') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-6">{t('profile.title')}</h2>
        
        <div className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full-name">{t('profile.fullName')}</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-muted text-foreground">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* What should Claude call you? */}
          <div className="space-y-2">
            <Label htmlFor="claude-name">{t('profile.claudeName')}</Label>
            <Input
              id="claude-name"
              value={claudeName}
              onChange={(e) => setClaudeName(e.target.value)}
              className="w-full"
            />
          </div>

          {/* What best describes your work? */}
          <div className="space-y-2">
            <Label htmlFor="job-function">{t('profile.jobFunction')}</Label>
            <Select value={jobFunction} onValueChange={setJobFunction}>
              <SelectTrigger id="job-function" className="w-full">
                <SelectValue placeholder={t('profile.jobFunction.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer">{t('job.developer')}</SelectItem>
                <SelectItem value="designer">{t('job.designer')}</SelectItem>
                <SelectItem value="product-manager">{t('job.productManager')}</SelectItem>
                <SelectItem value="marketing">{t('job.marketing')}</SelectItem>
                <SelectItem value="sales">{t('job.sales')}</SelectItem>
                <SelectItem value="support">{t('job.support')}</SelectItem>
                <SelectItem value="other">{t('job.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="language">{t('profile.language')}</Label>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder={t('profile.language.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}

