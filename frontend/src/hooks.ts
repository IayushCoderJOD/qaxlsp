import { useEffect, useState } from 'react'

export function useApi<T>(url: string) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status})`)
        }
        return res.json() as Promise<T>
      })
      .then((json) => {
        setData(json)
        setError(undefined)
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [url])

  return { data, error, loading }
}

export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
