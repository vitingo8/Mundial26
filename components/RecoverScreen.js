'use client'
import { useEffect } from 'react'

/** @deprecated Usa inicio con email; redirige a home */
export default function RecoverScreen({ setScreen }) {
  useEffect(() => {
    setScreen('home')
  }, [setScreen])
  return null
}
