"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

export type Language = 'en' | 'de' | 'fr' | 'it'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Translation keys
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.account': 'Account',
    'settings.privacy': 'Privacy',
    'settings.billing': 'Billing',
    'settings.knowledgebase': 'Knowledgebase',
    
    // General/Profile
    'profile.title': 'Profile',
    'profile.fullName': 'Full Name',
    'profile.claudeName': 'What should Claude call you?',
    'profile.jobFunction': 'What best describes your work?',
    'profile.jobFunction.placeholder': 'Select your job function',
    'profile.language': 'Language',
    'profile.language.placeholder': 'Select language',
    
    // Job functions
    'job.developer': 'Developer',
    'job.designer': 'Designer',
    'job.productManager': 'Product Manager',
    'job.marketing': 'Marketing',
    'job.sales': 'Sales',
    'job.support': 'Support',
    'job.other': 'Other',
    
    // Languages
    'lang.english': 'English',
    'lang.german': 'German',
    'lang.french': 'French',
    'lang.italian': 'Italian',
  },
  de: {
    // Settings
    'settings.title': 'Einstellungen',
    'settings.general': 'Allgemein',
    'settings.account': 'Konto',
    'settings.privacy': 'Datenschutz',
    'settings.billing': 'Abrechnung',
    'settings.knowledgebase': 'Wissensdatenbank',
    
    // General/Profile
    'profile.title': 'Profil',
    'profile.fullName': 'Vollständiger Name',
    'profile.claudeName': 'Wie soll Claude dich nennen?',
    'profile.jobFunction': 'Was beschreibt Ihre Arbeit am besten?',
    'profile.jobFunction.placeholder': 'Wählen Sie Ihre Arbeitsfunktion',
    'profile.language': 'Sprache',
    'profile.language.placeholder': 'Sprache auswählen',
    
    // Job functions
    'job.developer': 'Entwickler',
    'job.designer': 'Designer',
    'job.productManager': 'Produktmanager',
    'job.marketing': 'Marketing',
    'job.sales': 'Vertrieb',
    'job.support': 'Support',
    'job.other': 'Andere',
    
    // Languages
    'lang.english': 'Englisch',
    'lang.german': 'Deutsch',
    'lang.french': 'Französisch',
    'lang.italian': 'Italienisch',
  },
  fr: {
    // Settings
    'settings.title': 'Paramètres',
    'settings.general': 'Général',
    'settings.account': 'Compte',
    'settings.privacy': 'Confidentialité',
    'settings.billing': 'Facturation',
    'settings.knowledgebase': 'Base de connaissances',
    
    // General/Profile
    'profile.title': 'Profil',
    'profile.fullName': 'Nom complet',
    'profile.claudeName': 'Comment Claude doit-il vous appeler?',
    'profile.jobFunction': 'Qu\'est-ce qui décrit le mieux votre travail?',
    'profile.jobFunction.placeholder': 'Sélectionnez votre fonction',
    'profile.language': 'Langue',
    'profile.language.placeholder': 'Sélectionner la langue',
    
    // Job functions
    'job.developer': 'Développeur',
    'job.designer': 'Designer',
    'job.productManager': 'Chef de produit',
    'job.marketing': 'Marketing',
    'job.sales': 'Ventes',
    'job.support': 'Support',
    'job.other': 'Autre',
    
    // Languages
    'lang.english': 'Anglais',
    'lang.german': 'Allemand',
    'lang.french': 'Français',
    'lang.italian': 'Italien',
  },
  it: {
    // Settings
    'settings.title': 'Impostazioni',
    'settings.general': 'Generale',
    'settings.account': 'Account',
    'settings.privacy': 'Privacy',
    'settings.billing': 'Fatturazione',
    'settings.knowledgebase': 'Base di conoscenza',
    
    // General/Profile
    'profile.title': 'Profilo',
    'profile.fullName': 'Nome completo',
    'profile.claudeName': 'Come dovrebbe chiamarti Claude?',
    'profile.jobFunction': 'Cosa descrive meglio il tuo lavoro?',
    'profile.jobFunction.placeholder': 'Seleziona la tua funzione',
    'profile.language': 'Lingua',
    'profile.language.placeholder': 'Seleziona lingua',
    
    // Job functions
    'job.developer': 'Sviluppatore',
    'job.designer': 'Designer',
    'job.productManager': 'Product Manager',
    'job.marketing': 'Marketing',
    'job.sales': 'Vendite',
    'job.support': 'Supporto',
    'job.other': 'Altro',
    
    // Languages
    'lang.english': 'Inglese',
    'lang.german': 'Tedesco',
    'lang.french': 'Francese',
    'lang.italian': 'Italiano',
  },
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useLocalStorage<Language>('app-language', 'en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language, mounted])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

