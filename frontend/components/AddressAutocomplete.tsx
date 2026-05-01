/// <reference types="@types/google.maps" />
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AddressResult {
  address: string
  lat: number
  lon: number
  city: string
}

interface Props {
  onSelect: (result: AddressResult) => void
  value: string
  onChange: (val: string) => void
}

// Maps lowercase Google Places city names to exact model city strings
const CITY_MAP: Record<string, string> = {
  'montréal': 'Montréal',
  'montreal': 'Montréal',
  'laval': 'Laval',
  'longueuil': 'Longueuil',
  'brossard': 'Brossard',
  'saint-lambert': 'Saint-Lambert',
  'boucherville': 'Boucherville',
  'saint-bruno-de-montarville': 'Saint-Bruno-De-Montarville',
  'repentigny': 'Repentigny',
  'terrebonne': 'Terrebonne',
  'blainville': 'Blainville',
  'boisbriand': 'Boisbriand',
  'saint-eustache': 'Saint-Eustache',
  'mirabel': 'Mirabel',
  'deux-montagnes': 'Deux-Montagnes',
  'vaudreuil-dorion': 'Vaudreuil-Dorion',
  'saint-jean-sur-richelieu': 'Saint-Jean-Sur-Richelieu',
  'candiac': 'Candiac',
  'delson': 'Delson',
  'sainte-catherine': 'Sainte-Catherine',
  'châteauguay': 'Châteauguay',
  'chateauguay': 'Châteauguay',
  'kirkland': 'Kirkland',
  'dollard-des-ormeaux': 'Dollard-Des-Ormeaux',
  'pointe-claire': 'Pointe-Claire',
  'beaconsfield': 'Beaconsfield',
  'saint-lazare': 'Saint-Lazare',
  'hudson': 'Hudson',
  'dorval': 'Dorval',
  'côte-saint-luc': 'Côte-Saint-Luc',
  'cote-saint-luc': 'Côte-Saint-Luc',
  'westmount': 'Westmount',
  'mont-royal': 'Mont-Royal',
  'montréal-est': 'Montréal-Est',
  'montreal-est': 'Montréal-Est',
  'montréal-ouest': 'Montréal-Ouest',
  'montreal-ouest': 'Montréal-Ouest',
  'hampstead': 'Hampstead',
  'baie-d\'urfé': 'Baie-D\'Urfé',
  'rosemère': 'Rosemère',
  'rosemere': 'Rosemère',
  'mascouche': 'Mascouche',
  'lorraine': 'Lorraine',
  'prévost': 'Prévost',
  'prevost': 'Prévost',
  'sainte-thérèse': 'Sainte-Thérèse',
  'sainte-therese': 'Sainte-Thérèse',
  'sainte-marthe-sur-le-lac': 'Sainte-Marthe-Sur-Le-Lac',
  'sainte-anne-de-bellevue': 'Sainte-Anne-De-Bellevue',
  'sainte-anne-des-lacs': 'Sainte-Anne-Des-Lacs',
  'sainte-anne-des-plaines': 'Sainte-Anne-Des-Plaines',
  'sainte-sophie': 'Sainte-Sophie',
  'saint-jérôme': 'Saint-Jérôme',
  'saint-jerome': 'Saint-Jérôme',
  'saint-colomban': 'Saint-Colomban',
  'saint-joseph-du-lac': 'Saint-Joseph-Du-Lac',
  'saint-lin–laurentides': 'Saint-Lin–Laurentides',
  'saint-lin-laurentides': 'Saint-Lin–Laurentides',
  'saint-sauveur': 'Saint-Sauveur',
  'varennes': 'Varennes',
  'verchères': 'Verchères',
  'vercheres': 'Verchères',
  'carignan': 'Carignan',
  'la prairie': 'La Prairie',
  'senneville': 'Senneville',
  'vaudreuil-sur-le-lac': 'Vaudreuil-Sur-Le-Lac',
  'oka': 'Oka',
  'l\'assomption': 'L\'Assomption',
  'l\'île-perrot': 'L\'Île-Perrot',
  'l\'île-cadieux': 'L\'Île-Cadieux',
  'l\'île-dorval': 'L\'Île-Dorval',
  'pointe-calumet': 'Pointe-Calumet',
  'bois-des-filion': 'Bois-Des-Filion',
  'charlemagne': 'Charlemagne',
  'gore': 'Gore',
}

function normalizeCity(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return CITY_MAP[lower] || raw // fall back to original if not in map
}

export default function AddressAutocomplete({ onSelect, value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dummyDiv = useRef<HTMLDivElement | null>(null)

  function initServices() {
    autocompleteService.current = new window.google.maps.places.AutocompleteService()
    dummyDiv.current = document.createElement('div')
    placesService.current = new window.google.maps.places.PlacesService(dummyDiv.current)
    sessionToken.current = new window.google.maps.places.AutocompleteSessionToken()
  }

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY
    if (!key) return
    if (window.google?.maps?.places) {
      initServices()
      return
    }
    const scriptId = 'google-maps-script'
    if (document.getElementById(scriptId)) return
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.onload = initServices
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchSuggestions = useCallback((input: string) => {
    if (!autocompleteService.current || input.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    autocompleteService.current.getPlacePredictions(
      {
        input,
        sessionToken: sessionToken.current ?? undefined,
        componentRestrictions: { country: 'ca' },
        types: ['address'],
      },
      (predictions, status) => {
        setLoading(false)
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions)
          setOpen(true)
        } else {
          setSuggestions([])
          setOpen(false)
        }
      }
    )
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    if (!placesService.current) return
    onChange(prediction.description)
    setOpen(false)
    setSuggestions([])

    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'address_components', 'formatted_address'],
        sessionToken: sessionToken.current ?? undefined,
      },
      (place, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) return
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken()

        const lat = place.geometry?.location?.lat() ?? 0
        const lon = place.geometry?.location?.lng() ?? 0

        const components = place.address_components || []
        let cityRaw = ''
        for (const comp of components) {
          if (comp.types.includes('locality')) { cityRaw = comp.long_name; break }
          if (comp.types.includes('sublocality_level_1') && !cityRaw) cityRaw = comp.long_name
          if (comp.types.includes('administrative_area_level_3') && !cityRaw) cityRaw = comp.long_name
        }

        onSelect({
          address: place.formatted_address || prediction.description,
          lat,
          lon,
          city: normalizeCity(cityRaw),
        })
      }
    )
  }

  function splitDescription(pred: google.maps.places.AutocompletePrediction) {
    const main = pred.structured_formatting?.main_text || pred.description
    const secondary = pred.structured_formatting?.secondary_text || ''
    return { main, secondary }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <label className="field-label">Address</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="field-input"
          placeholder="123 Rue Sainte-Catherine, Montréal"
          value={value}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner" style={{ width: 16, height: 16 }} />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((pred) => {
            const { main, secondary } = splitDescription(pred)
            return (
              <div
                key={pred.place_id}
                className="autocomplete-item"
                onMouseDown={() => handleSelect(pred)}
              >
                <svg width="14" height="16" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M7 0C4.24 0 2 2.24 2 5c0 3.75 5 11 5 11s5-7.25 5-11c0-2.76-2.24-5-5-5zm0 6.75A1.75 1.75 0 1 1 7 3.25a1.75 1.75 0 0 1 0 3.5z" fill="#1D9E75" opacity="0.8"/>
                </svg>
                <div>
                  <div className="autocomplete-item-main">{main}</div>
                  {secondary && <div className="autocomplete-item-sub">{secondary}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
